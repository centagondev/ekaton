from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import IntegrityError, connection
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.chat.models import PrivateChatRoom, PrivateMessage, Report, RevealRequest
from apps.users.models import User


def admin_login(email, password):
    """Authenticate an admin user and return JWT tokens.

    Validates credentials and ensures the user has staff or superuser
    privileges.

    Args:
        email: The admin's email address.
        password: The admin's raw password.

    Returns:
        dict: Containing 'user' instance, 'refresh' token, and 'access' token.

    Raises:
        AuthenticationFailed: If credentials are invalid or user lacks admin privileges.
    """

    user = authenticate(email=email, password=password)

    if user is None:
        raise AuthenticationFailed("Invalid email or password.")

    if not (user.is_superuser or user.is_staff):
        raise AuthenticationFailed("Only administrators can log in.")

    refresh = RefreshToken.for_user(user)

    return {"user": user, "refresh": str(refresh), "access": str(refresh.access_token)}


def users_count():
    return User.objects.count()


def active_users_count():
    return 0


def pending_reports_count():
    return Report.objects.filter(status=Report.Status.PENDING).count()


def active_events_count():
    return 0


def total_chats_count():
    return PrivateChatRoom.objects.count()


def total_messages_count():
    """Returns an approximate count of total messages for extreme performance.

    In PostgreSQL, COUNT(*) on millions of rows triggers a slow sequential scan.
    Querying the pg_class catalog retrieves an instant approximate row count
    maintained by the vacuum process.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT reltuples::bigint FROM pg_class WHERE relname = 'private_messages';"
            )
            row = cursor.fetchone()
            if row and row[0] >= 0:
                return row[0]
    except Exception:
        pass

    # Fallback to standard ORM count if raw query fails or doesn't return data
    return PrivateMessage.objects.count()


def pending_reveals_count():
    return RevealRequest.objects.filter(status=RevealRequest.Status.PENDING).count()


def blocked_users_count():
    return User.objects.filter(is_active=False).count()


def get_dashboard_statistics():
    def fetch_stats():
        return {
            "users_count": users_count(),
            "active_users_count": active_users_count(),
            "active_events_count": active_events_count(),
            "pending_reports_count": pending_reports_count(),
            "total_chats_count": total_chats_count(),
            "total_messages_count": total_messages_count(),
            "pending_reveal_request_count": pending_reveals_count(),
            "blocked_users_count": blocked_users_count(),
        }

    return cache.get_or_set("admin_dashboard_stats", fetch_stats, timeout=60)


def get_users(search=None, is_active=None, is_verified=None, gender=None, batch=None):
    queryset = User.objects.order_by("-created_at")

    if search:
        queryset = queryset.filter(
            Q(full_name__icontains=search)
            | Q(email__icontains=search)
            | Q(batch__icontains=search)
        )

    if is_active is not None:
        queryset = queryset.filter(is_active=is_active.lower() == "true")

    if is_verified is not None:
        queryset = queryset.filter(is_verified=is_verified.lower() == "true")

    if gender:
        queryset = queryset.filter(gender=gender)

    if batch:
        queryset = queryset.filter(batch=batch)

    return queryset


def update_user(user_id, data):
    """Partially update a user's profile with the provided data.

    Args:
        user_id (UUID): The primary key of the target user.
        data (dict): A dictionary of validated field names and their new values.
                     Only explicitly whitelisted serializer fields will be present.

    Returns:
        User: The updated user instance.

    Raises:
        Http404: If no user with the given user_id exists.
    """
    user = get_object_or_404(User, id=user_id)

    for field, value in data.items():
        setattr(user, field, value)

    user.save(update_fields=list(data.keys()))

    return user


def admin_create_user(full_name, email, batch, gender):
    """
    Create a new user from the admin dashboard.

    The user is created with an unusable password and is_verified=False.
    The account setup flow is handled separately via the Check Email API.
    """
    try:
        return User.objects.create_user(
            full_name=full_name, email=email, batch=batch, gender=gender, password=None
        )
    except IntegrityError:
        raise ValidationError({"email": "A user with this email already exists."})
