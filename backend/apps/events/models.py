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

    class Meta:
        db_table = "events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["end_time"]),
            models.Index(fields=["owner"]),
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

    anonymous_name = models.CharField(
        max_length=100,
        null=True,
        blank=True,
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
        ordering = ["joined_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["event", "user"],
                name="unique_event_participant",
            )
        ]
        indexes = [
            models.Index(fields=["event"]),
            models.Index(fields=["user"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["event", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user.full_name} - {self.event.name}"
