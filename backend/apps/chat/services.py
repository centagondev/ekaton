import logging

from core.cloudinary import delete_image, upload_image
from core.encryption import encrypt_message
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from .models import PrivateChatRoom, PrivateMessage, Report, RevealRequest

logger = logging.getLogger("chat")

# Cloudinary folder for moderation evidence, kept separate from "profile" so
# the two asset sets can be retained and purged on their own schedules.
REPORT_EVIDENCE_FOLDER = "reports/evidence"


class EvidenceUploadFailed(APIException):
    """Cloudinary rejected or could not be reached for an evidence upload.

    A 502 rather than a 400: nothing about the reporter's file is wrong, so
    telling them to fix it would be a lie. Retrying is the right advice.
    """

    status_code = 502
    default_detail = "Could not upload the evidence image. Please try again."
    default_code = "evidence_upload_failed"


def create_private_chat_room(user_one, user_two):
    """Create and return a new active private chat room between two users.

    This function is called by the matchmaking system immediately after a
    successful match. The room is created with ACTIVE status since both users
    are confirmed to> be online at the time of creation.

    Args:
        user_one: The User instance dequeued from the waiting queue (the waiter).
        user_two: The User instance who triggered the match (the joiner).

    Returns:
        A newly created PrivateChatRoom instance with status ACTIVE.
    """
    return PrivateChatRoom.objects.create(
        user_one=user_one,
        user_two=user_two,
        status=PrivateChatRoom.Status.ACTIVE,
    )


def end_private_chat_room(room):
    """Mark an active private chat room as ended and record the closing time.

    Uses `update_fields` to issue a targeted UPDATE statement, avoiding a
    full model save and preventing accidental overwrites of unrelated fields.

    Args:
        room: The PrivateChatRoom instance to end.
    """

    if room.status != PrivateChatRoom.Status.ACTIVE:
        return room

    room.status = PrivateChatRoom.Status.ENDED
    room.closed_at = timezone.now()
    room.save(update_fields=["status", "closed_at"])

    return room


def get_private_chat_room(room_id, user):
    """Retrieve a private chat room by ID for a participant."""

    return (
        PrivateChatRoom.objects.select_related(
            "user_one",
            "user_two",
        )
        .filter(
            id=room_id,
        )
        .filter(
            Q(user_one=user) | Q(user_two=user),
        )
        .first()
    )


@transaction.atomic
def create_private_message(room, sender, message, reply_to_id=None):
    """Create and return a new private message in an active chat room.

    Validates that the room is still active and that the message content is
    not empty after stripping whitespace. The entire operation is wrapped in
    a database transaction.

    Args:
        room: The PrivateChatRoom instance in which to send the message.
        sender: The User instance sending the message.
        message: The raw text content of the message.
        reply_to_id: Optional id of the message being replied to. Must belong
            to this same room; anything else is treated as not found.

    Returns:
        The newly created PrivateMessage instance.

    Raises:
        ValidationError: If the room is not active, the message is empty, or
            reply_to_id was given but does not resolve to a message in this
            room.
    """

    room.refresh_from_db(fields=["status", "reveal_completed"])
    if room.status != PrivateChatRoom.Status.ACTIVE:
        raise ValidationError("This chat room is no longer active.")

    message = message.strip()

    if not message:
        raise ValidationError("Message content cannot be empty.")

    reply_to = None

    if reply_to_id is not None:
        # reply_to_id comes straight from the client frame, so it may be
        # anything at all; scoping to this room is what stops a reply from
        # pulling in a message the sender was never part of.
        try:
            reply_to = PrivateMessage.objects.filter(id=reply_to_id, room=room).first()
        except (DjangoValidationError, ValueError):
            reply_to = None

        if reply_to is None:
            raise ValidationError("The message you are replying to was not found.")

    return PrivateMessage.objects.create(
        room=room,
        sender=sender,
        message=encrypt_message(message),
        reply_to=reply_to,
    )


