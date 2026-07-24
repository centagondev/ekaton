"""
API Documentation Schemas — Complaints App.

This module contains all drf-spectacular ``extend_schema`` decorator instances
for the ``apps/complaints`` API endpoints.
"""

from drf_spectacular.utils import (OpenApiExample, OpenApiResponse,
                                   extend_schema, inline_serializer)
from rest_framework import serializers as rf_serializers

from .serializers import (CreateCommentSerializer, CreateComplaintSerializer,
                          GetCommentSerializer, GetComplaintsSerializer,
                          UpdateComplaintSerializer)

complaint_detail_doc = extend_schema(
    tags=["Complaints"],
    summary="Get Complaint Details",
    description="""
    Retrieve the details of a single complaint.

    **Purpose**: Display a specific complaint.
    **Authentication requirement**: Bearer Authentication (JWT required).
    """,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="ComplaintDetailResponse",
                fields={
                    "success": rf_serializers.BooleanField(default=True),
                    "message": rf_serializers.CharField(default="Complaint fetched successfully."),
                    "data": GetComplaintsSerializer(),
                },
            ),
            description="Complaint retrieved successfully.",
        ),
        401: OpenApiResponse(description="Unauthorized - Missing or invalid access token."),
        404: OpenApiResponse(description="Not Found - Complaint does not exist."),
    },
)

# ---------------------------------------------------------------------------
# List Complaints
# Endpoint : GET /complaints/

complaint_list_doc = extend_schema(
    tags=["Complaints"],
    summary="List Complaints",
    description="""
    Retrieve a paginated list of all complaints.

    **Purpose**: Display the feed of complaints.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Ordered by creation time descending.
    """,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="ComplaintListResponse",
                fields={
                    "success": rf_serializers.BooleanField(default=True),
                    "message": rf_serializers.CharField(default="Complaints fetched successfully"),
                    "data": inline_serializer(
                        name="ComplaintPaginatedData",
                        fields={
                            "count": rf_serializers.IntegerField(),
                            "next": rf_serializers.CharField(allow_null=True),
                            "previous": rf_serializers.CharField(allow_null=True),
                            "results": GetComplaintsSerializer(many=True),
                        },
                    ),
                },
            ),
            description="Complaints retrieved successfully.",
        ),
        401: OpenApiResponse(
            description="Unauthorized - Missing or invalid access token."
        ),
    },
)

# ---------------------------------------------------------------------------
# Create Complaint
# Endpoint : POST /complaints/

complaint_create_doc = extend_schema(
    tags=["Complaints"],
    summary="Create Complaint",
    description="""
    Create a new complaint.

    **Purpose**: Allows a user to post a complaint.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Rate limited (ComplaintCreateRateThrottle). Can be posted anonymously.
    """,
    request=CreateComplaintSerializer,
    responses={
        201: OpenApiResponse(
            response=inline_serializer(
                name="ComplaintCreateResponse",
                fields={
                    "success": rf_serializers.BooleanField(default=True),
                    "message": rf_serializers.CharField(default="complaint created successfully"),
                    "data": inline_serializer(
                        name="ComplaintCreateData",
                        fields={"id": rf_serializers.UUIDField()},
                    ),
                },
            ),
            description="Complaint created successfully.",
        ),
        400: OpenApiResponse(description="Bad Request - Invalid data format."),
        401: OpenApiResponse(description="Unauthorized - Missing or invalid access token."),
        429: OpenApiResponse(description="Too Many Requests - Rate limit exceeded."),
    },
)

# ---------------------------------------------------------------------------
# Update Complaint
# Endpoint : PATCH /complaints/{complaint_id}/

complaint_update_doc = extend_schema(
    tags=["Complaints"],
    summary="Update Complaint",
    description="""
    Update an existing complaint.

    **Purpose**: Allows a user to edit their complaint.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Can only be done within 5 minutes of creation by the original owner.
    """,
    request=UpdateComplaintSerializer,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="ComplaintUpdateResponse",
                fields={
                    "success": rf_serializers.BooleanField(default=True),
                    "message": rf_serializers.CharField(default="Complaint updated successfully"),
                    "data": GetComplaintsSerializer(),
                },
            ),
            description="Complaint updated successfully.",
        ),
        400: OpenApiResponse(description="Bad Request - Invalid data format."),
        401: OpenApiResponse(description="Unauthorized - Missing or invalid access token."),
        403: OpenApiResponse(description="Forbidden - Permission denied or 5-minute edit window expired."),
        404: OpenApiResponse(description="Not Found - Complaint does not exist."),
    },
)

