"""
API Documentation Schemas — Accounts App.

This module contains all drf-spectacular ``extend_schema`` decorator instances
for the ``apps/accounts`` API endpoints.

Architecture
------------
These schema objects are pure documentation metadata. They have absolutely zero
effect on runtime behaviour, authentication, validation, or business logic.
They are applied as decorators inside ``views.py`` to keep ``views.py`` clean
and focused exclusively on HTTP request handling.

Usage
-----
Import the required schema decorator into ``views.py`` and apply it directly
above the HTTP method::

    from .docs import login_doc

    class LoginAPIView(APIView):
        @login_doc
        def post(self, request):
            ...

Maintenance
-----------
- Add new schema objects here when a new endpoint is created.
- Update the relevant schema object here when an endpoint contract changes
  (e.g. new request field, new response status code, changed description).
- Do NOT modify business logic, serializers, or views here.

Exports
-------
- ``check_email_doc``          → CheckEmailAPIView.post
- ``set_password_doc``         → SetPasswordAPIView.post
- ``login_doc``                → LoginAPIView.post
- ``logout_doc``               → LogoutAPIView.post
- ``me_doc``                   → MeAPIView.get
- ``forget_password_doc``      → ForgetPasswordAPIView.post
- ``reset_password_doc``       → ResetPasswordAPIView.post
- ``resend_password_reset_doc``→ ResendPasswordResetAPIView.post
- ``change_password_doc``      → ChangePasswordAPIView.post
"""

from drf_spectacular.utils import (OpenApiExample, OpenApiResponse,
                                   extend_schema, inline_serializer)
from rest_framework import serializers as rf_serializers

from apps.users.serializers import UserSerializer

from .serializers import (ChangePasswordSerializer, CheckEmailSerializer,
                          ForgotPasswordSerializer, LoginSerializer,
                          LogoutSerializer, ResendPasswordResetSerializer,
                          ResetPasswordSerializer, SetPasswordSerializer)

# ---------------------------------------------------------------------------
# Check Email
# Endpoint : POST /accounts/check-email/

check_email_doc = extend_schema(
    tags=["Authentication"],
    summary="Check Email",
    description="""
    Check if an email exists and its verification status.

    **Purpose**: Determines the next step in the auth flow (login vs setup).
    **When frontend should call it**: First step of authentication.
    **Authentication requirement**: Public.
    **Security behaviour**: Rate limited to 5 requests/minute. Does not enumerate emails explicitly.

    ### Request Fields
    * `email`: The user's registered email address.
    """,
    request=CheckEmailSerializer,
    responses={
        # 200: Returns whether the email is verified or not.
        200: OpenApiResponse(
            response=inline_serializer(
                name="CheckEmailResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        "CheckEmailData",
                        fields={"is_verified": rf_serializers.BooleanField()},
                    ),
                },
            ),
            description="Email status retrieved successfully.",
            examples=[
                OpenApiExample(
                    "Verified",
                    value={
                        "message": "Account is verified.",
                        "data": {"is_verified": True},
                    },
                ),
                OpenApiExample(
                    "Unverified",
                    value={
                        "message": "If the email address is registered and unverified, a password setup link has been sent.",
                        "data": {"is_verified": False},
                    },
                ),
            ],
        ),
        # 400: Returned when the email field fails basic format validation.
        400: OpenApiResponse(description="Bad Request - Invalid email format."),
        # 429: Returned when the client exceeds 5 requests per minute.
        429: OpenApiResponse(
            description="Too Many Requests - 5 requests/minute limit exceeded."
        ),
    },
)


# ---------------------------------------------------------------------------
# Set Password
# Endpoint : POST /accounts/set-password/

set_password_doc = extend_schema(
    tags=["Authentication"],
    summary="Set Password",
    description="""
    Set a password for an unverified account using a secure token.

    **Purpose**: Allows a new user to set their password after receiving a setup link.
    **When frontend should call it**: When the user submits the password setup form.
    **Authentication requirement**: Public.
    **Security behaviour**: Single-use token. Token expiration (30 mins). Password validation. Rate limited to 10 requests/hour.

    ### Request Fields
    * `token`: Single-use secure token generated by the backend and sent via email.
    * `password`: The user's new password.
    * `confirm_password`: Must match the new password.
    """,
    request=SetPasswordSerializer,
    responses={
        # 200: Password was successfully set and the account is now verified.
        200: OpenApiResponse(
            response=inline_serializer(
                "SetPasswordResponse",
                fields={"message": rf_serializers.CharField()},
            ),
            description="Password set successfully.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={"message": "Your password has been set successfully."},
                )
            ],
        ),
        # 400: Returned for an expired/invalid token or a password mismatch.
        400: OpenApiResponse(
            description="Bad Request - Invalid token or password mismatch/validation failure."
        ),
        # 429: Returned when the client exceeds 10 requests per hour.
        429: OpenApiResponse(
            description="Too Many Requests - 10 requests/hour limit exceeded."
        ),
    },
)


# ---------------------------------------------------------------------------
# Login
# Endpoint : POST /accounts/login/

