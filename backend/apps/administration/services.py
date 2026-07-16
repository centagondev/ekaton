from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import connection
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken
from apps.users.models import User
from apps.chat.models import (
    Report,
    PrivateChatRoom,
    PrivateMessage,
    RevealRequest
)


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
    return Report.objects.filter(
        status=Report.Status.PENDING
    ).count()

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
    return RevealRequest.objects.filter(
        status = RevealRequest.Status.PENDING
    ).count()

def blocked_users_count():
    return User.objects.filter(
        is_active = False
    ).count()

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

