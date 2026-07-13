from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


class CheckEmailRateThrottle(AnonRateThrottle):
    scope = "check_email"


class SetPasswordRateThrottle(AnonRateThrottle):
    scope = "set_password"
