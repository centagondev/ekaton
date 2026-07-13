from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import CheckEmailAPIView, LoginAPIView, LogoutAPIview, SetPasswordAPIView

urlpatterns = [
    path("check-email/", CheckEmailAPIView.as_view(), name="check_email"),
    path("set-password/", SetPasswordAPIView.as_view(), name="set_password"),
    path("login/", LoginAPIView.as_view(), name="login"),
    path("logout/", LogoutAPIview.as_view(), name="logout"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
