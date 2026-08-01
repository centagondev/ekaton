from django.urls import path

from .views import (
    ChangePasswordAPIView,
    CheckEmailAPIView,
    ForgetPasswordAPIView,
    LoginAPIView,
    LogoutAPIView,
    ResendPasswordResetAPIView,
    ResetPasswordAPIView,
    SetPasswordAPIView,
    TokenRefreshAPIView,
)

urlpatterns = [
    path("check-email/", CheckEmailAPIView.as_view(), name="check_email"),
    path("set-password/", SetPasswordAPIView.as_view(), name="set_password"),
    path("login/", LoginAPIView.as_view(), name="login"),
    path("logout/", LogoutAPIView.as_view(), name="logout"),
    path("refresh/", TokenRefreshAPIView.as_view(), name="token_refresh"),
    path("forget-password/", ForgetPasswordAPIView.as_view(), name="forget_password"),
    path(
        "reset-password/",
        ResetPasswordAPIView.as_view(),
        name="reset_password",
    ),
    path(
        "resend-password-reset/",
        ResendPasswordResetAPIView.as_view(),
        name="resend_password_reset",
    ),
    path("change-password/", ChangePasswordAPIView.as_view(), name="change_password"),
]
