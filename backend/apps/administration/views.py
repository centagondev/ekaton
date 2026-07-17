import logging

from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import IsAdminUser
from rest_framework.views import APIView

from apps.users.serializers import UserSerializer
from core.pagination import DefaultPagination
from core.responses import error_response, success_response
from core.throttles import AdminDashboardRateThrottle, AdminLoginRateThrottle

from .docs import (
    admin_create_user_doc,
    admin_dashboard_doc,
    admin_login_doc,
    admin_update_user_doc,
    admin_users_list_doc,
)
from .serializers import (
    AdminCreateUserSerializer,
    AdminLoginSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
)
from .services import (
    admin_create_user,
    admin_login,
    get_dashboard_statistics,
    get_users,
    update_user,
)

logger = logging.getLogger("authentication")


class AdminLoginAPIView(APIView):
    """Handle a request to authenticate an administrator.

    Validates credentials and ensures the user has staff or superuser privileges
    before issuing JWT tokens.
    """

    permission_classes = []
    throttle_classes = [AdminLoginRateThrottle]

    @admin_login_doc
    def post(self, request):
        """Authenticate an admin and return JWT tokens.

        Args:
            request: The incoming HTTP request. Expected body:
                - email (str): Admin's email address.
                - password (str): Admin's password.

        Returns:
            A success response containing the access and refresh tokens,
            or a 401 error response if authentication fails.
        """
        serializer = AdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = admin_login(
                email=serializer.validated_data["email"],
                password=serializer.validated_data["password"],
            )
        except AuthenticationFailed as e:
            logger.warning(
                f"Failed admin login attempt for email: {serializer.validated_data['email']}"
            )
            return error_response(
                message=str(e.detail) if hasattr(e, "detail") else str(e),
                status_code=401,
            )

        user = result["user"]
        logger.info(f"Successful admin login for user: {user.id}")

        return success_response(
            message="Admin login successfully",
            data={
                "access": result["access"],
                "refresh": result["refresh"],
                "user": AdminUserSerializer(user).data,
            },
        )


class AdminDashboardAPIView(APIView):
    permission_classes = [IsAdminUser]
    throttle_classes = [AdminDashboardRateThrottle]

    @admin_dashboard_doc
    def get(self, request):

        dashboard = get_dashboard_statistics()

        return success_response(
            message="dashboard fetched successfully", data={"statistics": dashboard}
        )


class AdminUsersAPIView(APIView):
    permission_classes = [IsAdminUser]

    @admin_users_list_doc
    def get(self, request):

        users, stats = get_users(
            search=request.query_params.get("search"),
            is_active=request.query_params.get("is_active"),
            is_verified=request.query_params.get("is_verified"),
            gender=request.query_params.get("gender"),
            batch=request.query_params.get("batch"),
        )

        paginator = DefaultPagination()

        page = paginator.paginate_queryset(users, request)

        serializer = UserSerializer(page, many=True)

        paginated_data = paginator.get_paginated_response(serializer.data)

        logger.info(
            f"Admin {request.user.id} fetched user list (page: {request.query_params.get('page', 1)})"
        )

        return success_response(
            message="Admin users data fetched successfully",
            data={"stats": stats, "users": paginated_data},
        )

    @admin_create_user_doc
    def post(self, request):
        """Create a new user from the admin dashboard."""
        serializer = AdminCreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = admin_create_user(
            full_name=serializer.validated_data["full_name"],
            email=serializer.validated_data["email"],
            batch=serializer.validated_data["batch"],
            gender=serializer.validated_data["gender"],
        )

        logger.info(
            f"Admin {request.user.id} created new user {user.id} (email: {user.email})"
        )

        return success_response(
            message="User created successfully",
            data=UserSerializer(user).data,
            status_code=201,
        )


class AdminUpdateUserAPIView(APIView):
    """Handle a request to partially update a user's profile as an administrator."""

    permission_classes = [IsAdminUser]

    @admin_update_user_doc
    def patch(self, request, user_id):
        """Partially update a user's profile.

        Args:
            request: The incoming HTTP request. Optional body fields:
                - full_name (str): User's display name.
                - batch (str): User's academic batch.
                - gender (str): 'male' or 'female'.
                - profile_photo (url|null): Profile photo URL.
                - is_active (bool): Whether the user is active.
                - is_verified (bool): Whether the user is verified.
            user_id (UUID): The primary key of the target user.

        Returns:
            A success response containing the updated user's full profile.
        """
        serializer = AdminUserUpdateSerializer(data=request.data, partial=True)

        serializer.is_valid(
            raise_exception=True,
        )

        user = update_user(
            user_id=user_id,
            data=serializer.validated_data,
        )

        logger.info(
            f"Admin {request.user.id} updated user {user.id}. "
            f"Fields changed: {list(serializer.validated_data.keys())}"
        )

        return success_response(
            message="User updated successfully", data=UserSerializer(user).data
        )
