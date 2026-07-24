from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.pagination import DefaultPagination
from .pagination import CommentCursorPagination
from core.responses import success_response
from core.throttles import (
    ComplaintCreateRateThrottle,
    CommentCreateRateThrottle,
    UpvoteToggleRateThrottle,
)

from .serializers import (
    CreateCommentSerializer,
    CreateComplaintSerializer,
    GetCommentSerializer,
    GetComplaintsSerializer,
    UpdateComplaintSerializer,
)
from .services import (
    create_comment,
    create_complaint,
    get_comments,
    get_complaints,
    get_complaint,
    toggle_upvote,
    update_complaint,
    delete_complaint
)
from .docs import (
    comment_create_doc,
    comment_list_doc,
    complaint_create_doc,
    complaint_delete_doc,
    complaint_list_doc,
    complaint_update_doc,
    complaint_detail_doc,
    upvote_toggle_doc,
)


class ComplaintAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if self.request.method == "POST":
            return [ComplaintCreateRateThrottle()]
        return super().get_throttles()

    @complaint_list_doc
    def get(self, request):

        complaints = get_complaints()

        paginator = DefaultPagination()

        page = paginator.paginate_queryset(complaints, request)

        if page is None:
            serializer = GetComplaintsSerializer(complaints, many=True)
            return success_response(
                message="Complaints fetched successfully.",
                data={
                    "count": len(serializer.data),
                    "next": None,
                    "previous": None,
                    "results": serializer.data,
                },
            )

        serializer = GetComplaintsSerializer(page, many=True)

        return success_response(
            message="Complaints fetched successfully.",
            data={
                "count": paginator.page.paginator.count,
                "next": paginator.get_next_link(),
                "previous": paginator.get_previous_link(),
                "results": serializer.data,
            },
        )

    @complaint_create_doc
    def post(self, request):
        serializer = CreateComplaintSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        complaint = create_complaint(
            user=request.user,
            title=serializer.validated_data["title"],
            description=serializer.validated_data["description"],
            category=serializer.validated_data["category"],
            is_anonymous=serializer.validated_data["is_anonymous"],
        )

        return success_response(
            message="Complaint created successfully.",
            status_code=201,
            data={"id": complaint.id},
        )

class ComplaintDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @complaint_detail_doc
    def get(self, request, complaint_id):
        complaint = get_complaint(complaint_id)
        serializer = GetComplaintsSerializer(complaint)
        return success_response(
            message="Complaint fetched successfully.",
            data=serializer.data
        )

    @complaint_update_doc
    def patch(self, request,complaint_id):
        serializer = UpdateComplaintSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        complaint = update_complaint(
            user=request.user,
            complaint_id=complaint_id,
            validated_data=serializer.validated_data
        )

        return success_response(
            message="Complaint updated successfully.",
            data=GetComplaintsSerializer(complaint).data
        )
    
    @complaint_delete_doc
    def delete(self, request, complaint_id):
        delete_complaint(
            user=request.user,
            complaint_id=complaint_id
        )

        return success_response(
            message="Complaint deleted successfully."
        )


class ComplaintCommentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if self.request.method == "POST":
            return [CommentCreateRateThrottle()]
        return super().get_throttles()

    @comment_list_doc
    def get(self, request, complaint_id):
        comments = get_comments(complaint_id)

        paginator = CommentCursorPagination()
        page = paginator.paginate_queryset(comments, request, view=self)

        if page is None:
            serializer = GetCommentSerializer(comments, many=True)
            return success_response(
                message="Comments fetched successfully.",
                data={
                    "next": None,
                    "previous": None,
                    "results": serializer.data,
                },
            )

        serializer = GetCommentSerializer(page, many=True)

        return success_response(
            message="Comments fetched successfully.",
            data={
                "next": paginator.get_next_link(),
                "previous": paginator.get_previous_link(),
                "results": serializer.data,
            },
        )

    @comment_create_doc
    def post(self, request, complaint_id):
        serializer = CreateCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = create_comment(
            user=request.user,
            complaint_id=complaint_id,
            comment=serializer.validated_data["comment"],
            is_anonymous=serializer.validated_data["is_anonymous"],
        )
        return success_response(
            message="Comment added successfully.",
            data={"comment_id": comment.id},
            status_code=201,
        )


class ComplaintUpvoteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if self.request.method == "POST":
            return [UpvoteToggleRateThrottle()]
        return super().get_throttles()

    @upvote_toggle_doc
    def post(self, request, complaint_id):
        upvote = toggle_upvote(user=request.user, complaint_id=complaint_id)

        return success_response(
            message="Upvote updated successfully.", data={"upvote": upvote}
        )
