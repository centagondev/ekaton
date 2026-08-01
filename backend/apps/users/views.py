# Create your views here.
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.accounts.docs import me_doc
from core.responses import success_response
from .serializers import UserSerializer,UpdateProfileSerializer
from .services import remove_profile_photo, update_profile_photo
from rest_framework.parsers import MultiPartParser,FormParser

class MeAPIView(APIView):
    """API endpoint to retrieve the authenticated user's profile."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @me_doc
    def get(self, request):
        """Handle GET request for the current user's profile."""

        return success_response(
            message="Profile retrieved successfully.",
            data=UserSerializer(request.user).data,
        )

    def patch(self, request):

        serializer = UpdateProfileSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        update_profile_photo(
            user=request.user,
            profile_photo=serializer.validated_data["profile_photo"]
        )

        return success_response(
            message="User profile updated successfully",
            data=UserSerializer(request.user).data
        )


class MeProfilePhotoAPIView(APIView):
    """Removal of the authenticated user's profile photo.

    Its own route rather than a `delete` on MeAPIView: DELETE /users/me/ reads
    as "delete my account", and this endpoint clears one field.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request):

        remove_profile_photo(user=request.user)

        return success_response(
            message="Profile photo removed successfully",
            data=UserSerializer(request.user).data
        )

        