login_doc = extend_schema(
    tags=["Authentication"],
    summary="Login",
    description="""
    Authenticate a user and return JWT tokens.

    **Purpose**: Allows existing, verified users to log into the application.
    **When frontend should call it**: Upon submission of the login form.
    **Authentication requirement**: Public.
    **Security behaviour**: No password logging. Passwords are hashed. Generic error responses for invalid credentials. Rate limited to 5 requests/minute.

    ### Request Fields
    * `email`: The user's registered email address.
    * `password`: The user's password.
    """,
    request=LoginSerializer,
    responses={
        # 200: Returns both JWT tokens and the authenticated user's profile.
        200: OpenApiResponse(
            response=inline_serializer(
                name="LoginResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="LoginData",
                        fields={
                            "access": rf_serializers.CharField(),  # Short-lived JWT access token.
                            "refresh": rf_serializers.CharField(),  # Long-lived JWT refresh token.
                            "user": UserSerializer(),  # Authenticated user's profile data.
                        },
                    ),
                },
            ),
            description="Login successful.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "Login successful.",
                        "data": {
                            "access": "eyJhb...",
                            "refresh": "eyJhb...",
                            "user": {
                                "email": "user@example.com",
                                "full_name": "John Doe",
                            },
                        },
                    },
                )
            ],
        ),
        # 400: Returned when required fields (email/password) are missing entirely.
        400: OpenApiResponse(description="Bad Request - Missing fields."),
        # 401: Returned for wrong password, unverified account, or inactive account.
        401: OpenApiResponse(
            description="Unauthorized - Incorrect credentials, unverified, or inactive account."
        ),
        # 429: Returned when the client exceeds 5 requests per minute.
        429: OpenApiResponse(
            description="Too Many Requests - 5 requests/minute limit exceeded."
        ),
    },
)


# ---------------------------------------------------------------------------
# Logout
# Endpoint : POST /accounts/logout/

logout_doc = extend_schema(
    tags=["Authentication"],
    summary="Logout",
    description="""
    Log out an authenticated user by blacklisting their refresh token.

    **Purpose**: Safely ends the user's session on the current device.
    **When frontend should call it**: When the user clicks log out.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Blacklists the refresh token preventing reuse. Rate limited to 20 requests/hour.

    ### Request Fields
    * `refresh`: The user's current refresh token to be blacklisted.
    """,
    request=LogoutSerializer,
    responses={
        # 200: The refresh token has been blacklisted. Session is now invalid.
        200: OpenApiResponse(
            response=inline_serializer(
                "LogoutResponse",
                fields={"message": rf_serializers.CharField()},
            ),
            description="Logged out successfully.",
            examples=[
                OpenApiExample("Success", value={"message": "Logged out successfully"})
            ],
        ),
        # 400: Returned when the provided refresh token is already expired or invalid.
        400: OpenApiResponse(
            description="Bad Request - Invalid or expired refresh token."
        ),
        # 401: Returned when the request has no valid access token in the Authorization header.
        401: OpenApiResponse(
            description="Unauthorized - Missing or invalid access token."
        ),
        # 429: Returned when the client exceeds 20 requests per hour.
        429: OpenApiResponse(
            description="Too Many Requests - 20 requests/hour limit exceeded."
        ),
    },
)


# ---------------------------------------------------------------------------
# Me (Current User Profile)
# Endpoint : GET /accounts/me/

me_doc = extend_schema(
    tags=["Users"],
    summary="Current User Profile",
    description="""
    Retrieve the authenticated user's profile.

    **Purpose**: Fetches the details of the currently logged-in user.
    **When frontend should call it**: On app load to hydrate user state.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Only returns data for the token bearer.
    """,
    responses={
        # 200: Returns the authenticated user's profile details.
        200: OpenApiResponse(
            response=inline_serializer(
                name="MeResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": UserSerializer(),  # Full user profile object.
                },
            ),
            description="Profile retrieved successfully.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "Profile retrieved successfully.",
                        "data": {"email": "user@example.com", "full_name": "John Doe"},
                    },
                )
            ],
        ),
        # 401: Returned when the request has no valid access token in the Authorization header.
        401: OpenApiResponse(
            description="Unauthorized - Missing or invalid access token."
        ),
    },
)


# ---------------------------------------------------------------------------
# Forgot Password
# Endpoint : POST /accounts/forget-password/

forget_password_doc = extend_schema(
    tags=["Authentication"],
    summary="Forgot Password",
    description="""
    Request a password reset link.

    **Purpose**: Initiates the password recovery flow.
    **When frontend should call it**: When the user forgets their password.
    **Authentication requirement**: Public.
    **Security behaviour**: Generic responses (no email enumeration). Only active/verified users receive emails. Rate limited to 5 requests/hour.

    ### Request Fields
    * `email`: The user's registered email address.
    """,
    request=ForgotPasswordSerializer,
    responses={
        # 200: Always returned regardless of whether the email exists (anti-enumeration).
        200: OpenApiResponse(
            response=inline_serializer(
                "ForgetPasswordResponse",
                fields={"message": rf_serializers.CharField()},
            ),
            description="Password reset link sent (or silently ignored if account invalid).",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "If the email is registered, a password reset link has been sent."
                    },
                )
            ],
        ),
        # 400: Returned when the email field fails basic format validation.
        400: OpenApiResponse(description="Bad Request - Invalid email format."),
        # 429: Returned when the client exceeds 5 requests per hour.
        429: OpenApiResponse(
            description="Too Many Requests - 5 requests/hour limit exceeded."
        ),
    },
)


