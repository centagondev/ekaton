from django.urls import path
from .views import (
    AdminLoginAPIView,
    AdminDashboardAPIView
)
urlpatterns = [
    path("login/", AdminLoginAPIView.as_view(), name="admin-login"),
    path("dashboard/", AdminDashboardAPIView.as_view(), name="admin-dashboard")
]
