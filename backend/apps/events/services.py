import logging
import secrets

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.presence.services import EventPresenceService
from apps.users.models import User

from .moderation import moderate
from .models import (
    MAX_MESSAGE_LENGTH,
    AnonymousName,
    Event,
    EventMessage,
    EventParticipant,
    EventStatus,
)

logger = logging.getLogger(__name__)

# only 2 event can create by user dalily allowed

MAX_EVENTS_PER_DAY = 2


def event_group_name(event_id) -> str:
    """
    Return the channel layer group that carries an event's chat.

    Defined here so the consumer, the REST views and the Celery tasks
    cannot drift apart on the group naming.
    """
    return f"event_{event_id}"


def event_member_group_name(event_id, user_id) -> str:
    """
    Return the channel layer group that reaches one participant's sockets
    on a single event.

    Used to address a participant on their own, which the event-wide group
    cannot do. Kept beside ``event_group_name`` for the same reason: the
    consumer and the views must agree on it.
    """
    return f"event_{event_id}_user_{user_id}"


def close_event_connections(*, event, reason):
    """
    Tell everyone connected to an event that it is over, then drop the
    event's presence data.

    Called after an event has been cancelled or has expired. Without this
    the clients keep an open socket on an event that can no longer accept
    messages, and the event's Redis presence set is never reclaimed.

    Args:
        event:
            The event that was closed.

        reason:
            Why it closed, forwarded to the client ("cancelled" / "ended").
    """
    channel_layer = get_channel_layer()

    if channel_layer is None:
        logger.error(
            "No channel layer configured; cannot close connections for event '%s'.",
            event.id,
        )
        return

    async_to_sync(channel_layer.group_send)(
        event_group_name(event.id),
        {
            "type": "event.closed",
            "reason": reason,
        },
    )

    EventPresenceService.clear_event_presence(event.id)


def close_participant_connections(*, event, user, reason):
    """
    Tell one participant's sockets on an event that their participation is
    over, so each of them closes.

    Called after a participant leaves. Leaving only flips the participant
    row, so without this their sockets stay in the event's group: they can
    no longer send, but they keep receiving everyone else's messages until
    the socket happens to close. One tab left open in the background is
    enough to keep reading a chat they are no longer part of, which on an
    anonymous event is a disclosure and not just a stale view.

    Their presence is not cleared here. Closing the socket runs the
    consumer's disconnect, which releases that connection and announces the
    departure once their last socket is gone.

    Args:
        event:
            The event the participant left.

        user:
            The participant who left.

        reason:
            Why their connections are closing, forwarded to the client.
    """
    channel_layer = get_channel_layer()

    if channel_layer is None:
        logger.error(
            "No channel layer configured; cannot close connections for user "
            "'%s' on event '%s'.",
            user.id,
            event.id,
        )
        return

    async_to_sync(channel_layer.group_send)(
        event_member_group_name(event.id, user.id),
        {
            "type": "event.closed",
            "reason": reason,
        },
    )


def count_events_created_today(user):
    """
    Return how many events the user has created since midnight.

    The day starts at local midnight (settings.TIME_ZONE), not UTC. Using UTC
    here would reset everyone's limit at 5:30 AM local time instead.
    """
    start_of_day = timezone.localtime().replace(hour=0, minute=0, second=0)

    return Event.objects.filter(
        owner=user,
        created_at__gte=start_of_day,
    ).count()


@transaction.atomic
def create_event(*, user, validated_data):
    """
    Create a new event owned by the authenticated user.

    Users may only create MAX_EVENTS_PER_DAY events a day; the limit resets
    at midnight.

    If anonymous chat is enabled, a unique anonymous seed is
    generated for the event. This seed is later used to assign
    deterministic anonymous identities to participants.
    """
    # Lock the user's row so two requests at the same time cannot both pass
    # the check below and both create. Without it, 5 fast clicks made 4 events.
    User.objects.select_for_update().get(pk=user.pk)

    if count_events_created_today(user) >= MAX_EVENTS_PER_DAY:
        logger.warning(
            "Daily event limit reached by user '%s'.",
            user.email,
        )
        raise ValidationError(
            f"You can only create {MAX_EVENTS_PER_DAY} events per day. "
            "You can create again after midnight."
        )

    event_data = {
        "owner": user,
        **validated_data,
    }
    if event_data.get("is_anonymous_chat"):
        event_data["anonymous_seed"] = secrets.randbits(63)
        event_data["anonymous_counter"] = 0

    event = Event.objects.create(**event_data)

    logger.info("Event '%s' created successfully by user '%s'.", event.name, user.email)
    return event


