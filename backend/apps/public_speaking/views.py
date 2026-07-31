from core.pagination import DefaultPagination
from core.responses import error_response, success_response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from . import services
from .serializers import PublicSpeakingMessageSerializer, PublicSpeakingSerializer


class JoinThrottle(UserRateThrottle):
    scope = "public_speaking_join"


class ReadThrottle(UserRateThrottle):
    scope = "public_speaking"


class PublicSpeakingDetailAPIView(APIView):
    """The live discussion and its topic."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ReadThrottle]

    def get(self, request):
        discussion = services.get_active_discussion()

        if discussion is None:
            return error_response(
                message="No discussion is running right now.", status_code=404
            )

        return success_response(data=PublicSpeakingSerializer(discussion).data)


class JoinDiscussionAPIView(APIView):
    """
    Hand this account its anonymous identity for the discussion.

    Identity is the authenticated account (`request.user`), not anything the
    browser holds — joining again, from any browser, tab or incognito window,
    returns the same identity rather than minting a new one.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [JoinThrottle]

    def post(self, request):
        discussion = services.get_active_discussion()

        if discussion is None:
            return error_response(
                message="No discussion is running right now.", status_code=404
            )

        participant = services.join_discussion(discussion=discussion, user=request.user)

        return success_response(
            data={
                "display_name": participant.display_name,
                # The server decides whether this account may still post. A
                # refresh re-reads this, so the composer's disabled state
                # survives reloads instead of living in client memory.
                "has_posted": services.has_posted(participant=participant),
            },
            message="Joined the discussion.",
        )


class PublicSpeakingStateAPIView(APIView):
    """
    This account's participation state, resolved on page load.

    The frontend renders the composer from this, so an account that has
    already posted never sees an input it cannot use. Deliberately does NOT
    create a participant — merely opening the page must not consume an
    anonymous name — so `joined` is false until the account actually joins.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ReadThrottle]

    def get(self, request):
        discussion = services.get_active_discussion()

        if discussion is None:
            return error_response(
                message="No discussion is running right now.", status_code=404
            )

        participant = services.get_participant(discussion=discussion, user=request.user)

        if participant is None:
            return success_response(
                data={
                    "joined": False,
                    "display_name": None,
                    "already_posted": False,
                }
            )

        return success_response(
            data={
                "joined": True,
                "display_name": participant.display_name,
                "already_posted": services.has_posted(participant=participant),
            }
        )


class PublicSpeakingMessagesAPIView(APIView):
    """Message history, ranked most-upvoted first."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ReadThrottle]

    def get(self, request):
        discussion = services.get_active_discussion()

        if discussion is None:
            return error_response(
                message="No discussion is running right now.", status_code=404
            )

        participant = services.get_participant(discussion=discussion, user=request.user)

        queryset = services.messages_queryset(
            discussion=discussion, participant=participant
        )

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)

        return success_response(
            data=paginator.get_paginated_response(
                PublicSpeakingMessageSerializer(page, many=True).data
            )
        )
