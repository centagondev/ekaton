from django.urls import path

from .views import ComplaintAPIView, ComplaintCommentAPIView, ComplaintUpvoteAPIView

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
]
