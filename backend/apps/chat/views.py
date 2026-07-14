from rest_framework.views import APIView
from core.responses import success_response,error_response
from rest_framework.permissions import IsAuthenticated
from .services import end_private_chat_room,get_private_chat_room
from .serializers import EndChatSerializer

class StartChatAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return success_response(
            message="Waitig for another user"
        )
    
class EndChatAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = EndChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        room = get_private_chat_room(
            serializer.validated_data["room_id"]
        )

        end_private_chat_room(room)

        return success_response(
            message="Chat ended successfully"
        )