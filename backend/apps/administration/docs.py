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

from apps.users.serializers import UserSerializer

from .serializers import (
    AdminCreateUserSerializer,
    AdminLoginSerializer,
    AdminReportSerializer,
    AdminUpdateReportStatusSerializer,
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

# ---------------------------------------------------------------------------
# Admin User List
# Endpoint : GET /admin/users/

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

admin_users_list_doc = extend_schema(
    tags=["Administration"],
    summary="Admin User List",
    description="""
    Retrieve a paginated list of all users, with optional filtering and search.
    
    **Purpose**: Provides the user management table data for the admin dashboard.
    **Authentication requirement**: Admin only (IsAdminUser).
    """,
    parameters=[
        OpenApiParameter(
            name="search",
            description="Search by name, email, or batch",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="is_active",
            description="Filter by active status ('true' or 'false')",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="is_verified",
            description="Filter by verified status ('true' or 'false')",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="gender",
            description="Filter by gender ('male' or 'female')",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="batch",
            description="Filter by batch",
            required=False,
            type=OpenApiTypes.STR,
        ),
    ],
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="AdminUserListResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="AdminUserListData",
                        fields={
                            "stats": rf_serializers.DictField(
                                child=rf_serializers.IntegerField()
                            ),
                            "users": inline_serializer(
                                name="PaginatedUsers",
                                fields={
                                    "count": rf_serializers.IntegerField(),
                                    "next": rf_serializers.URLField(allow_null=True),
                                    "previous": rf_serializers.URLField(
                                        allow_null=True
                                    ),
                                    "results": UserSerializer(many=True),
                                },
                            ),
                        },
                    ),
                },
            ),
            description="Admin users data fetched successfully.",
        ),
        401: OpenApiResponse(description="Unauthorized - Not authenticated."),
        403: OpenApiResponse(description="Forbidden - User is not an admin."),
    },
)

# ---------------------------------------------------------------------------
# Admin Report List
# Endpoint : GET /admin/reports/

admin_reports_list_doc = extend_schema(
    tags=["Administration"],
    summary="Admin Report List",
    description="""
    Retrieve a paginated list of all reports, with advanced filtering and search.
    
    **Purpose**: Provides the report management table data for the admin dashboard.
    **Authentication requirement**: Admin only (IsAdminUser).
    """,
    parameters=[
        OpenApiParameter(
            name="search",
            description="Search by reported user or reporter name/email, reason, or description.",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="status",
            description="Filter by report status ('pending', 'reviewed', 'resolved')",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="batch",
            description="Filter by the reported user's batch",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="gender",
            description="Filter by the reported user's gender ('male' or 'female')",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="reason",
            description="Filter by report reason",
            required=False,
            type=OpenApiTypes.STR,
        ),
        OpenApiParameter(
            name="reporter_id",
            description="Filter by reporter's UUID",
            required=False,
            type=OpenApiTypes.UUID,
        ),
        OpenApiParameter(
            name="reported_user_id",
            description="Filter by reported user's UUID",
            required=False,
            type=OpenApiTypes.UUID,
        ),
        OpenApiParameter(
            name="start_date",
            description="Filter by reports created on or after this date (ISO 8601)",
            required=False,
            type=OpenApiTypes.DATETIME,
        ),
        OpenApiParameter(
            name="end_date",
            description="Filter by reports created on or before this date (ISO 8601)",
            required=False,
            type=OpenApiTypes.DATETIME,
        ),
    ],
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="AdminReportListResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="PaginatedReports",
                        fields={
                            "count": rf_serializers.IntegerField(),
                            "next": rf_serializers.URLField(allow_null=True),
                            "previous": rf_serializers.URLField(allow_null=True),
                            "results": AdminReportSerializer(many=True),
                        },
                    ),
                },
            ),
            description="Report fetched successfully.",
        ),
        401: OpenApiResponse(description="Unauthorized - Not authenticated."),
        403: OpenApiResponse(description="Forbidden - User is not an admin."),
    },
)

# ---------------------------------------------------------------------------
# Admin Update Report Status
# Endpoint : PATCH /admin/reports/<uuid:report_id>/

admin_update_report_status_doc = extend_schema(
    tags=["Administration"],
    summary="Admin Update Report Status",
    description="""
    Allow an administrator to update the moderation status of a report.

    **Purpose**: Enables admins to process the report moderation queue by moving
    reports through the defined workflow: pending → reviewed → resolved.
    **Authentication requirement**: Admin only (IsAdminUser).

    ### Path Parameter
    * `report_id` (UUID): The unique identifier of the report to update.

    ### Request Fields
    * `status` (str): The new moderation status. One of: `pending`, `reviewed`, `resolved`.
    """,
    request=AdminUpdateReportStatusSerializer,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="AdminUpdateReportStatusResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": AdminReportSerializer(),
                },
            ),
            description="Report status updated successfully.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={
                        "message": "report updated successfully",
                        "data": {
                            "room": "123e4567-e89b-12d3-a456-426614174000",
                            "reporter": {
                                "id": "...",
                                "full_name": "Jane Doe",
                                "email": "jane@example.com",
                            },
                            "reported_user": {
                                "id": "...",
                                "full_name": "John Doe",
                                "email": "john@example.com",
                            },
                            "reason": "harassment",
                            "description": "Sent offensive messages.",
                            "evidence_url": None,
                            "status": "resolved",
                            "created_at": "2024-01-01T12:00:00Z",
                            "updated_at": "2024-01-02T09:00:00Z",
                        },
                    },
                )
            ],
        ),
        400: OpenApiResponse(
            description="Bad Request - Invalid or missing status value."
        ),
        401: OpenApiResponse(description="Unauthorized - Not authenticated."),
        403: OpenApiResponse(description="Forbidden - User is not an admin."),
        404: OpenApiResponse(description="Not Found - Report does not exist."),
    },
)
