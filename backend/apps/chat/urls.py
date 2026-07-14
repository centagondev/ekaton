from django.urls import path

from .views import EndChatAPIView, StartChatAPIView

urlpatterns = [
    path("start/", StartChatAPIView.as_view(), name="start-chat"),
    path("end/", EndChatAPIView.as_view(), name="end-chat"),
]