@transaction.atomic
def create_reveal_request(room, requester, receiver):
    """Create and return a reveal identity request within an active chat room.

    Validates that the chat is active, identities have not already been
    revealed, the requester is not sending the request to themselves, and
    that no pending reveal request from the same requester already exists.

    Args:
        room: The PrivateChatRoom instance in which to send the reveal request.
        requester: The User instance initiating the reveal request.
        receiver: The User instance who will receive and respond to the request.

    Returns:
        The newly created RevealRequest instance.

    Raises:
        ValidationError: If any of the pre-conditions are not met.
    """

    room.refresh_from_db(
        fields=[
            "status",
            "reveal_completed",
        ]
    )
    if room.status != PrivateChatRoom.Status.ACTIVE:
        raise ValidationError("This chat room is no longer active.")

    if room.reveal_completed:
        raise ValidationError("Identities have already been revealed in this room.")

    if requester == receiver:
        raise ValidationError("You cannot send a reveal request to yourself.")

    pending_request_exists = RevealRequest.objects.filter(
        room=room,
        requester=requester,
        receiver=receiver,
        status=RevealRequest.Status.PENDING,
    ).exists()

    if pending_request_exists:
        raise ValidationError("A reveal request is already pending for this room.")

    return RevealRequest.objects.create(
        room=room,
        requester=requester,
        receiver=receiver,
    )


@transaction.atomic
def respond_to_reveal_request(reveal_request, receiver, status):
    """Accept or reject a pending reveal identity request.

    Validates that the request is still pending, that the responding user is
    the intended receiver, and that the provided status is a valid response.
    If accepted, marks the parent chat room's `reveal_completed` flag as True.

    Args:
        reveal_request: The RevealRequest instance to respond to.
        receiver: The User instance responding to the request.
        status: The response decision. Must be 'accepted' or 'rejected'.

    Returns:
        The updated RevealRequest instance.

    Raises:
        ValidationError: If the request has already been processed, the
            receiver is incorrect, or an invalid status value is provided.
    """

    reveal_request.refresh_from_db(
        fields=[
            "status",
        ]
    )
    if reveal_request.status != RevealRequest.Status.PENDING:
        raise ValidationError("This reveal request has already been processed.")

    if reveal_request.receiver != receiver:
        raise ValidationError(
            "You are not authorized to respond to this reveal request."
        )

    if status not in (
        RevealRequest.Status.ACCEPTED,
        RevealRequest.Status.REJECTED,
    ):
        raise ValidationError("Invalid status. Must be 'accepted' or 'rejected'.")

    reveal_request.status = status
    reveal_request.responded_at = timezone.now()
    reveal_request.save(update_fields=["status", "responded_at"])

    if status == RevealRequest.Status.ACCEPTED:
        room = reveal_request.room
        room.reveal_completed = True
        room.save(update_fields=["reveal_completed"])

    return reveal_request


def upload_report_evidence(image):
    """Upload a moderation evidence image to Cloudinary.

    Deliberately outside `create_report`'s transaction: a network round trip
    has no business holding a database lock. The caller is responsible for
    calling `discard_report_evidence` if the report it belongs to is rejected.

    Args:
        image: The validated uploaded image file.

    Returns:
        A dict with the hosted `url` and its Cloudinary `public_id`.

    Raises:
        EvidenceUploadFailed: If the upload does not complete.
    """
    try:
        return upload_image(image, REPORT_EVIDENCE_FOLDER)
    except Exception:
        logger.exception("Cloudinary upload failed for report evidence")
        raise EvidenceUploadFailed()


def discard_report_evidence(upload):
    """Roll back an evidence upload whose report was never created."""
    if upload:
        delete_image(upload.get("public_id"))


@transaction.atomic
def create_report(room, reporter, reason, description=None, evidence_url=None):
    room.refresh_from_db(fields=["status", "user_one", "user_two"])

    if reporter not in (room.user_one, room.user_two):
        raise ValidationError("You are not a participant in this chat room")

    reported_user = room.user_two if reporter == room.user_one else room.user_one

    if reporter == reported_user:
        raise ValidationError("You cannot report yourself")

    if Report.objects.filter(
        room=room, reporter=reporter, status=Report.Status.PENDING
    ).exists():
        raise ValidationError("You have already submitted a report for this chat")

    return Report.objects.create(
        room=room,
        reporter=reporter,
        reported_user=reported_user,
        reason=reason,
        description=description,
        evidence_url=evidence_url,
    )


def get_pending_reveal_request(room, receiver):
    """Return the most recent pending reveal request for the given receiver in a room.

    Uses select_related to pre-load the room, requester and receiver objects,
    avoiding extra queries in respond_to_reveal_request.

    Args:
        room: The PrivateChatRoom instance to search within.
        receiver: The User instance who should respond to the request.

    Returns:
        The most recent pending RevealRequest, or None if none exists.
    """
    return (
        RevealRequest.objects.select_related("room", "requester", "receiver")
        .filter(
            room=room,
            receiver=receiver,
            status=RevealRequest.Status.PENDING,
        )
        .order_by("-created_at")
        .first()
    )
