from django.contrib import admin

from .models import AnonymousName, Event, EventParticipant


@admin.register(AnonymousName)
class AnonymousNameAdmin(admin.ModelAdmin):
    """
    Admin configuration for the AnonymousName model.

    Provides management for predefined anonymous display names
    used in anonymous event chats.
    """

    list_display = (
        "display_name",
        "created_at",
        "updated_at",
    )

    search_fields = ("display_name",)

    ordering = ("display_name",)

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Event model.

    Provides filtering, searching, and management of events
    created by users.
    """

    list_display = (
        "name",
        "owner",
        "status",
        "is_anonymous_chat",
        "anonymous_seed",
        "anonymous_counter",
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
        "anonymous_seed",
        "anonymous_counter",
        "created_at",
        "updated_at",
    )


@admin.register(EventParticipant)
class EventParticipantAdmin(admin.ModelAdmin):
    """
    Admin configuration for the EventParticipant model.

    Provides management of event participants,
    anonymous identity assignments, and participation history.
    """

    list_display = (
        "user",
        "event",
        "anonymous_name",
        "is_active",
        "joined_at",
        "left_at",
    )

    list_filter = (
        "is_active",
        "event",
    )

    search_fields = (
        "user__full_name",
        "user__email",
        "event__name",
        "anonymous_name__display_name",
    )

    autocomplete_fields = (
        "user",
        "event",
        "anonymous_name",
    )

    ordering = ("-joined_at",)

    readonly_fields = (
        "joined_at",
        "left_at",
        "created_at",
        "updated_at",
    )
