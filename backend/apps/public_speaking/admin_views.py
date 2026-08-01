import logging

from core.pagination import DefaultPagination
from core.responses import error_response, success_response
from django.db.models import Q
from rest_framework.permissions import IsAdminUser
from rest_framework.views import APIView

from . import services
from .models import PublicSpeakingMessage
from .serializers import AdminPublicSpeakingMessageSerializer

logger = logging.getLogger("public_speaking")

# Sort keys accepted by the moderation list. "votes" reuses the ranking the
# room itself uses, so a moderator sees the same order the audience does.
SORT_NEWEST = "newest"
SORT_VOTES = "votes"


class AdminPublicSpeakingMessagesAPIView(APIView):
    """
    Moderation list for the live discussion.

    Reuses the project's existing admin authentication wholesale: IsAdminUser
    checks `is_staff` on the JWT-authenticated user, exactly as every other
    endpoint in apps.administration does. No new auth, no new permission class,
    no new roles.
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        discussion = services.get_active_discussion()

        if discussion is None:
            return error_response(
                message="No discussion is running right now.", status_code=404
            )

        # participant=None: a moderator has no anonymous identity, so the
        # has_upvoted / is_own annotations correctly stay False. The extra
        # select_related feeds the admin serializer's real_name without a
        # per-row query.
        queryset = services.messages_queryset(discussion=discussion).select_related(
            "participant__user"
        )

        search = (request.query_params.get("search") or "").strip()
        if search:
            # Message text or the anonymous display name — a moderator who has
            # spotted one bad response usually wants the rest from that name.
            queryset = queryset.filter(
                Q(content__icontains=search)
                | Q(participant__anonymous_name__display_name__icontains=search)
            )

        # messages_queryset already orders by votes then recency; newest-first
        # is the moderation default because moderators chase what just arrived.
        if request.query_params.get("sort") != SORT_VOTES:
            queryset = queryset.order_by("-created_at")

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)

        return success_response(
            message="Exclusive messages fetched successfully",
            data=paginator.get_paginated_response(
                AdminPublicSpeakingMessageSerializer(page, many=True).data
            ),
        )


class AdminPublicSpeakingMessageDetailAPIView(APIView):
    """Delete a single message from the live discussion."""

    permission_classes = [IsAdminUser]

    def delete(self, request, message_id):
        message = PublicSpeakingMessage.objects.filter(id=message_id).first()

        if message is None:
            return error_response(message="Message not found.", status_code=404)

        # Votes are removed with it by the FK cascade, so no total can survive
        # its message and no count is left pointing at a deleted row.
        message.delete()

        logger.info(
            "Admin %s deleted public speaking message %s", request.user.id, message_id
        )

        return success_response(message="Message deleted successfully")
