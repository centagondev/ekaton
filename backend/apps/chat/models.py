from django.db import models

from apps.users.models import User
from core.base_model import BaseModel


class PrivateChatRoom(BaseModel):
    """Represents a one-to-one anonymous chat session."""

    class Status(models.TextChoices):
        WAITING = "waiting", "Waiting"
        ACTIVE = "active", "Active"
        ENDED = "ended", "Ended"

    user_one = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="started_private_chats",
    )

    user_two = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_private_chats",
    )

    reveal_completed = models.BooleanField(default=False)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.WAITING,
    )

    closed_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    class Meta:
        db_table = "private_chat_rooms"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user_one"]),
            models.Index(fields=["user_two"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.user_one.email} ↔ {self.user_two.email}"


class PrivateMessage(BaseModel):
    """Represents a private chat message."""

    class MessageType(models.TextChoices):
        TEXT = "text", "Text"

    room = models.ForeignKey(
        PrivateChatRoom,
        on_delete=models.CASCADE,
        related_name="messages",
    )

    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="private_messages",
    )

    message = models.TextField()

    message_type = models.CharField(
        max_length=20,
        choices=MessageType.choices,
        default=MessageType.TEXT,
    )

    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = "private_messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["room"]),
            models.Index(fields=["sender"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.sender.email} - {self.room.id}"


class RevealRequest(BaseModel):
    """Represents a request to reveal identities."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    room = models.ForeignKey(
        PrivateChatRoom,
        on_delete=models.CASCADE,
        related_name="reveal_requests",
    )

    requester = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_reveal_requests",
    )

    receiver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_reveal_requests",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    responded_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    class Meta:
        db_table = "reveal_requests"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["room"]),
            models.Index(fields=["requester"]),
            models.Index(fields=["receiver"]),
        ]

    def __str__(self):
        return f"{self.requester.email} → {self.receiver.email}"


class Report(BaseModel):
    """Represents a user report after a private chat."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        REVIEWED = "reviewed", "Reviewed"
        RESOLVED = "resolved", "Resolved"

    room = models.ForeignKey(
        PrivateChatRoom,
        on_delete=models.CASCADE,
        related_name="reports",
    )

    reporter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="submitted_reports",
    )

    reported_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="reports_against",
    )

    reason = models.CharField(max_length=255)

    description = models.TextField(
        blank=True,
        null=True,
    )

    evidence_url = models.URLField(
        blank=True,
        null=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    class Meta:
        db_table = "reports"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["room"]),
            models.Index(fields=["reporter"]),
            models.Index(fields=["reported_user"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.reporter.email} reported {self.reported_user.email}"
