import secrets

from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db import IntegrityError, connection, transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.chat.models import (PrivateChatRoom, PrivateMessage, Report,
                              RevealRequest)
from apps.events.models import Event, EventParticipant, EventStatus
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


def online_users_count():
    return 0


def active_users_count():
    return User.objects.filter(is_active=True).count()


def pending_reports_count():
    return Report.objects.filter(status=Report.Status.PENDING).count()


def verified_users_count():
    return User.objects.filter(is_verified=True).count()


def active_events_count():
    return 0


def total_chats_count():
    return PrivateChatRoom.objects.count()


def total_report_count():
    """Return the total number of reports in the system."""
    return Report.objects.count()


def total_resolved_report_count():
    """Return the total number of reports with a RESOLVED status."""
    return Report.objects.filter(status=Report.Status.RESOLVED).count()


def total_pending_report_count():
    """Return the total number of reports with a PENDING status."""
    return Report.objects.filter(status=Report.Status.PENDING).count()


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
            "online_users_count": online_users_count(),
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

    stats = {
        "users_count": users_count(),
        "active_users": active_users_count(),
        "blocked_users": blocked_users_count(),
        "online_users": online_users_count(),
        "verified_users": verified_users_count(),
    }
    return queryset, stats


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


def get_reports(
    search=None,
    status=None,
    batch=None,
    gender=None,
    reason=None,
    reporter_id=None,
    reported_user_id=None,
    start_date=None,
    end_date=None,
):
    """
    Retrieve and filter a list of reports from the database.

    Supports advanced filtering and search using Q objects for efficient lookup.
    Includes related objects (reporter, reported_user, room) to avoid N+1 queries.
    """
    queryset = Report.objects.select_related(
        "reporter",
        "reported_user",
        "room",
    ).order_by("-created_at")

    if search:
        queryset = queryset.filter(
            Q(reported_user__full_name__icontains=search)
            | Q(reported_user__email__icontains=search)
            | Q(reporter__full_name__icontains=search)
            | Q(reporter__email__icontains=search)
            | Q(reason__icontains=search)
            | Q(description__icontains=search)
        )

    if status:
        queryset = queryset.filter(status=status)

    if batch:
        queryset = queryset.filter(reported_user__batch=batch)

    if gender:
        queryset = queryset.filter(reported_user__gender=gender)

    if reason:
        queryset = queryset.filter(reason=reason)

    if reporter_id:
        queryset = queryset.filter(reporter_id=reporter_id)

    if reported_user_id:
        queryset = queryset.filter(reported_user_id=reported_user_id)

    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)

    if end_date:
        queryset = queryset.filter(created_at__lte=end_date)

    stats = {
        "reports_count": total_report_count(),
        "reports_resolved_count": total_resolved_report_count(),
        "reports_pending_count": total_pending_report_count(),
    }

    return queryset, stats


def update_report_status(report_id, status):
    """
    Update the moderation status of a report.

    Args:
        report_id (UUID): The primary key of the target report.
        status (str): The new status value. Must be a valid Report.Status choice.
                      Incoming value is validated by the serializer before this call.

    Returns:
        Report: The updated report instance.

    Raises:
        Http404: If no report with the given report_id exists.
    """
    report = get_object_or_404(Report, id=report_id)

    report.status = status
    report.save(update_fields=["status"])

    return report


def get_event_statistics():
    """Return event statistics using a single aggregate database query."""
    statistics = Event.objects.aggregate(
        total_events=Count("id"),
        active_events=Count("id", filter=Q(status=EventStatus.ACTIVE)),
        ended_events=Count("id", filter=Q(status=EventStatus.ENDED)),
        cancelled_events=Count("id", filter=Q(status=EventStatus.CANCELLED)),
        anonymous_events=Count("id", filter=Q(is_anonymous_chat=True)),
    )
    return statistics

def get_events():
    """
    Return all events for the admin panel.
    """
    return (
        Event.objects.select_related("owner")
        .annotate(
            participant_count=Count(
                "participants", filter=Q(participants__is_active=True)
            )
        )
        .order_by("-created_at")
    )


def get_event_by_id(event_id):
    """
    Retrieve a single event with participant count.
    """

    return get_object_or_404(
        Event.objects.select_related("owner").annotate(
            participant_count=Count(
                "participants",
                filter=Q(participants__is_active=True),
            )
        ),
        id=event_id,
    )


@transaction.atomic
def create_event(*, validated_data):
    """
    Create an event for the admin dashboard.

    If anonymous chat is enabled, initialize the anonymous identity seed
    and counter used by the event chat flow.
    """
    event_data = {**validated_data}

    if event_data.get("is_anonymous_chat"):
        event_data["anonymous_seed"] = secrets.randbits(63)
        event_data["anonymous_counter"] = 0

    return Event.objects.create(**event_data)


@transaction.atomic
def update_event(*, event, validated_data):
    """Update an event from the admin dashboard.

    Args:
        event: Event instance to update.
        validated_data: Serializer-validated editable fields.

    Returns:
        Event: The updated event.

    Raises:
        ValidationError: If anonymous mode changes after participation.

    Transaction behavior:
        The update is atomic.
    """
    if "is_anonymous_chat" in validated_data:
        anonymous_chat = validated_data["is_anonymous_chat"]
        if anonymous_chat != event.is_anonymous_chat and event.participants.exists():
            raise ValidationError(
                "Anonymous chat cannot be changed after participants join."
            )

        if anonymous_chat and not event.is_anonymous_chat:
            validated_data = {
                **validated_data,
                "anonymous_seed": secrets.randbits(63),
                "anonymous_counter": 0,
            }
        elif not anonymous_chat and event.is_anonymous_chat:
            validated_data = {
                **validated_data,
                "anonymous_seed": None,
                "anonymous_counter": 0,
            }

    for field, value in validated_data.items():
        setattr(event, field, value)

    event.save(update_fields=[*validated_data.keys(), "updated_at"])
    return event


@transaction.atomic
def cancel_event(*, event):
    """Cancel an active event and deactivate its participants.

    Args:
        event: Event instance to cancel.

    Returns:
        Event: The cancelled event.

    Raises:
        ValidationError: If the event is not active.

    Transaction behavior:
        Status and participant updates are atomic.
    """
    event = Event.objects.select_for_update().get(pk=event.pk)

    if event.status != EventStatus.ACTIVE:
        raise ValidationError("Only active events can be cancelled.")

    event.status = EventStatus.CANCELLED
    event.save(update_fields=["status", "updated_at"])

    EventParticipant.objects.filter(event=event, is_active=True).update(
        is_active=False,
        left_at=timezone.now(),
    )

    return event
