from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.users.serializers import UserSerializer
from core.responses import error_response, success_response
from core.throttles import (
    CheckEmailRateThrottle,
    LoginRateThrottle,
    LogoutRateThrottle,
    SetPasswordRateThrottle,
)

from .serializers import (
    CheckEmailSerializer,
    LoginSerializer,
    LogoutSerializer,
    SetPasswordSerializer,
)
from .services import (
    generate_password_reset_token,
    get_email_status,
    get_valid_password_reset_token,
    login_user,
    logout_user,
    send_password_setup_link,
    set_password,
)


class CheckEmailAPIView(APIView):
    """API endpoint to check if an email exists and its verification status."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [CheckEmailRateThrottle]

    def post(self, request):
        """Handles the POST request to check email status."""
        serializer = CheckEmailSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        email_status = get_email_status(email=serializer.validated_data["email"])

        if email_status is None:
            return success_response(
                message="If the email address is registered and unverified, a password setup link has been sent.",
                data={"is_verified": False},
            )

        if not email_status.get("is_verified"):
            password_reset_token = generate_password_reset_token(
                email_status.get("user")
            )
            send_password_setup_link(password_reset_token)
            return success_response(
                message="If the email address is registered and unverified, a password setup link has been sent.",
                data={"is_verified": False},
            )

        return success_response(
            message="Account is verified.", data={"is_verified": True}
        )


class SetPasswordAPIView(APIView):
    """API endpoint to set a password for an unverified account."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [SetPasswordRateThrottle]

    def post(self, request):
        """Handles the POST request to set the user's password."""
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        password_reset_token = get_valid_password_reset_token(
            token=serializer.validated_data["token"]
        )

        set_password(
            password_reset_token=password_reset_token,
            password=serializer.validated_data["password"],
        )

        return success_response(message="Your password has been set successfully.")


class LoginAPIView(APIView):
    """API endpoint to authenticate a user and return JWT tokens."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        """Handles the POST request for user login."""
        serializer = LoginSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        try:
            result = login_user(
                request=request,
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
            )
        except AuthenticationFailed as e:
            return error_response(
                message=str(e.detail) if hasattr(e, "detail") else str(e),
                status_code=401,
            )

        user = result["user"]

        return success_response(
            message="Login successful.",
            data={
                "access": result["access"],
                "refresh": result["refresh"],
                "user": UserSerializer(user).data,
            },
        )


class LogoutAPIView(APIView):
    """API endpoint to log out an authenticated user by blacklisting their refresh token."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [LogoutRateThrottle]

    def post(self, request):
        """Handles the POST request to invalidate the provided refresh token."""
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        logout_user(refresh_token=serializer.validated_data["refresh"])

        return success_response(message="Logged out successfully")


class MeAPIView(APIView):
    """API endpoint to retrieve the authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Handle GET request for the current user's profile."""

        return success_response(
            message="Profile retrieved successfully.",
            data=UserSerializer(request.user).data,
        )
