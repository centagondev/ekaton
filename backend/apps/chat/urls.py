from django.urls import path

from .views import EndChatAPIView, ReportAPIView, StartChatAPIView

urlpatterns = [
    path("start/", StartChatAPIView.as_view(), name="start-chat"),
    path("end/", EndChatAPIView.as_view(), name="end-chat"),
    path("report/", ReportAPIView.as_view(), name="report-user"),
]
