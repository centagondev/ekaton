from django.urls import path

from .views import (
    CancelChatSearchAPIView,
    EndChatAPIView,
    ReportAPIView,
    StartChatAPIView,
)

urlpatterns = [
    path("start/", StartChatAPIView.as_view(), name="start-chat"),
    path("cancel/", CancelChatSearchAPIView.as_view(), name="cancel-chat-search"),
    path("end/", EndChatAPIView.as_view(), name="end-chat"),
    path("report/", ReportAPIView.as_view(), name="report-user"),
]
