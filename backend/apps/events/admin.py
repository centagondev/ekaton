from django.contrib import admin

from .models import Event, EventParticipant


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Event model.
    """

    list_display = (
        "name",
        "owner",
        "status",
        "is_anonymous_chat",
        "end_time",
        "created_at",
    )

    list_filter = (
        "status",
        "is_anonymous_chat",
        "banner",
    )

    search_fields = (
        "name",
        "owner__full_name",
        "owner__email",
        "venue",
    )

    autocomplete_fields = ("owner",)

    ordering = ("-created_at",)

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(EventParticipant)
class EventParticipantAdmin(admin.ModelAdmin):
    """
    Admin configuration for the EventParticipant model.
    """

    list_display = (
        "user",
        "event",
        "anonymous_name",
        "is_active",
        "joined_at",
        "left_at",
    )

    list_filter = ("is_active",)

    search_fields = (
        "user__full_name",
        "user__email",
        "event__name",
        "anonymous_name",
    )

    autocomplete_fields = (
        "user",
        "event",
    )

    ordering = ("-joined_at",)

    readonly_fields = (
        "joined_at",
        "left_at",
        "created_at",
        "updated_at",
    )
