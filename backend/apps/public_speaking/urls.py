from django.urls import path

from .admin_views import (
    AdminPublicSpeakingMessageDetailAPIView,
    AdminPublicSpeakingMessagesAPIView,
)
from .views import (
    JoinDiscussionAPIView,
    PublicSpeakingDetailAPIView,
    PublicSpeakingMessagesAPIView,
    PublicSpeakingStateAPIView,
)

# Registered by config/urls.py ONLY when settings.PUBLIC_SPEAKING_MODE is on.
# With the flag off none of these paths resolve, so the demo surface returns
# 404 exactly as if the feature had never been written.
urlpatterns = [
    path("", PublicSpeakingDetailAPIView.as_view(), name="public_speaking_detail"),
    path("join/", JoinDiscussionAPIView.as_view(), name="public_speaking_join"),
    # Page-load state: has this browser already posted?
    path("state/", PublicSpeakingStateAPIView.as_view(), name="public_speaking_state"),
    path(
        "messages/",
        PublicSpeakingMessagesAPIView.as_view(),
        name="public_speaking_messages",
    ),
    # Moderation — gated by the project's existing IsAdminUser permission.
    path(
        "admin/messages/",
        AdminPublicSpeakingMessagesAPIView.as_view(),
        name="public_speaking_admin_messages",
    ),
    path(
        "admin/messages/<uuid:message_id>/",
        AdminPublicSpeakingMessageDetailAPIView.as_view(),
        name="public_speaking_admin_message_detail",
    ),
]
