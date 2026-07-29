from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from core.pagination import DefaultPagination
from core.responses import error_response, success_response

from . import services
from .serializers import (
    JoinDiscussionSerializer,
    PublicSpeakingMessageSerializer,
    PublicSpeakingSerializer,
)

# The header a joined browser sends back on every request.
SESSION_HEADER = "HTTP_X_SPEAKING_SESSION"

# Persistent identity cookie, set by the backend on join. HttpOnly (JS cannot
# read it) and long-lived, so the same browser is the same participant across
# refreshes, new tabs and restarts. The client-held header remains the primary
# channel — Safari refuses third-party cookies entirely, so a deployment with
# the frontend and backend on different domains still works through the header
# while the cookie covers everything else.
PARTICIPANT_COOKIE = "anonymous_participant_id"

PARTICIPANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # one week — outlives the event


def _session_token(request):
    """Header first (explicit), cookie second (persistent). Never the IP."""
    return (
        request.META.get(SESSION_HEADER, "").strip()
        or request.COOKIES.get(PARTICIPANT_COOKIE, "").strip()
    )


def _attach_participant_cookie(response, token):
    """
    Pin this browser to its participant identity.

    SameSite must be "None" in production: the frontend and the API are served
    from different domains there, and a Lax cookie is simply NOT sent on
    cross-site XHR — the browser would arrive with no identity and be handed a
    brand new participant, which is exactly the duplicate-vote/duplicate-post
    bug. "None" requires Secure, so local http development keeps Lax (where
    localhost:5173 -> localhost:8000 is same-site anyway).
    """
    cross_site = not settings.DEBUG

    response.set_cookie(
        PARTICIPANT_COOKIE,
        token,
        max_age=PARTICIPANT_COOKIE_MAX_AGE,
        httponly=True,
        samesite="None" if cross_site else "Lax",
        secure=cross_site,
    )
    return response


class JoinThrottle(AnonRateThrottle):
    scope = "public_speaking_join"


class ReadThrottle(AnonRateThrottle):
    scope = "public_speaking"


class PublicSpeakingDetailAPIView(APIView):
    """
    The live discussion and its topic.

    AllowAny is deliberate and is the only unauthenticated read surface in the
    project. It exposes a title, a topic string and a flag — no user data, no
    events, no complaints. These URLs are not registered at all unless
    PUBLIC_SPEAKING_MODE is on.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
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
    Hand this browser an anonymous identity.

    Sending back a token you already hold returns the same identity, which is
    what makes refreshing and rejoining keep your name.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [JoinThrottle]

    def post(self, request):
        discussion = services.get_active_discussion()

        if discussion is None:
            return error_response(
                message="No discussion is running right now.", status_code=404
            )

        serializer = JoinDiscussionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        participant, token = services.join_discussion(
            discussion=discussion,
            # Body token from the client's own storage, else the identity the
            # cookie already pins this browser to.
            session_token=serializer.validated_data.get("session_token")
            or _session_token(request)
            or None,
        )

        response = success_response(
            data={
                "session_token": token,
                "display_name": participant.display_name,
                # The server decides whether this participant may still post.
                # A refresh re-reads this, so the composer's disabled state
                # survives reloads instead of living in client memory.
                "has_posted": services.has_posted(participant=participant),
            },
            message="Joined the discussion.",
        )
        return _attach_participant_cookie(response, token)


class PublicSpeakingStateAPIView(APIView):
    """
    This browser's participation state, resolved on page load.

    The frontend renders the composer from this, so a participant who has
    already posted never sees an input they cannot use. Deliberately does NOT
    create a participant — merely opening the page must not consume an
    anonymous name — so `joined` is false until the visitor actually joins.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ReadThrottle]

    def get(self, request):
        discussion = services.get_active_discussion()

        if discussion is None:
            return error_response(
                message="No discussion is running right now.", status_code=404
            )

        participant = services.get_participant(
            discussion=discussion, session_token=_session_token(request)
        )

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
    """
    Message history, ranked most-upvoted first.

    Works without a session token — the room is readable before you join, you
    just get no `has_upvoted` flags.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ReadThrottle]

    def get(self, request):
        discussion = services.get_active_discussion()

        if discussion is None:
            return error_response(
                message="No discussion is running right now.", status_code=404
            )

        participant = services.get_participant(
            discussion=discussion, session_token=_session_token(request)
        )

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
