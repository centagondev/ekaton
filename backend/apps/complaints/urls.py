from django.urls import path

from .views import (
    ComplaintAPIView,
    ComplaintCommentAPIView,
    ComplaintUpvoteAPIView,
    ComplaintDetailAPIView
)

urlpatterns = [
    path("", ComplaintAPIView.as_view(), name="complaints"),
    path(
        "<uuid:complaint_id>/comments/",
        ComplaintCommentAPIView.as_view(),
        name="complaint-comment",
    ),
    path(
        "<uuid:complaint_id>/upvote/",
        ComplaintUpvoteAPIView.as_view(),
        name="upvote-complaint",
    ),
    path(
    "<uuid:complaint_id>/",
    ComplaintDetailAPIView.as_view(),
    name="complaint-detail",
)
]
