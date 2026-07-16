"""
API Documentation Schemas — Chat App.

This module contains all drf-spectacular ``extend_schema`` decorator instances
for the ``apps/chat`` API endpoints.

Architecture
------------
These schema objects are pure documentation metadata. They have absolutely zero
effect on runtime behaviour, authentication, matchmaking logic, or database
operations. They are applied as decorators inside ``views.py`` to keep
``views.py`` clean and focused exclusively on HTTP request handling.

Usage
-----
Import the required schema decorator into ``views.py`` and apply it directly
above the HTTP method::

    from .docs import start_chat_doc

    class StartChatAPIView(APIView):
        @start_chat_doc
        def post(self, request):
            ...

Maintenance
-----------
- Add new schema objects here when a new chat endpoint is created.
- Update the relevant schema object here when an endpoint contract changes
  (e.g. new request field, new response status code, changed description).
- Do NOT modify matchmaking logic, serializers, or views here.

Exports
-------
- ``start_chat_doc`` → StartChatAPIView.post
- ``end_chat_doc``   → EndChatAPIView.post
- ``report_doc``     → ReportAPIView.post
"""

from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers as rf_serializers

from .serializers import EndChatSerializer,ReportSerializer

# ---------------------------------------------------------------------------
# Start Anonymous Chat
# Endpoint : POST /chat/start/

start_chat_doc = extend_schema(
    tags=["Chat"],
    summary="Start Anonymous Chat",
    description="""
    Trigger the matchmaking flow for the current user.

    **Purpose**: Initiates an anonymous chat session. Matches the user with another waiting user, or places them in a queue if no one is available.
    **When frontend should call it**: When the user taps 'Find Chat'.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Authenticated user only.
    """,
    responses={
        # 200: Returns the matchmaking result. Status will be either "matched" or "queued".
        200: OpenApiResponse(
            response=inline_serializer(
                name="StartChatResponse",
                fields={
                    "message": rf_serializers.CharField(),
                    "data": inline_serializer(
                        name="MatchmakingResult",
                        fields={
                            "status": rf_serializers.CharField(),  # "matched" or "queued"
                            "message": rf_serializers.CharField(),  # Human-readable status message.
                            "room_id": rf_serializers.UUIDField(
                                required=False, allow_null=True
                            ),  # UUID of matched room; null if still queued.
                        },
                    ),
                },
            ),
            description="Matchmaking result.",
            examples=[
                OpenApiExample(
                    "Matched",
                    value={
                        "message": "You have been matched.",
                        "data": {
                            "status": "matched",
                            "message": "You have been matched.",
                            "room_id": "123e4567-e89b-12d3-a456-426614174000",
                        },
                    },
                ),
                OpenApiExample(
                    "Queued",
                    value={
                        "message": "Waiting for a match.",
                        "data": {
                            "status": "queued",
                            "message": "Waiting for a match.",
                            "room_id": None,  # No room assigned yet — user is in the waiting queue.
                        },
                    },
                ),
            ],
        ),
        # 401: Returned when the request has no valid access token in the Authorization header.
        401: OpenApiResponse(
            description="Unauthorized - Missing or invalid access token."
        ),
    },
)


# ---------------------------------------------------------------------------
# End Chat
# Endpoint : POST /chat/end/

end_chat_doc = extend_schema(
    tags=["Chat"],
    summary="End Chat",
    description="""
    End a specific active chat room for the current user.

    **Purpose**: Terminates an ongoing private chat session.
    **When frontend should call it**: When the user clicks 'End Chat'.
    **Authentication requirement**: Bearer Authentication (JWT required).
    **Security behaviour**: Validates that the room exists and the authenticated user is actually a participant in that room.

    ### Request Fields
    * `room_id`: The UUID of the active chat room to end.
    """,
    request=EndChatSerializer,
    responses={
        # 200: The chat room has been successfully marked as ended.
        200: OpenApiResponse(
            response=inline_serializer(
                "EndChatResponse",
                fields={"message": rf_serializers.CharField()},
            ),
            description="Chat ended successfully.",
            examples=[
                OpenApiExample("Success", value={"message": "Chat ended successfully."})
            ],
        ),
        # 400: Returned when the room_id field is not a valid UUID format.
        400: OpenApiResponse(description="Bad Request - Invalid room ID format."),
        # 401: Returned when the request has no valid access token in the Authorization header.
        401: OpenApiResponse(
            description="Unauthorized - Missing or invalid access token."
        ),
        # 404: Returned when the room does not exist or the user is not a participant.
        404: OpenApiResponse(
            description="Not Found - Chat room not found or user is not a participant."
        ),
    },
)


# ---------------------------------------------------------------------------
# Report User
# Endpoint : POST /chat/report/

report_doc = extend_schema(
    tags=["Chat"],
    summary="Report User",
    description="""
    Submit a moderation report against the anonymous chat partner.

    **Purpose**: Allows a chat participant to report abusive, harmful, or inappropriate
    behaviour by their anonymous chat partner. The reported user is determined securely
    by the backend — the client never specifies who is being reported.

    **When frontend should call it**: When the user taps 'Report' during or after a chat session.

    **Authentication requirement**: Bearer Authentication (JWT required).

    **Security behaviour**:
    - Only authenticated participants of the specified room can file a report.
    - The backend derives the reported user from the room — clients cannot spoof this.
    - A user cannot report the same chat partner twice while a report is still pending.
    - Rate limited to 5 requests/minute to prevent mass-report abuse.
    ### Request Fields
    * `room_id`: UUID of the chat room in which the incident occurred.
    * `reason`: The category of the report. Must be one of: `spam`, `harassment`, `abusive_language`, `inappropriate_content`, `fake_identity`, `other`.
    * `description` *(optional)*: A detailed explanation of the incident.
    * `evidence_url` *(optional)*: A valid URL pointing to supporting evidence (e.g. a screenshot).
    """,
    request=ReportSerializer,
    responses={
        # 200: Report was submitted successfully.
        200: OpenApiResponse(
            response=inline_serializer(
                "ReportResponse",
                fields={"message": rf_serializers.CharField()},
            ),
            description="Report submitted successfully.",
            examples=[
                OpenApiExample(
                    "Success",
                    value={"message": "Report submitted successfully"},
                )
            ],
        ),
        # 400: Returned when serializer validation fails (bad UUID, invalid reason, etc.).
        400: OpenApiResponse(
            description="Bad Request - Invalid room ID format, unrecognised reason value, or a pending report already exists for this room."
        ),
        # 401: Returned when the request has no valid access token in the Authorization header.
        401: OpenApiResponse(
            description="Unauthorized - Missing or invalid access token."
        ),
        # 404: Returned when the room does not exist or the authenticated user is not a participant.
        404: OpenApiResponse(
            description="Not Found - Chat room not found or user is not a participant."
        ),
        # 429: Returned when the client exceeds 5 requests per minute.
        429: OpenApiResponse(
            description="Too Many Requests - 5 requests/minute limit exceeded."
        ),
    },
)
