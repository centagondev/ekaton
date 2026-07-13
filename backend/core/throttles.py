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
