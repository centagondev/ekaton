import logging

from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Event, EventParticipant, EventStatus

logger = logging.getLogger(__name__)


@transaction.atomic
def create_event(*, user, validated_data):
    """
    Create a new event owned by the authenticated user.

    The authenticated user is automatically assigned as the
    event owner. Newly created events are marked as ACTIVE
    by default and are immediately available for other users
    to discover and join.

    Args:
        user:
            The authenticated user creating the event.

        validated_data:
            Validated event data from the serializer.

    Returns:
        Event:
            The newly created event instance.
    """

    event = Event.objects.create(owner=user, **validated_data)

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
        .filter(
            status=EventStatus.ACTIVE,
        )
        .order_by("-created_at")
    )


@transaction.atomic
def join_event(*, event, user):
    """
    Add the authenticated user as a participant in an event.

    If the user has previously joined and left the same event,
    the existing participation record is reactivated instead of
    creating a new one.

    Args:
        event:
            The event to join.

        user:
            The authenticated user joining the event.

    Returns:
        EventParticipant:
            The active event participant instance.

    Raises:
        ValidationError:
            If the event cannot be joined.
    """

    if not user.is_verified:
        raise ValidationError("Your account must be verified before joining an event.")

    if not user.is_active:
        raise ValidationError("Your account is inactive.")

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

    try:
        participant = EventParticipant.objects.create(event=event, user=user)

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
