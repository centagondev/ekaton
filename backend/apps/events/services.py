import logging
import secrets

from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import AnonymousName, Event, EventMessage, EventParticipant, EventStatus

logger = logging.getLogger(__name__)
MAX_LENGTH_CONTENT = 1000


@transaction.atomic
def create_event(*, user, validated_data):
    """
    Create a new event owned by the authenticated user.

    If anonymous chat is enabled, a unique anonymous seed is
    generated for the event. This seed is later used to assign
    deterministic anonymous identities to participants.
    """
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

    if event.status != EventStatus.ACTIVE:
        raise ValidationError("This event is no longer active and cannot be updated.")

    if event.owner != user:
        logger.warning(
            "User '%s' attempted to update event '%s' without permission.",
            user.email,
            event.id,
        )
        # catches it and converts it into an HTTP 403 Forbidden status code to send back to your React
        raise PermissionDenied("You do not have permission to update this event.")

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

    if event.status != EventStatus.ACTIVE:
        raise ValidationError("This event is no longer active and cannot be cancelled.")

    if event.owner != user:

        logger.warning(
            "User '%s' attempted to cancel event '%s' without permission.",
            user.email,
            event.id,
        )
        raise PermissionDenied("You do not have permission to cancel this event.")

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

    Returns:
        QuerySet[Event]:
            A queryset containing all active events.
    """
    return (
        Event.objects.select_related("owner")
        .filter(status=EventStatus.ACTIVE, end_time__gt=timezone.now())
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
        # Fallback for clean deployments where the database hasn't been seeded yet
        default_name, _ = AnonymousName.objects.get_or_create(
            name="Anonymous Participant"
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

        participant.save(
            update_fields=[
                "is_active",
                "left_at",
                "updated_at",
            ]
        )

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
def send_event_message(*, content: str, participant: EventParticipant):
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

    if len(content) > MAX_LENGTH_CONTENT:
        raise ValidationError(f"Message cannot exceed {MAX_LENGTH_CONTENT} characters.")

    message = EventMessage.objects.create(
        event=participant.event,
        participant=participant,
        content=content,
    )

    return message
