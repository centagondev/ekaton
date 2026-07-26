# pyrefly: ignore [missing-import]
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.users.serializers import UserSerializer
from core.responses import error_response, success_response
from core.throttles import (
    ChangePasswordRateThrottle,
    CheckEmailRateThrottle,
    ForgetPasswordRateThrottle,
    LoginRateThrottle,
    LogoutRateThrottle,
    ResendPasswordResetRateThrottle,
    ResetPasswordRateThrottle,
    SetPasswordRateThrottle,
)

from .docs import (
    change_password_doc,
    check_email_doc,
    forget_password_doc,
    login_doc,
    logout_doc,
    me_doc,
    resend_password_reset_doc,
    reset_password_doc,
    set_password_doc,
)
from .serializers import (
    ChangePasswordSerializer,
    CheckEmailSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    ResendPasswordResetSerializer,
    ResetPasswordSerializer,
    SetPasswordSerializer,
)
from .services import (
    change_password,
    generate_account_setup_token,
    get_email_status,
    get_valid_account_setup_token,
    get_valid_password_reset_token,
    login_user,
    logout_user,
    request_password_reset,
    reset_password,
    send_account_setup_email,
    set_password,
)


class CheckEmailAPIView(APIView):
    """API endpoint to check if an email exists and its verification status."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [CheckEmailRateThrottle]

    @check_email_doc
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
            account_setup_token = generate_account_setup_token(email_status.get("user"))
            send_account_setup_email(
                account_setup_token,
            )
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

    @set_password_doc
    def post(self, request):
        """Handles the POST request to set the user's password."""
        serializer = SetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        account_setup_token = get_valid_account_setup_token(
            token=serializer.validated_data["token"]
        )

        set_password(
            account_setup_token=account_setup_token,
            password=serializer.validated_data["password"],
        )

        return success_response(message="Your password has been set successfully.")


class LoginAPIView(APIView):
    """API endpoint to authenticate a user and return JWT tokens."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    @login_doc
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

    @logout_doc
    def post(self, request):
        """Handles the POST request to invalidate the provided refresh token."""
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        logout_user(refresh_token=serializer.validated_data["refresh"])

        return success_response(message="Logged out successfully")


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


class ForgetPasswordAPIView(APIView):
    """API endpoint for requesting a password reset link."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [ForgetPasswordRateThrottle]

    @forget_password_doc
    def post(self, request):
        """Handle password reset requests."""
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        request_password_reset(email=serializer.validated_data["email"])

        return success_response(
            message="If the email is registered, a password reset link has been sent."
        )


class ResetPasswordAPIView(APIView):
    """API endpoint to reset a user's password using a valid password reset token."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [ResetPasswordRateThrottle]

    @reset_password_doc
    def post(self, request):
        """Handle password reset requests."""

        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        password_reset_token = get_valid_password_reset_token(
            token=serializer.validated_data["token"],
        )
        reset_password(
            password_reset_token=password_reset_token,
            password=serializer.validated_data["password"],
        )

        return success_response(message="Your password has been reset successfully.")


class ResendPasswordResetAPIView(APIView):
    """API endpoint to resend a password reset email."""

    permission_classes = []
    authentication_classes = []
    throttle_classes = [ResendPasswordResetRateThrottle]

    @resend_password_reset_doc
    def post(self, request):
        """Handle password reset email resend requests."""
        serializer = ResendPasswordResetSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        request_password_reset(email=serializer.validated_data["email"])

        return success_response(
            message="If the email is registered, a password reset link has been sent."
        )


class ChangePasswordAPIView(APIView):
    """API endpoint for changing the authenticated user's password."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ChangePasswordRateThrottle]

    @change_password_doc
    def post(self, request):
        """Handle password change requests."""
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = change_password(
            user=request.user,
            current_password=serializer.validated_data["current_password"],
            new_password=serializer.validated_data["new_password"],
        )

        return success_response(
            message="Your password has been changed successfully.",
            data={
                "access": result["access"],
                "refresh": result["refresh"],
            },
        )
