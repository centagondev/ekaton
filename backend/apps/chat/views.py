from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.responses import error_response, success_response
from core.throttles import ReportRateThrottle, StartChatRateThrottle

from .docs import end_chat_doc, report_doc, start_chat_doc
from .matchmaking import start_chat
from .serializers import EndChatSerializer, ReportSerializer
from .services import create_report, end_private_chat_room, get_private_chat_room


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


class EndChatAPIView(APIView):
    """Handle a request to end an active private chat session.

    Validates that the given room exists and belongs to the authenticated user
    before marking it as ended. Returns a 404 if the room is not found or the
    user is not a participant.

    Allowed methods: POST
    Authentication: Required (JWT)
    """

    permission_classes = [IsAuthenticated]

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
    throttle_classes = [ReportRateThrottle]
    permission_classes = [IsAuthenticated]

    @report_doc
    def post(self, request):
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        room = get_private_chat_room(
            serializer.validated_data["room_id"], user=request.user
        )

        if room is None:
            return error_response(message="Chat room not found", status_code=404)

        create_report(
            room=room,
            reporter=request.user,
            reason=serializer.validated_data["reason"],
            description=serializer.validated_data.get("description"),
            evidence_url=serializer.validated_data.get("evidence_url"),
        )

        return success_response(message="Report submitted successfully")
