from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from core.responses import error_response, success_response
from core.throttles import (
    CancelChatSearchRateThrottle,
    ChatEndRateThrottle,
    ReportRateThrottle,
    StartChatRateThrottle,
)
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from .docs import cancel_chat_search_doc, end_chat_doc, report_doc, start_chat_doc
from .matchmaking import release_unjoined_room, remove_user_from_queue, start_chat
from .serializers import EndChatSerializer, ReportSerializer
from .services import (
    create_report,
    discard_report_evidence,
    end_private_chat_room,
    get_private_chat_room,
    upload_report_evidence,
)


class StartChatAPIView(APIView):
    """Handle a request to start an anonymous chat session.

    Invokes the matchmaking flow for the authenticated user. The response
    status indicates whether the user has been matched, is already in an
    active room, or has been placed in the waiting queue.

    Allowed methods: POST
    Authentication: Required (JWT)
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [StartChatRateThrottle]

    @start_chat_doc
    def post(self, request):
        """Trigger the matchmaking flow for the current user.

        Args:
            request: The incoming HTTP request. No body parameters required.

        Returns:
            A success response containing the matchmaking result dict with
            `status`, `message`, and optionally `room_id`.
        """
        result = start_chat(request.user)
        return success_response(message=result["message"], data=result)


class CancelChatSearchAPIView(APIView):
    """Handle a request to leave the anonymous chat waiting queue.

    The counterpart to the enqueue that ``start_chat`` performs when no partner
    was available. Matchmaking itself is untouched: this only releases the
    caller's own slot so an absent user cannot be handed to somebody who is
    present. Without it a queue entry lingers until its liveness marker expires,
    a window long enough for a partner to be matched into a room nobody is
    sitting in.

    Allowed methods: POST
    Authentication: Required (JWT)
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [CancelChatSearchRateThrottle]

    @cancel_chat_search_doc
    def post(self, request):
        """Drop the current user's waiting-queue entry.

        Idempotent: a user who is not queued (never was, or was claimed a
        moment ago) is simply left alone.

        "Claimed a moment ago" is the case that matters. The claim already
        created a room, and this caller is not going to open it, so the room is
        released here as well and its other participant is told at once instead
        of being left to stare at a chat nobody joins. A conversation the caller
        is actually sitting in is never affected — see ``release_unjoined_room``.

        Args:
            request: The incoming HTTP request. No body parameters required.

        Returns:
            A success response.
        """
        remove_user_from_queue(request.user)

        room = release_unjoined_room(request.user)

        if room is not None:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"chat_{room.id}",
                {
                    "type": "chat_ended",
                },
            )

        return success_response(message="Search cancelled.")


class EndChatAPIView(APIView):
    """Handle a request to end an active private chat session.

    Validates that the given room exists and belongs to the authenticated user
    before marking it as ended. Returns a 404 if the room is not found or the
    user is not a participant.

    Allowed methods: POST
    Authentication: Required (JWT)
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ChatEndRateThrottle]

    @end_chat_doc
    def post(self, request):
        """End a specific active chat room for the current user.

        Args:
            request: The incoming HTTP request. Expected body:
                - room_id (str): The UUID of the chat room to end.

        Returns:
            A success response on successful termination, or a 404 error
            response if the room is not found or access is denied.
        """
        serializer = EndChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        room = get_private_chat_room(
            serializer.validated_data["room_id"],
            request.user,
        )

        if room is None:
            return error_response(
                message="Chat room not found.",
                status_code=404,
            )

        end_private_chat_room(room)

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{room.id}",
            {
                "type": "chat_ended",
            },
        )

        return success_response(message="Chat ended successfully.")


class ReportAPIView(APIView):
    """Handle a moderation report filed against an anonymous chat partner.

    Accepts JSON as before, and now multipart as well so the reporter can
    attach a screenshot. The file is uploaded to Cloudinary and only its URL is
    persisted — no evidence is ever written to local storage.
    """

    throttle_classes = [ReportRateThrottle]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @report_doc
    def post(self, request):
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        room = get_private_chat_room(
            serializer.validated_data["room_id"], user=request.user
        )

        if room is None:
            return error_response(message="Chat room not found", status_code=404)

        evidence_url = serializer.validated_data.get("evidence_url")
        evidence_image = serializer.validated_data.get("evidence_image")

        # Ordered after the room check so a report that cannot be filed never
        # costs an upload in the first place.
        upload = None
        if evidence_image is not None:
            upload = upload_report_evidence(evidence_image)
            evidence_url = upload["url"]

        try:
            create_report(
                room=room,
                reporter=request.user,
                reason=serializer.validated_data["reason"],
                description=serializer.validated_data.get("description"),
                evidence_url=evidence_url,
            )
        except Exception:
            # A duplicate pending report (or any other rejection) must not
            # strand the image we just pushed to Cloudinary.
            discard_report_evidence(upload)
            raise

        return success_response(message="Report submitted successfully")
