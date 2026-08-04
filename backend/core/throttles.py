from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Rate limiter for the login endpoint. Scoped to anonymous users by IP."""

    scope = "login"


class CheckEmailRateThrottle(AnonRateThrottle):
    """Rate limiter for the check-email endpoint. Scoped to anonymous users by IP."""

    scope = "check_email"


class LogoutRateThrottle(UserRateThrottle):
    """Rate limiter for the logout endpoint. Scoped to authenticated users by user ID."""

    scope = "logout"


class ForgetPasswordRateThrottle(AnonRateThrottle):
    """
    Rate limiter for forgot password requests.
    Scoped to anonymous users by IP.
    """

    scope = "forget_password"


class ResetPasswordRateThrottle(AnonRateThrottle):
    """
    Rate limiter for password reset requests.
    Scoped to anonymous users by IP.
    """

    scope = "reset_password"


class ResendPasswordResetRateThrottle(AnonRateThrottle):
    """
    Rate limiter for password reset email resend requests.
    Scoped to anonymous users by IP.
    """

    scope = "resend_password_reset"


class ChangePasswordRateThrottle(UserRateThrottle):
    """
    Rate limiter for the change password endpoint.
    Scoped to authenticated users.
    """

    scope = "change_password"


class StartChatRateThrottle(UserRateThrottle):
    """Rate limiter for the start chat endpoint. Scoped to authenticated users."""

    scope = "start_chat"


class CancelChatSearchRateThrottle(UserRateThrottle):
    """Rate limiter for leaving the matchmaking queue.

    Fired by the client whenever the app goes to the background, so a user who
    alt-tabs repeatedly must not be throttled out of releasing their slot.
    Matched to the start_chat budget: a leave can never outnumber the starts
    that preceded it.
    """

    scope = "cancel_chat_search"


class ReportRateThrottle(UserRateThrottle):
    """Rate limiter for the report endpoint. Scoped to authenticated users."""

    scope = "report"


class ComplaintCreateRateThrottle(UserRateThrottle):
    """Rate limiter for complaint creation. Scoped to authenticated users."""

    scope = "complaint_create"


class AdminLoginRateThrottle(UserRateThrottle):
    scope = "admin_login"


class AdminDashboardRateThrottle(UserRateThrottle):
    scope = "admin_dashboard"


class CommentCreateRateThrottle(UserRateThrottle):
    """Rate limiter for comment creation. Scoped to authenticated users."""

    scope = "comment_create"


class UpvoteToggleRateThrottle(UserRateThrottle):
    """Rate limiter for upvote toggling. Scoped to authenticated users."""

    scope = "upvote_toggle"


class TokenRefreshRateThrottle(AnonRateThrottle):
    """Rate limiter for the token refresh endpoint. Scoped to anonymous users by IP."""

    scope = "token_refresh"


class EventCreateRateThrottle(UserRateThrottle):
    """Sustained limit for event creation. Scoped to authenticated users."""

    scope = "event_create"


class EventCreateBurstRateThrottle(UserRateThrottle):
    """
    Stops a rush of events created within a few seconds.

    Used together with EventCreateRateThrottle, and both have to pass. "10 an
    hour" on its own would still allow all 10 in one second, so this short
    limit sits beside it and spreads them out.
    """

    scope = "event_create_burst"


class EventReadRateThrottle(UserRateThrottle):
    """Rate limiter for reading events. Generous: reads are cheap and frequent."""

    scope = "event_read"


class EventCancelRateThrottle(UserRateThrottle):
    """
    Rate limiter for cancelling an event.

    Cancelling closes the room and kicks every participant out, so it is
    limited more tightly than simply editing an event.
    """

    scope = "event_cancel"


class EventMessageCreateRateThrottle(UserRateThrottle):
    """Rate limiter for sending event chat messages. Scoped to authenticated users."""

    scope = "event_message_create"


class EventMembershipRateThrottle(UserRateThrottle):
    """Rate limiter for joining and leaving events. Scoped to authenticated users."""

    scope = "event_membership"


class ChatEndRateThrottle(UserRateThrottle):
    """Rate limiter for the end chat endpoint. Scoped to authenticated users."""

    scope = "chat_end"


class ContentUpdateRateThrottle(UserRateThrottle):
    """Rate limiter for editing and deleting own content. Scoped to authenticated users."""

    scope = "content_update"
