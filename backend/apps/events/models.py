from django.conf import settings
from django.db import models
from django.utils import timezone

from core.base_model import BaseModel


class EventStatus(models.TextChoices):
    """
    Represents the lifecycle state of an event.
    """

    ACTIVE = "active", "Active"
    ENDED = "ended", "Ended"
    CANCELLED = "cancelled", "Cancelled"


class EventBanner(models.TextChoices):
    """
    Represents the predefined banner options
    available for an event.
    """

    BANNER_1 = "banner_1", "Banner 1"
    BANNER_2 = "banner_2", "Banner 2"
    BANNER_3 = "banner_3", "Banner 3"
    BANNER_4 = "banner_4", "Banner 4"
    BANNER_5 = "banner_5", "Banner 5"
    BANNER_6 = "banner_6", "Banner 6"


class AnonymousName(BaseModel):
    """
    Represents a predefined anonymous display name
    that can be assigned to users in anonymous events.
    """

    display_name = models.CharField(
        max_length=100,
        unique=True,
    )

    class Meta:
        db_table = "anonymous_names"
        ordering = ["display_name"]
        verbose_name = "Anonymous Name"
        verbose_name_plural = "Anonymous Names"

    def __str__(self):
        return self.display_name


class Event(BaseModel):
    """
    Represents an event created by a user.

    An event serves as a temporary discussion space where
    students can connect around a shared activity or topic.

    Events may support either:
        • Anonymous group chat
        • Identity-revealed group chat
    """

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_events",
    )

    banner = models.CharField(
        max_length=20,
        choices=EventBanner.choices,
    )

    name = models.CharField(
        max_length=150,
    )

    description = models.TextField()

    venue = models.CharField(
        max_length=255,
    )

    end_time = models.DateTimeField()

    is_anonymous_chat = models.BooleanField(
        default=False,
    )

    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        default=EventStatus.ACTIVE,
    )

    anonymous_seed = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        help_text="Random starting index for anonymous name allocation.",
    )

    anonymous_counter = models.PositiveIntegerField(
        default=0,
        help_text="Tracks the next anonymous name allocation.",
    )

    class Meta:
        db_table = "events"
        ordering = ["-created_at"]

        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["end_time"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["is_anonymous_chat"]),
        ]

    def __str__(self):
        return self.name


class EventParticipant(BaseModel):
    """
    Represents a user's participation in an event.

    This model tracks whether a user is currently an
    active participant and preserves participation
    history for future features such as anonymous
    identity persistence.
    """

    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="participants",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_participations",
    )

    anonymous_name = models.ForeignKey(
        AnonymousName,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="participants",
    )

    is_active = models.BooleanField(
        default=True,
    )

    joined_at = models.DateTimeField(
        default=timezone.now,
    )

    left_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "event_participants"
        ordering = ["-joined_at"]

        constraints = [
            models.UniqueConstraint(
                fields=["event", "user"],
                name="unique_event_participant",
            ),
        ]

        indexes = [
            models.Index(fields=["event", "is_active"]),
            models.Index(fields=["user"]),
            models.Index(fields=["anonymous_name"]),
        ]

    def __str__(self):
        return f"{self.event.name} - {self.user.full_name}"


class EventMessage(BaseModel):
    """
    Represents a single text message sent by a participant
    inside an event chat.

    Each message belongs to:
        - One Event
        - One EventParticipant

    Messages are immutable:
        - Cannot be edited
        - Cannot be deleted by users
        - Text only
    """

    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="messages",
        help_text="The event where this message was sent.",
    )

    participant = models.ForeignKey(
        "events.EventParticipant",
        on_delete=models.CASCADE,
        related_name="messages",
        help_text="The participant who sent the message.",
    )

    content = models.TextField(
        max_length=2000,
        help_text="Text content of the message.",
    )

    class Meta:
        db_table = "event_messages"
        verbose_name = "Event Message"
        verbose_name_plural = "Event Messages"

        ordering = ("created_at",)

        indexes = [
            models.Index(
                fields=("event", "created_at"),
                name="event_message_idx",
            ),
            models.Index(
                fields=("participant",),
                name="participant_message_idx",
            ),
        ]

    def __str__(self) -> str:
        """
        Return a readable representation of the message.
        """
        return f"Message by {self.participant} in {self.event}"
