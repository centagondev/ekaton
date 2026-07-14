from django.contrib import admin

from .models import AccountSetupToken


@admin.register(AccountSetupToken)
class AccountSetupTokenAdmin(admin.ModelAdmin):
    """Admin configuration for the AccountSetupToken model.

    Displays token status, expiry, and creation time for each record
    to assist with debugging account activation and password reset issues.
    """

    list_display = (
        "user",
        "used",
        "expires_at",
        "created_at",
    )
