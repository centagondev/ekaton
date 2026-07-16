from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """Rate limiter for the login endpoint. Scoped to anonymous users by IP."""

    scope = "login"


class CheckEmailRateThrottle(AnonRateThrottle):
    """Rate limiter for the check-email endpoint. Scoped to anonymous users by IP."""

    scope = "check_email"


class SetPasswordRateThrottle(AnonRateThrottle):
    """Rate limiter for the set-password endpoint. Scoped to anonymous users by IP."""

    scope = "set_password"


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
