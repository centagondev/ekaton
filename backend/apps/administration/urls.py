from django.urls import path

from .views import (
    AdminDashboardAPIView,
    AdminLoginAPIView,
    AdminReportAPIView,
    AdminUpdateUserAPIView,
    AdminUsersAPIView,
)

urlpatterns = [
    path("login/", AdminLoginAPIView.as_view(), name="admin-login"),
    path("dashboard/", AdminDashboardAPIView.as_view(), name="admin-dashboard"),
    path("users/", AdminUsersAPIView.as_view(), name="users"),
    path(
        "users/<uuid:user_id>/",
        AdminUpdateUserAPIView.as_view(),
        name="admin-update-user",
    ),
    path("reports/", AdminReportAPIView.as_view(), name="admin-reports"),
    path(
        "reports/<uuid:report_id>/",
        AdminReportAPIView.as_view(),
        name="admin-update-report",
    ),
]
