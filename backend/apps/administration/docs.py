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

from .serializers import AdminLoginSerializer, AdminUserSerializer

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
        429: OpenApiResponse(
            description="Too Many Requests - Rate limit exceeded."
        ),
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
                                "blocked_users_count": 15
                            }
                        }
                    }
                )
            ]
        ),
        401: OpenApiResponse(description="Unauthorized - Not authenticated."),
        403: OpenApiResponse(description="Forbidden - User is not an admin."),
    }
)
