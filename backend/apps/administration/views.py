import logging

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAdminUser
from rest_framework.views import APIView

from apps.users.serializers import UserSerializer
from core.pagination import DefaultPagination
from core.responses import error_response, success_response
from core.throttles import AdminDashboardRateThrottle, AdminLoginRateThrottle

from .docs import (admin_cancel_event_doc, admin_create_event_doc,
                   admin_create_user_doc, admin_dashboard_doc,
                   admin_event_detail_doc, admin_event_list_doc,
                   admin_login_doc, admin_reports_list_doc,
                   admin_update_event_doc, admin_update_report_status_doc,
                   admin_update_user_doc, admin_users_list_doc)
from .serializers import (AdminCreateEventSerializer,
                          AdminCreateUserSerializer,
                          AdminEventDetailSerializer, AdminEventSerializer,
                          AdminLoginSerializer, AdminReportSerializer,
                          AdminUpdateEventSerializer,
                          AdminUpdateReportStatusSerializer,
                          AdminUserSerializer, AdminUserUpdateSerializer)
from .services import (admin_create_user, admin_login, cancel_event,
                       create_event, get_dashboard_statistics, get_event_by_id,
                       get_event_statistics, get_events, get_reports,
                       get_users, update_event, update_report_status,
                       update_user)

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


class AdminReportAPIView(APIView):
    """Handle requests to view and filter user reports as an administrator."""

    permission_classes = [IsAdminUser]

    @admin_reports_list_doc
    def get(self, request):
        reports, stats = get_reports(
            search=request.query_params.get("search"),
            status=request.query_params.get("status"),
            batch=request.query_params.get("batch"),
            gender=request.query_params.get("gender"),
            reason=request.query_params.get("reason"),
            reporter_id=request.query_params.get("reporter_id"),
            reported_user_id=request.query_params.get("reported_user_id"),
            start_date=request.query_params.get("start_date"),
            end_date=request.query_params.get("end_date"),
        )

        paginator = DefaultPagination()
        page = paginator.paginate_queryset(reports, request)
        serializer = AdminReportSerializer(page, many=True)
        paginated_data = paginator.get_paginated_response(serializer.data)

        logger.info(
            f"Admin {request.user.id} fetched reports list (page: {request.query_params.get('page', 1)})"
        )

        return success_response(
            message="report fetched successfully",
            data={"stats": stats, "reports": paginated_data},
        )

    @admin_update_report_status_doc
    def patch(self, request, report_id):
        """Update the moderation status of a report.

        Args:
            request: The incoming HTTP request. Expected body:
                - status (str): The new status ('pending', 'reviewed', 'resolved').
            report_id (UUID): The primary key of the target report.

        Returns:
            A success response containing the updated report's full data.
        """
        serializer = AdminUpdateReportStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        report = update_report_status(
            report_id=report_id,
            status=serializer.validated_data["status"],
        )

        logger.info(
            f"Admin {request.user.id} updated report {report.id} status to '{report.status}'."
        )

        return success_response(
            message="report updated successfully",
            data=AdminReportSerializer(report).data,
        )


class AdminEventAPIView(GenericAPIView):
    """
    Retrieve all events for the admin dashboard.
    """

    permission_classes = [IsAdminUser]
    filter_backends = [
        DjangoFilterBackend,
        SearchFilter,
        OrderingFilter,
    ]
    search_fields = [
        "name",
        "description",
        "venue",
        "owner__full_name",
    ]
    filterset_fields = ["status", "is_anonymous_chat"]
    ordering_fields = ["created_at", "updated_at", "end_time", "name"]
    ordering = ["-created_at"]

    @admin_event_list_doc
    def get(self, request):
        """
        Return paginated events with statistics.
        """
        events = self.filter_queryset(get_events())
        stats = get_event_statistics()

        paginator = DefaultPagination()

        page = paginator.paginate_queryset(
            events,
            request,
        )

        serializer = AdminEventSerializer(page, many=True)

        paginated_data = paginator.get_paginated_response(
            serializer.data,
        )

        return success_response(
            message="Events fetched successfully.",
            data={
                "stats": stats,
                "events": paginated_data,
            },
        )


class AdminCreateEventAPIView(APIView):
    """
    Create an event for the admin dashboard.
    """

    permission_classes = [IsAdminUser]

    @admin_create_event_doc
    def post(self, request):
        serializer = AdminCreateEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event = create_event(validated_data=serializer.validated_data)

        logger.info(
            "Admin %s created event %s for owner %s.",
            request.user.id,
            event.id,
            event.owner_id,
        )

        return success_response(
            message="Event created successfully.",
            data=AdminEventDetailSerializer(event).data,
        )


class AdminEventDetailAPIView(APIView):
    """
    Retrieve a single event.
    """

    permission_classes = [IsAdminUser]

    @admin_event_detail_doc
    def get(self, request, event_id):
        event = get_event_by_id(event_id)
        serializer = AdminEventDetailSerializer(event)

        return success_response(
            message="Event fetched successfully.",
            data=serializer.data,
        )


class AdminUpdateEventAPIView(APIView):
    """Update an event from the admin dashboard."""

    permission_classes = [IsAdminUser]

    @admin_update_event_doc
    def patch(self, request, event_id):
        event = get_event_by_id(event_id)
        serializer = AdminUpdateEventSerializer(
            event,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)

        changed_fields = list(serializer.validated_data.keys())

        event = update_event(
            event=event,
            validated_data=serializer.validated_data,
        )

        logger.info(
            "Admin %s updated event %s. Fields changed: %s",
            request.user.id,
            event.id,
            changed_fields,
        )

        return success_response(
            message="Event updated successfully.",
            data=AdminEventDetailSerializer(event).data,
        )


class AdminCancelEventAPIView(APIView):
    """Cancel an event from the admin dashboard."""

    permission_classes = [IsAdminUser]

    @admin_cancel_event_doc
    def delete(self, request, event_id):
        event = get_event_by_id(event_id)
        cancel_event(event=event)

        logger.info("Admin %s cancelled event %s.", request.user.id, event.id)

        return success_response(message="Event cancelled successfully.")
