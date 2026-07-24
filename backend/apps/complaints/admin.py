from django.contrib import admin

from .models import Complaint, ComplaintComment, ComplaintUpvote


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "user",
        "category",
        "status",
        "is_anonymous",
        "created_at",
    )
    list_filter = ("status", "category", "is_anonymous", "created_at")
    search_fields = ("title", "description", "user__full_name", "user__email")
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(ComplaintComment)
class ComplaintCommentAdmin(admin.ModelAdmin):
    list_display = ("complaint", "user", "is_anonymous", "created_at")
    list_filter = ("is_anonymous", "created_at")
    search_fields = ("comment", "complaint__title", "user__full_name", "user__email")
    autocomplete_fields = ("complaint", "user")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)


@admin.register(ComplaintUpvote)
class ComplaintUpvoteAdmin(admin.ModelAdmin):
    list_display = ("complaint", "user", "created_at")
    search_fields = ("complaint__title", "user__full_name", "user__email")
    autocomplete_fields = ("complaint", "user")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)
