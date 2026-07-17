"""
API Documentation Schemas — Administration App.

This module contains all drf-spectacular ``extend_schema`` decorator instances
for the ``apps/administration`` API endpoints.
"""

from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers as rf_serializers

from .serializers import (
    AdminCreateUserSerializer,
    AdminLoginSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
)

# ---------------------------------------------------------------------------
# Admin Login
# Endpoint : POST /admin/admin/

admin_login_doc = extend_schema(
    tags=["Administration"],
    summary="Admin Login",
    description="""
    Authenticate an administrator and return JWT tokens.

    **Purpose**: Allows staff and superusers to log into the admin dashboard.
    **When frontend should call it**: Upon submission of the admin login form.
    **Authentication requirement**: Public.
    **Security behaviour**:
    - Rejects regular users (even if their credentials are correct).
    - Rate limited to prevent brute-force attacks.
    - Emits generic error messages to prevent user enumeration.

    ### Request Fields
    * `email`: The administrator's registered email address.
    * `password`: The administrator's password.
    """,
    request=AdminLoginSerializer,
    responses={
        # 200: Returns both JWT tokens and the authenticated admin's profile.
        200: OpenApiResponse(
            response=inline_serializer(
                name="AdminLoginResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="AdminLoginData",
                        fields={
                            "access": rf_serializers.CharField(),  # Short-lived JWT access token.
                            "refresh": rf_serializers.CharField(),  # Long-lived JWT refresh token.
                            "user": AdminUserSerializer(),  # Authenticated admin's profile data.
                        },
                    ),
                },
            ),
            description="Admin login successful.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "Admin login successfully",
                        "data": {
                            "access": "eyJhb...",
                            "refresh": "eyJhb...",
                            "user": {
                                "id": "123e4567-e89b-12d3-a456-426614174000",
                                "full_name": "Admin User",
                                "email": "admin@example.com",
                                "is_superuser": True,
                                "is_staff": True,
                            },
                        },
                    },
                )
            ],
        ),
        # 400: Returned when required fields (email/password) are missing entirely.
        400: OpenApiResponse(description="Bad Request - Missing fields."),
        # 401: Returned for wrong password, or if the user is not an admin.
        401: OpenApiResponse(
            description="Unauthorized - Incorrect credentials or insufficient privileges."
        ),
        # 429: Returned when the client exceeds the rate limit.
        429: OpenApiResponse(description="Too Many Requests - Rate limit exceeded."),
    },
)

# ---------------------------------------------------------------------------
# Admin Dashboard
# Endpoint : GET /admin/dashboard/

admin_dashboard_doc = extend_schema(
    tags=["Administration"],
    summary="Admin Dashboard Statistics",
    description="""
    Retrieve aggregated statistics for the admin dashboard.

    **Purpose**: Provides high-level metrics for the administration panel.
    **Authentication requirement**: Admin only (IsAdminUser).
    **Security behaviour**:
    - Rejects regular authenticated users.
    - Uses Redis caching (60s) to prevent database overload.
    """,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="AdminDashboardResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="AdminDashboardData",
                        fields={
                            "statistics": rf_serializers.DictField(
                                child=rf_serializers.IntegerField(allow_null=True)
                            ),
                        },
                    ),
                },
            ),
            description="Dashboard statistics fetched successfully.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "dashboard fetched successfully",
                        "data": {
                            "statistics": {
                                "users_count": 1500,
                                "active_users_count": None,
                                "active_events_count": None,
                                "pending_reports_count": 12,
                                "total_chats_count": 450,
                                "total_messages_count": 5200000,
                                "pending_reveal_request_count": 3,
                                "blocked_users_count": 15,
                            }
                        },
                    },
                )
            ],
        ),
        401: OpenApiResponse(description="Unauthorized - Not authenticated."),
        403: OpenApiResponse(description="Forbidden - User is not an admin."),
    },
)

# ---------------------------------------------------------------------------
# Admin Update User
# Endpoint : PATCH /admin/users/<uuid:user_id>/

