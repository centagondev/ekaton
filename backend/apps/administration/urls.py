from django.urls import path

from .views import (AdminCancelEventAPIView, AdminCreateEventAPIView,
                    AdminDashboardAPIView, AdminEventAPIView,
                    AdminEventDetailAPIView, AdminLoginAPIView,
                    AdminReportAPIView, AdminUpdateEventAPIView,
                    AdminUpdateUserAPIView, AdminUsersAPIView)

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
    path(
        "events/",
        AdminEventAPIView.as_view(),
        name="admin-events",
    ),
    path(
        "events/create/", AdminCreateEventAPIView.as_view(), name="admin-event-create"
    ),
    path(
        "events/<uuid:event_id>/update/",
        AdminUpdateEventAPIView.as_view(),
        name="admin-event-update",
    ),
    path(
        "events/<uuid:event_id>/cancel/",
        AdminCancelEventAPIView.as_view(),
        name="admin-event-cancel",
    ),
    path(
        "events/<uuid:event_id>/",
        AdminEventDetailAPIView.as_view(),
        name="admin-event-detail",
    ),
]
