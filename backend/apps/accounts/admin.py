from django.contrib import admin

from .models import AccountSetupToken, PasswordResetToken


@admin.register(AccountSetupToken)
class AccountSetupTokenAdmin(admin.ModelAdmin):
    """Admin configuration for the AccountSetupToken model.

    Displays token status, expiration, and creation details for each record
    to assist administrators with inspecting and debugging account setup tokens.
    """

    list_display = (
        "user",
        "used",
        "expires_at",
        "created_at",
    )


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    """Admin configuration for password reset tokens."""

    list_display = (
        "user",
        "used",
        "expires_at",
        "created_at",
    )