admin_update_user_doc = extend_schema(
    tags=["Administration"],
    summary="Admin Update User",
    description="""
    Allow an administrator to perform a partial update on a user's profile.

    **Purpose**: Enables admins to moderate users — e.g., verify accounts, block users,
    or correct profile data — directly from the admin panel.
    **Authentication requirement**: Admin only (IsAdminUser).
    **Security behaviour**:
    - Only explicitly whitelisted fields (`full_name`, `batch`, `gender`,
      `profile_photo`, `is_active`, `is_verified`) can be modified.
    - Sensitive fields (password, email, is_staff, is_superuser) are
      completely blocked from modification by this endpoint.
    - All fields are optional — only supplied fields are updated (PATCH semantics).

    ### Path Parameter
    * `user_id` (UUID): The unique identifier of the user to update.

    ### Optional Request Fields
    * `full_name` (str): User's full name.
    * `batch` (str): User's batch/year.
    * `gender` (str): `"male"` or `"female"`.
    * `profile_photo` (url|null): URL to the user's profile photo.
    * `is_active` (bool): Whether the user account is active (block/unblock).
    * `is_verified` (bool): Whether the user account is verified.
    """,
    request=AdminUserUpdateSerializer,
    responses={
        # 200: Returns the full updated user profile.
        200: OpenApiResponse(
            response=inline_serializer(
                name="AdminUpdateUserResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="AdminUpdateUserData",
                        fields={
                            "id": rf_serializers.UUIDField(),
                            "full_name": rf_serializers.CharField(),
                            "email": rf_serializers.EmailField(),
                            "batch": rf_serializers.CharField(),
                            "gender": rf_serializers.CharField(),
                            "profile_photo": rf_serializers.URLField(allow_null=True),
                            "is_available": rf_serializers.BooleanField(),
                            "is_verified": rf_serializers.BooleanField(),
                        },
                    ),
                },
            ),
            description="User updated successfully.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "User updated successfully",
                        "data": {
                            "id": "123e4567-e89b-12d3-a456-426614174000",
                            "full_name": "Jane Doe",
                            "email": "jane@example.com",
                            "batch": "2024",
                            "gender": "female",
                            "profile_photo": None,
                            "is_available": True,
                            "is_verified": True,
                        },
                    },
                )
            ],
        ),
        # 400: Invalid field values submitted.
        400: OpenApiResponse(description="Bad Request - Validation error."),
        # 401: Not authenticated.
        401: OpenApiResponse(description="Unauthorized - Not authenticated."),
        # 403: Authenticated but not an admin.
        403: OpenApiResponse(description="Forbidden - User is not an admin."),
        # 404: Target user not found.
        404: OpenApiResponse(description="Not Found - User does not exist."),
    },
)

# ---------------------------------------------------------------------------
# Admin Create User
# Endpoint : POST /admin/users/

admin_create_user_doc = extend_schema(
    tags=["Administration"],
    summary="Admin Create User",
    description="""
    Allow an administrator to create a new user.

    **Purpose**: Enables admins to provision users. The created user has no password
    and `is_verified=False` by default. They must go through the standard "Check Email"
    and setup flow to set a password and activate their account.
    **Authentication requirement**: Admin only (IsAdminUser).

    ### Request Fields
    * `full_name` (str): User's full name.
    * `email` (str): User's email address.
    * `batch` (str): User's batch.
    * `gender` (str): `"male"` or `"female"`.
    """,
    request=AdminCreateUserSerializer,
    responses={
        201: OpenApiResponse(
            response=inline_serializer(
                name="AdminCreateUserResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="AdminCreateUserData",
                        fields={
                            "id": rf_serializers.UUIDField(),
                            "full_name": rf_serializers.CharField(),
                            "email": rf_serializers.EmailField(),
                            "batch": rf_serializers.CharField(),
                            "gender": rf_serializers.CharField(),
                            "profile_photo": rf_serializers.URLField(allow_null=True),
                            "is_available": rf_serializers.BooleanField(),
                            "is_verified": rf_serializers.BooleanField(),
                            "is_active": rf_serializers.BooleanField(),
                        },
                    ),
                },
            ),
            description="User created successfully.",
        ),
        400: OpenApiResponse(
            description="Bad Request - Validation error or duplicate email."
        ),
        401: OpenApiResponse(description="Unauthorized - Not authenticated."),
        403: OpenApiResponse(description="Forbidden - User is not an admin."),
    },
)
