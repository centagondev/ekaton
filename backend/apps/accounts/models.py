from django.db import models

from apps.users.models import User
from core.base_model import BaseModel


class PasswordResetToken(BaseModel):
    """
    Stores one-time tokens used for account activation
    and password reset.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )

    token = models.CharField(
        max_length=255,
        unique=True,
    )

    expires_at = models.DateTimeField()

    used = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email}"
