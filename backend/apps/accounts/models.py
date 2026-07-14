from apps.users.models import User
from core.base_model import BaseModel
from django.db import models


# -----------------------------
# Abstract Base Token
# -----------------------------
class BaseToken(BaseModel):
    """
    Abstract base model for one-time secure tokens.

    Provides the common fields shared by all
    authentication token models.
    """

    token = models.CharField(
        max_length=255,
        unique=True,
    )

    expires_at = models.DateTimeField()

    used = models.BooleanField(default=False)

    class Meta:
        abstract = True


# -----------------------------
# Account Setup Token
# -----------------------------
class AccountSetupToken(BaseToken):
    """
    One-time token used during first-time account setup.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="account_setup_tokens",
    )

    class Meta:
        db_table = "account_setup_tokens"

    def __str__(self):
        return self.user.email


# -----------------------------
# Password Reset Token
# -----------------------------
class PasswordResetToken(BaseToken):
    """
    One-time token used for password reset.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
    )

    class Meta:
        db_table = "password_reset_tokens"

    def __str__(self):
        return self.user.email
