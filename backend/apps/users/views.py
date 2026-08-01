# Create your views here.
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.accounts.docs import me_doc
from core.responses import success_response
from .serializers import UserSerializer
class MeAPIView(APIView):
    """API endpoint to retrieve the authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    @me_doc
    def get(self, request):
        """Handle GET request for the current user's profile."""

        return success_response(
            message="Profile retrieved successfully.",
            data=UserSerializer(request.user).data,
        )