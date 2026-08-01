app_name = "users"
from django.urls import path
from .views import MeAPIView, MeProfilePhotoAPIView

urlpatterns = [
    path("me/", MeAPIView.as_view(), name="me"),
    path("me/photo/", MeProfilePhotoAPIView.as_view(), name="me-photo"),
]
