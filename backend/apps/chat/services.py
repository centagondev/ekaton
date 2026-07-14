from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import PrivateChatRoom, PrivateMessage, Report, RevealRequest


def create_private_chat_room(user_one, user_two):

    return PrivateChatRoom.objects.create(
        user_one=user_one, user_two=user_two, status=PrivateChatRoom.Status.ACTIVE
    )


def end_private_chat_room(room):
    """End an active private chat room."""

    room.status = PrivateChatRoom.Status.ENDED
    room.closed_at = timezone.now()

    room.save(updated_fileds=["status", "closed_at"])


def get_private_chat_room(room_id):
    try:
        room = PrivateChatRoom.objects.get(id=room_id)
    except PrivateChatRoom.DoesNotExist:
        raise ObjectDoesNotExist("Private chat room not found.")

    return room


@transaction.atomic
def create_private_message(room, sender, message):

    if room.status != PrivateChatRoom.Status.ACTIVE:
        raise ValidationError("This chat is no longer active")

    message = message.strip()

    if not message:
        raise ValidationError("Message cannot be empty")

    private_message = PrivateMessage.objects.create(
        room=room, sender=sender, message=message
    )
    return private_message


@transaction.atomic
def create_reveal_request(room, requester, receiver):
    """Create a reveal identity request."""

    if room.status != room.Status.ACTIVE:
        raise ValidationError("This chat is no longer active")

    if room.reveal_completed:
        raise ValidationError("Identity has already been revealed")

    if requester == receiver:
        raise ValidationError("You cannot send reveal request to yourself")

    reveal_request = RevealRequest.objects.filter(
        room=room,
        requester=requester,
        receiver=receiver,
        status=RevealRequest.Status.PENDING,
    ).first()

    if reveal_request:
        raise ValidationError("A reveal request is already pending")

    return RevealRequest.objects.create(
        room=room, requester=requester, receiver=receiver
    )


@transaction.atomic
def respond_to_reveal_request(reveal_request, receiver, status):
    """Accept or reject a reveal request."""
    if reveal_request.status != RevealRequest.Status.PENDING:
        raise ValidationError("This reveal request has already been processed")

    if reveal_request.receiver != receiver:
        raise ValidationError(
            "You are not allowed to respond tot this reveal request ."
        )

    if status not in [RevealRequest.Status.ACCEPTED, RevealRequest.Status.REJECTED]:
        raise ValidationError("Invalid reveal request status.")

    reveal_request.status = status
    reveal_request.responded_at = timezone.now()

    reveal_request.save(update_fields=["status", "responded_at"])

    if status == RevealRequest.Status.ACCEPTED:
        room = reveal_request.room
        room.reveal_completed = True

        room.save(update_fields=["reveal_completed"])

    return reveal_request


@transaction.atomic
def create_report(
    room, reporter, reported_user, reason, description=None, evidence_url=None
):
    """Create a report against a user."""

    if room.status != room.Status.ACTIVE:
        raise ValidationError("This chat is no longer active")

    if reporter == reported_user:
        raise ValidationError("You cannot report yourself.")

    return Report.objects.create(
        room=room,
        reporter=reporter,
        reported_user=reported_user,
        reason=reason,
        description=description,
        evidence_url=evidence_url,
    )
