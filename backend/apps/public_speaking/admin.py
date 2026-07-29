from django.contrib import admin

from .models import PublicSpeaking, PublicSpeakingMessage, PublicSpeakingParticipant


@admin.register(PublicSpeaking)
class PublicSpeakingAdmin(admin.ModelAdmin):
    """The only place a discussion is created or edited — never from the API."""

    list_display = ("title", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("title", "topic")


@admin.register(PublicSpeakingParticipant)
class PublicSpeakingParticipantAdmin(admin.ModelAdmin):
    list_display = ("display_name", "discussion", "created_at")
    # session_token is deliberately absent: it is a live credential.
    fields = ("discussion", "anonymous_name")
    readonly_fields = fields


@admin.register(PublicSpeakingMessage)
class PublicSpeakingMessageAdmin(admin.ModelAdmin):
    list_display = ("participant", "content", "created_at")
    search_fields = ("content",)