@transaction.atomic
def update_event(*, event, user, validated_data):
    """
    Update an existing event.
    Only the event owner is allowed to update the event.
    Args:
        event:
            The event instance to update.
        user:
            The authenticated user requesting the update.
        validated_data:
            The validated event data returned by
            UpdateEventSerializer.
    Returns:
        Event:
            The updated event instance.
    Raises:
        PermissionDenied:
            If the authenticated user is not the event owner.
    """

    # Lock the event row FIRST so an update cannot be applied on top of a
    # concurrent cancellation or expiry.
    event = Event.objects.select_for_update().get(pk=event.pk)

    # Ownership is checked before the status so a user who does not own the
    # event always gets the same 403, whatever state the event is in. The
    # other order answers "no longer active" to a stranger and so tells them
    # something about an event that is none of their business.
    if event.owner != user:
        logger.warning(
            "User '%s' attempted to update event '%s' without permission.",
            user.email,
            event.id,
        )
        # catches it and converts it into an HTTP 403 Forbidden status code to send back to your React
        raise PermissionDenied("You do not have permission to update this event.")

    if event.status != EventStatus.ACTIVE:
        raise ValidationError("This event is no longer active and cannot be updated.")

    for field, value in validated_data.items():
        setattr(
            event, field, value
        )  # With the setattr loop, you don't have to touch this code ever again. It adapts automatically to whatever fields are in validated_data.

    event.save(
        update_fields=[
            *validated_data.keys(),
            "updated_at",
        ]
    )

    logger.info(
        "Event '%s' updated successfully by '%s'.",
        event.name,
        user.email,
    )

    return event


@transaction.atomic
def cancel_event(*, event, user):
    """
    Cancel an active event.

    Cancelling an event prevents any further participation
    while preserving the event, participants, and chat
    history for future reference.

    All active participants are automatically marked as
    inactive when the event is cancelled.

    Args:
        event:
            The event instance to cancel.

        user:
            The authenticated user requesting the cancellation.

    Raises:
        ValidationError:
            If the event is no longer active.

        PermissionDenied:
            If the authenticated user is not the event owner.
    """
    # Lock the event row to prevent concurrent cancellations from race conditions
    event = Event.objects.select_for_update().get(pk=event.pk)

    # Checked before the status for the same reason as update_event: a
    # stranger gets 403 and learns nothing about the event's state.
    if event.owner != user:
        logger.warning(
            "User '%s' attempted to cancel event '%s' without permission.",
            user.email,
            event.id,
        )
        raise PermissionDenied("You do not have permission to cancel this event.")

    if event.status != EventStatus.ACTIVE:
        raise ValidationError("This event is no longer active and cannot be cancelled.")

    event.status = EventStatus.CANCELLED
    current_time = timezone.now()

    event.save(update_fields=["status", "updated_at"])

    EventParticipant.objects.filter(event=event, is_active=True).update(
        is_active=False, left_at=current_time
    )

    logger.info(
        "Event '%s' was cancelled successfully by '%s'.", event.name, user.email
    )

    return event


def get_event(*, event_id):
    """
    Retrieve an event by its unique identifier.

    This function returns the event regardless of its current
    status. Business rules related to event status (such as
    editing, joining, or cancelling) are handled by the
    corresponding service functions.

    Args:
        event_id:
            The unique identifier of the event.

    Returns:
        Event:
            The requested event instance.

    Raises:
        Http404:
            If no event exists with the given identifier.
    """
    return get_object_or_404(
        Event.objects.select_related("owner").prefetch_related(
            Prefetch(
                "participants", queryset=EventParticipant.objects.filter(is_active=True)
            )
        ),
        pk=event_id,
    )


def list_events():
    """
    Retrieve all active events.

    Only active events are returned, ordered by their
    creation time in descending order.

    Each event carries its active participant count as an annotation, so the
    list endpoint can render it without a query per event.

    Returns:
        QuerySet[Event]:
            A queryset containing all active events.
    """
    return (
        Event.objects.select_related("owner")
        .filter(status=EventStatus.ACTIVE, end_time__gt=timezone.now())
        .annotate(
            participant_count=Count(
                "participants",
                filter=Q(participants__is_active=True),
                distinct=True,
            )
        )
        .order_by("-created_at")
    )


def _assign_anonymous_name(*, event):
    """
    Assign the next anonymous identity for an anonymous event.

    This function assumes the event row is already locked using
    select_for_update() by the caller.
    """

    total_names = AnonymousName.objects.count()

    if total_names == 0:
        # Fallback for clean deployments where the database hasn't been seeded
        # yet. Every participant shares this identity, so it is only a way to
        # keep the event usable, not a substitute for the seeded name pool.
        logger.warning(
            "No anonymous names are seeded; event '%s' is falling back to a "
            "shared identity. Run 'manage.py migrate' to seed them.",
            event.id,
        )
        default_name, _ = AnonymousName.objects.get_or_create(
            display_name="Anonymous Participant"
        )
        return default_name

    if event.anonymous_seed is None:
        raise ValidationError("Anonymous event seed is missing.")

    index = (event.anonymous_seed + event.anonymous_counter) % total_names

    anonymous_name = AnonymousName.objects.order_by("id")[index]

    event.anonymous_counter += 1
    event.save(update_fields=["anonymous_counter"])

    return anonymous_name


