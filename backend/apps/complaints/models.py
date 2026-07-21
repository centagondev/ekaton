from django.conf import settings
from django.db import models

from core.base_model import BaseModel


class Complaint(BaseModel):
    class Category(models.TextChoices):
        GENERAL = "general", "General"
        FACILITIES = "facilities", "Facilities"
        EVENTS = "events", "Events"
        ACADEMIC = "academic", "Academic"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        UNDER_REVIEW = "under_review", "Under Review"
        RESOLVED = "resolved", "Resolved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="complaints",
    )

    title = models.CharField(max_length=150)

    description = models.TextField()

    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.GENERAL,
    )

    is_anonymous = models.BooleanField(default=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["-created_at"],
                name="complaint_created_idx",
            ),
            models.Index(
                fields=["status", "-created_at"],
                name="complaint_status_idx",
            ),
            models.Index(
                fields=["category", "-created_at"],
                name="complaint_category_idx",
            ),
        ]

    def __str__(self):
        return self.title


class ComplaintComment(BaseModel):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="comments",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="complaint_comments",
    )

    comment = models.TextField()

    is_anonymous = models.BooleanField(default=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment on {self.complaint.title}"


class ComplaintUpvote(BaseModel):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="upvotes",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="complaint_upvotes",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["complaint", "user"],
                name="unique_complaint_upvote",
            )
        ]

    def __str__(self):
        return f"{self.user.email} upvoted {self.complaint.title}"