# ---------------------------------------------------------------------------
# Delete Complaint
# Endpoint : DELETE /complaints/{complaint_id}/

complaint_delete_doc = extend_schema(
    tags=["Complaints"],
    summary="Delete Complaint",
    description="""
    Delete a complaint.

    **Purpose**: Allows a user to remove their complaint.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Can only be done within 5 minutes of creation by the original owner.
    """,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="ComplaintDeleteResponse",
                fields={
                    "success": rf_serializers.BooleanField(default=True),
                    "message": rf_serializers.CharField(default="Complaint deleted successfully"),
                    "data": rf_serializers.CharField(allow_null=True),
                },
            ),
            description="Complaint deleted successfully.",
        ),
        401: OpenApiResponse(description="Unauthorized - Missing or invalid access token."),
        403: OpenApiResponse(description="Forbidden - Permission denied or 5-minute edit window expired."),
        404: OpenApiResponse(description="Not Found - Complaint does not exist."),
    },
)

# ---------------------------------------------------------------------------
# List Comments
# Endpoint : GET /complaints/{complaint_id}/comments/

comment_list_doc = extend_schema(
    tags=["Complaints"],
    summary="List Comments",
    description="""
    Retrieve a paginated list of all comments for a specific complaint.

    **Purpose**: Display the discussion on a complaint.
    **Authentication requirement**: Bearer Authentication (JWT required).
    """,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="CommentListResponse",
                fields={
                    "success": rf_serializers.BooleanField(default=True),
                    "message": rf_serializers.CharField(default="Comments fetched successfully."),
                    "data": inline_serializer(
                        name="CommentPaginatedData",
                        fields={
                            "count": rf_serializers.IntegerField(),
                            "next": rf_serializers.CharField(allow_null=True),
                            "previous": rf_serializers.CharField(allow_null=True),
                            "results": GetCommentSerializer(many=True),
                        },
                    ),
                },
            ),
            description="Comments retrieved successfully.",
        ),
        401: OpenApiResponse(description="Unauthorized - Missing or invalid access token."),
        404: OpenApiResponse(description="Not Found - Complaint does not exist."),
    },
)

# ---------------------------------------------------------------------------
# Create Comment
# Endpoint : POST /complaints/{complaint_id}/comments/

comment_create_doc = extend_schema(
    tags=["Complaints"],
    summary="Create Comment",
    description="""
    Add a comment to a specific complaint.

    **Purpose**: Allows users to discuss a complaint.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Can be posted anonymously.
    """,
    request=CreateCommentSerializer,
    responses={
        201: OpenApiResponse(
            response=inline_serializer(
                name="CommentCreateResponse",
                fields={
                    "success": rf_serializers.BooleanField(default=True),
                    "message": rf_serializers.CharField(default="comment added successfully"),
                    "data": inline_serializer(
                        name="CommentCreateData",
                        fields={"comment_id": rf_serializers.UUIDField()},
                    ),
                },
            ),
            description="Comment created successfully.",
        ),
        400: OpenApiResponse(description="Bad Request - Invalid data format."),
        401: OpenApiResponse(description="Unauthorized - Missing or invalid access token."),
        404: OpenApiResponse(description="Not Found - Complaint does not exist."),
    },
)

# ---------------------------------------------------------------------------
# Toggle Upvote
# Endpoint : POST /complaints/{complaint_id}/upvote/

upvote_toggle_doc = extend_schema(
    tags=["Complaints"],
    summary="Toggle Upvote",
    description="""
    Upvote or remove an upvote from a complaint.

    **Purpose**: Allows a user to show agreement with a complaint.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Toggles state. If already upvoted, the upvote is removed.
    """,
    request=None,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="UpvoteToggleResponse",
                fields={
                    "success": rf_serializers.BooleanField(default=True),
                    "message": rf_serializers.CharField(default="Upvoted updated successfully"),
                    "data": inline_serializer(
                        name="UpvoteToggleData",
                        fields={"upvote": rf_serializers.BooleanField()},
                    ),
                },
            ),
            description="Upvote toggled successfully.",
        ),
        401: OpenApiResponse(description="Unauthorized - Missing or invalid access token."),
        404: OpenApiResponse(description="Not Found - Complaint does not exist."),
    },
)
