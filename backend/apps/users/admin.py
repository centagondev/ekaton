from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """Admin configuration for the custom User model.

    Extends Django's built-in UserAdmin to support email-based
    authentication and expose custom fields such as batch, gender,
    profile photo, and verification status.
    """

    model = User

    list_display = ("email", "full_name", "is_staff", "is_active", "is_verified")

    ordering = ("email",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Personal Info",
            {"fields": ("full_name", "batch", "gender", "profile_photo")},
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_verified",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "full_name",
                    "password1",
                    "password2",
                ),
            },
        ),
    )

    search_fields = ("email",)
