from django.db import models

from apps.users.models import User
from core.base_model import BaseModel


class PrivateChatRoom(BaseModel):
    """Represents a one-to-one anonymous private chat session between two users.

    Each room is created by the matchmaking system and progresses through a
    defined lifecycle: WAITING → ACTIVE → ENDED. The `user_one` and `user_two`
    fields are intentionally not exposed to either party until a reveal request
    is accepted, preserving anonymity throughout the session.

    Attributes:
        user_one: The user who was dequeued from the waiting queue (matcher).
        user_two: The user who triggered the match by joining the queue.
        reveal_completed: Indicates whether both parties have agreed to reveal
            their identities.
        status: The current lifecycle status of the chat room.
        closed_at: The timestamp at which the room was ended. Null if active.
    """

    class Status(models.TextChoices):
        """Lifecycle states for a private chat room."""

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
    """Represents a single message sent inside a private chat room.

    Messages are ordered chronologically and belong to exactly one room.
    Only the sender and their chat partner should ever be able to read
    messages in a given room.

    Attributes:
        room: The private chat room this message belongs to.
        sender: The user who sent the message.
        message: The text body of the message.
        message_type: The format of the message (e.g., text). Extensible for
            future types such as images or reactions.
        is_read: Indicates whether the recipient has read this message.
    """

    class MessageType(models.TextChoices):
        """Supported message content types."""

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
    """Represents a request from one chat participant to reveal identities.

    Either participant may initiate a reveal request. The other participant
    can accept or reject it. If accepted, `PrivateChatRoom.reveal_completed`
    is set to True, allowing both parties to see each other's profiles.

    Attributes:
        room: The chat room in which the reveal request was made.
        requester: The user who sent the reveal request.
        receiver: The user who must respond to the reveal request.
        status: The current state of the request (pending, accepted, rejected).
        responded_at: The timestamp at which the receiver responded. Null if
            the request is still pending.
    """

    class Status(models.TextChoices):
        """Possible states of a reveal request."""

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
            models.Index(fields=["room", "receiver", "status"]),
        ]

    def __str__(self):
        return f"{self.requester.email} → {self.receiver.email}"


class Report(BaseModel):
    """Represents a report filed by one user against another after a chat session.

    Reports are reviewed by administrators. A reporter may attach an optional
    description and evidence URL to support the report.

    Attributes:
        room: The chat room in which the reportable incident occurred.
        reporter: The user who filed the report.
        reported_user: The user being reported.
        reason: A short summary of the reason for the report.
        description: An optional detailed explanation of the incident.
        evidence_url: An optional URL to supporting evidence (e.g., a screenshot).
        status: The current moderation status of the report.
    """

    class Status(models.TextChoices):
        """Moderation workflow states for a report."""

        PENDING = "pending", "Pending"
        REVIEWED = "reviewed", "Reviewed"
        RESOLVED = "resolved", "Resolved"

    class ReportReason(models.TextChoices):
        SPAM = "spam", "Spam"
        HARASSMENT = "harassment", "Harassment"
        ABUSIVE_LANGUAGE = "abusive_language", "Abusive Language"
        INAPPROPRIATE_CONTENT = "inappropriate_content", "Inappropriate Content"
        FAKE_IDENTITY = "fake_identity", "Fake Identity"
        OTHER = "other", "Other"

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

    reason = models.CharField(
        max_length=50,
        choices=ReportReason.choices,
    )

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
            models.Index(fields=["room", "reporter", "status"]),
        ]

    def __str__(self):
        return f"{self.reporter.email} reported {self.reported_user.email}"