@transaction.atomic
def join_event(*, event, user):
    """
    Add the authenticated user as a participant in an event.

    If the user has previously joined and left the same event,
    the existing participation record is reactivated instead of
    creating a new one.


    Join an event.

    If the event uses anonymous chat, assign a deterministic
    anonymous identity to the participant.
    """

    if not user.is_verified:
        raise ValidationError("Your account must be verified before joining an event.")

    if not user.is_active:
        raise ValidationError("Your account is inactive.")

    # Lock the event row FIRST to prevent race conditions with cancellation/expiry
    event = Event.objects.select_for_update().get(pk=event.pk)

    if event.status != EventStatus.ACTIVE:
        raise ValidationError("This event is no longer active.")

    if event.end_time < timezone.now():
        raise ValidationError("This event has ended and can no longer be joined.")

    participant = (
        EventParticipant.objects.select_for_update()
        .filter(
            event=event,
            user=user,
        )
        .first()
    )
    if participant:
        if participant.is_active:
            raise ValidationError("You have already joined this event.")

        participant.is_active = True
        participant.left_at = None

        update_fields = [
            "is_active",
            "left_at",
            "updated_at",
        ]

        # A returning participant keeps the identity they had before, so the
        # chat history stays coherent. One is assigned only when it is
        # missing, which happens when the name row was removed while they
        # were away.
        if event.is_anonymous_chat and participant.anonymous_name_id is None:
            participant.anonymous_name = _assign_anonymous_name(event=event)
            update_fields.append("anonymous_name")

        participant.save(update_fields=update_fields)

        logger.info(
            "User '%s' rejoined event '%s'.",
            user.email,
            event.name,
        )
        return participant

    anonymous_name = None
    if event.is_anonymous_chat:
        anonymous_name = _assign_anonymous_name(event=event)

    try:
        participant_data = {"event": event, "user": user}
        if event.is_anonymous_chat:
            participant_data["anonymous_name"] = anonymous_name

        participant = EventParticipant.objects.create(**participant_data)

    except IntegrityError:
        logger.warning(
            "Concurrent join attempt detected for user '%s' on event '%s'.",
            user.email,
            event.name,
        )
        raise ValidationError("You have already joined this event.")

    logger.info(
        "User '%s' joined event '%s'.",
        user.email,
        event.name,
    )

    return participant


@transaction.atomic
def leave_event(*, event, user):
    """
    Remove the authenticated user from an active event.

    The participant record is preserved to maintain
    participation history and support future features,
    such as restoring the user's anonymous identity when
    rejoining the same event.

    Args:
        event:
            The event to leave.

        user:
            The authenticated user leaving the event.

    Returns:
        EventParticipant:
            The updated participant instance.

    Raises:
        ValidationError:
            If the user cannot leave the event.
    """
    # Lock the event row FIRST to prevent race conditions with cancellation
    event = Event.objects.select_for_update().get(pk=event.pk)

    if event.status != EventStatus.ACTIVE:
        raise ValidationError("This event is no longer active.")

    participant = (
        EventParticipant.objects.select_for_update()
        .filter(
            event=event,
            user=user,
        )
        .first()
    )

    if participant is None:
        raise ValidationError("You are not a participant in this event.")

    if not participant.is_active:
        raise ValidationError("You have already left this event.")
    current_time = timezone.now()

    participant.is_active = False
    participant.left_at = current_time

    participant.save(
        update_fields=[
            "is_active",
            "left_at",
            "updated_at",
        ]
    )

    logger.info(
        "User '%s' left event '%s'.",
        user.email,
        event.name,
    )

    return participant


@transaction.atomic
def send_event_message(
    *, content: str, participant: EventParticipant, reply_to_id=None
):
    """
    Create a new event message.

    Args:
        participant:
            The event participant sending the message.

        content:
            The message text.

    Returns:
        EventMessage:
            The newly created message.
    """
    # Refresh participant to get latest database state
    participant.refresh_from_db()

    if not participant.is_active:
        raise ValidationError("You are no longer a participant of this event.")

    # Refresh event to get latest status/end_time
    participant.event.refresh_from_db()

    if participant.event.status != EventStatus.ACTIVE:
        raise ValidationError("This event is no longer active.")

    if participant.event.end_time < timezone.now():
        raise ValidationError("This event has ended. Messages can no longer be sent.")

    if not isinstance(content, str):
        raise ValidationError("Message content must be a string.")

    content = content.strip()

    if not content:
        raise ValidationError("Message content is required.")

    if len(content) > MAX_MESSAGE_LENGTH:
        raise ValidationError(f"Message cannot exceed {MAX_MESSAGE_LENGTH} characters.")

    # Masked before saving, so the original profanity never reaches the
    # database and every reader — REST, WebSocket, history — sees the same
    # cleaned text.
    content = moderate(content)

    reply_to = None

    if reply_to_id is not None:
        # replying to a message from a DIFFERENT event, which would pull that
        # event's private content into this chat as a quote.
        try:
            reply_to = EventMessage.objects.filter(
                id=reply_to_id,
                event=participant.event,
            ).first()
        except (DjangoValidationError, ValueError):
            reply_to = None

        if reply_to is None:
            raise ValidationError("The message you are replying to was not found.")
    message = EventMessage.objects.create(
        event=participant.event,
        participant=participant,
        content=content,
        reply_to=reply_to,
    )

    return message