# ---------------------------------------------------------------------------
# Reset Password
# Endpoint : POST /accounts/reset-password/

reset_password_doc = extend_schema(
    tags=["Authentication"],
    summary="Reset Password",
    description="""
    Reset a user's password using a valid password reset token.

    **Purpose**: Completes the password recovery flow.
    **When frontend should call it**: When the user submits the password reset form.
    **Authentication requirement**: Public.
    **Security behaviour**: Single-use token. Token expiration (30 mins). Invalidates all other reset tokens. Transaction safety. Rate limited to 10 requests/hour.

    ### Request Fields
    * `token`: Single-use secure token from the reset email.
    * `password`: The user's new password.
    * `confirm_password`: Must match the new password.
    """,
    request=ResetPasswordSerializer,
    responses={
        # 200: Password was successfully reset. The token is now consumed and invalid.
        200: OpenApiResponse(
            response=inline_serializer(
                "ResetPasswordResponse",
                fields={"message": rf_serializers.CharField()},
            ),
            description="Password reset successfully.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={"message": "Your password has been reset successfully."},
                )
            ],
        ),
        # 400: Returned for an expired/invalid token or a password mismatch.
        400: OpenApiResponse(
            description="Bad Request - Invalid token or password mismatch/validation failure."
        ),
        # 429: Returned when the client exceeds 10 requests per hour.
        429: OpenApiResponse(
            description="Too Many Requests - 10 requests/hour limit exceeded."
        ),
    },
)


# ---------------------------------------------------------------------------
# Resend Password Reset
# Endpoint : POST /accounts/resend-password-reset/

resend_password_reset_doc = extend_schema(
    tags=["Authentication"],
    summary="Resend Password Reset",
    description="""
    Resend a password reset email.

    **Purpose**: Allows users to request another reset email if they lost the first one.
    **When frontend should call it**: When the user clicks "Resend Email" on the recovery screen.
    **Authentication requirement**: Public.
    **Security behaviour**: Generic responses (no email enumeration). Rate limited to 3 requests/hour.

    ### Request Fields
    * `email`: The user's registered email address.
    """,
    request=ResendPasswordResetSerializer,
    responses={
        # 200: Always returned regardless of whether the email exists (anti-enumeration).
        200: OpenApiResponse(
            response=inline_serializer(
                "ResendPasswordResetResponse",
                fields={"message": rf_serializers.CharField()},
            ),
            description="Password reset link resent (or silently ignored if account invalid).",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "If the email is registered, a password reset link has been sent."
                    },
                )
            ],
        ),
        # 400: Returned when the email field fails basic format validation.
        400: OpenApiResponse(description="Bad Request - Invalid email format."),
        # 429: Returned when the client exceeds 3 requests per hour.
        429: OpenApiResponse(
            description="Too Many Requests - 3 requests/hour limit exceeded."
        ),
    },
)


# ---------------------------------------------------------------------------
# Change Password
# Endpoint : POST /accounts/change-password/

change_password_doc = extend_schema(
    tags=["Authentication"],
    summary="Change Password",
    description="""
    Change the authenticated user's password.

    **Purpose**: Allows logged-in users to update their password.
    **When frontend should call it**: When the user submits the change password form.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**:
    - Requires current password verification.
    - Issues new tokens to keep the current session active (no logout).
    - Transaction safety.
    - Rate limited to 5 requests/hour.

    ### Request Fields
    * `current_password`: The user's existing password.
    * `new_password`: The new password.
    * `confirm_password`: Must match the new password.
    """,
    request=ChangePasswordSerializer,
    responses={
        # 200: Password changed. New JWT tokens are returned to maintain the active session.
        200: OpenApiResponse(
            response=inline_serializer(
                name="ChangePasswordResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="ChangePasswordData",
                        fields={
                            "access": rf_serializers.CharField(),  # New short-lived access token.
                            "refresh": rf_serializers.CharField(),  # New long-lived refresh token.
                        },
                    ),
                },
            ),
            description="Password changed successfully.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "Your password has been changed successfully.",
                        "data": {"access": "eyJhb...", "refresh": "eyJhb..."},
                    },
                )
            ],
        ),
        # 400: Returned when current_password is wrong or confirm_password does not match.
        400: OpenApiResponse(
            description="Bad Request - Incorrect current password or password mismatch."
        ),
        # 401: Returned when the request has no valid access token in the Authorization header.
        401: OpenApiResponse(
            description="Unauthorized - Missing or invalid access token."
        ),
        # 429: Returned when the client exceeds 5 requests per hour.
        429: OpenApiResponse(
            description="Too Many Requests - 5 requests/hour limit exceeded."
        ),
    },
)
