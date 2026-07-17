from django.urls import path

from .views import (
    CancelEventAPIView,
    CreateEventAPIView,
    EventDetailAPIView,
    EventListAPIView,
    JoinEventAPIView,
    LeaveEventAPIView,
    UpdateEventAPIView,
)

urlpatterns = [
    path(
        "",
        EventListAPIView.as_view(),
        name="event-list",
    ),
    path(
        "create/",
        CreateEventAPIView.as_view(),
        name="event-create",
    ),
    path("<uuid:pk>/", EventDetailAPIView.as_view(), name="event-detail"),
    path("<uuid:pk>/update/", UpdateEventAPIView.as_view(), name="event-update"),
    path("<uuid:pk>/cancel/", CancelEventAPIView.as_view(), name="event-cancel"),
    path("<uuid:pk>/join/", JoinEventAPIView.as_view(), name="event-join"),
    path("<uuid:pk>/leave/", LeaveEventAPIView.as_view(), name="event-leave"),
]
