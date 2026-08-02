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
- ``start_chat_doc``          → StartChatAPIView.post
- ``cancel_chat_search_doc``  → CancelChatSearchAPIView.post
- ``end_chat_doc``            → EndChatAPIView.post
- ``report_doc``              → ReportAPIView.post
"""

from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers as rf_serializers

from .serializers import (
    CancelChatSearchSerializer,
    EndChatSerializer,
    ReportSerializer,
    StartChatSerializer,
)

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
    request=StartChatSerializer,
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
# Cancel Chat Search
# Endpoint : POST /chat/cancel/

cancel_chat_search_doc = extend_schema(
    tags=["Chat"],
    summary="Cancel Chat Search",
    description="""
    Remove the current user from the anonymous chat waiting queue.

    **Purpose**: Releases the caller's queue slot so they cannot be matched while
    they are not actually at the app. Matchmaking itself is unchanged — this only
    undoes the enqueue that `POST /chat/start/` performs when nobody was available.

    **When frontend should call it**:
    - The user taps 'Cancel search'.
    - The app goes to the background while searching (tab switch, minimise,
      screen lock, app switch). The client sends this as a `keepalive` request so
      it still completes after the page is hidden.

    **Authentication requirement**: Bearer Authentication (JWT required).

    **Security behaviour**: Authenticated user only, and the queue entry is keyed
    by the authenticated user — a caller can never dequeue anybody else.

    **Idempotent**: Calling it when the user is not queued is a no-op and still
    returns `200`.

    **Late claims are cleaned up too**: if a partner claimed the caller a moment
    earlier, the room already exists — and the caller, having cancelled, is never
    going to open it. That room is ended here and its other participant receives a
    `chat_ended` event at once, instead of waiting in a chat nobody joins. A
    conversation the caller is actually connected to is never touched.
    """,
    request=CancelChatSearchSerializer,
    responses={
        # 200: The user is no longer in the waiting queue (whether or not they
        # were in it when the call arrived).
        200: OpenApiResponse(
            response=inline_serializer(
                "CancelChatSearchResponse",
                fields={"message": rf_serializers.CharField()},
            ),
            description="The caller is not in the waiting queue.",
            examples=[
                OpenApiExample("Success", value={"message": "Search cancelled."})
            ],
        ),
        # 401: Returned when the request has no valid access token in the Authorization header.
        401: OpenApiResponse(
            description="Unauthorized - Missing or invalid access token."
        ),
        # 429: Returned when the client exceeds 30 requests per minute.
        429: OpenApiResponse(
            description="Too Many Requests - 30 requests/minute limit exceeded."
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
    Accepts `application/json` or `multipart/form-data` — the latter is required when attaching an image.

    * `room_id`: UUID of the chat room in which the incident occurred.
    * `reason`: The category of the report. Must be one of: `spam`, `harassment`, `abusive_language`, `inappropriate_content`, `fake_identity`, `other`.
    * `description` *(optional)*: A detailed explanation of the incident.
    * `evidence_url` *(optional)*: A valid URL pointing to supporting evidence (e.g. a screenshot).
    * `evidence_image` *(optional, multipart)*: A single supporting image. Must be a JPEG, PNG, WEBP or GIF of at most 5 MB. It is uploaded to Cloudinary and the resulting URL is stored as `evidence_url` — nothing is written to local storage. When both fields are sent, the uploaded image wins.

    **Failure behaviour**: If the upload cannot complete, the report is not created and a `502` is returned. If the report is rejected after a successful upload (e.g. a duplicate pending report), the uploaded image is deleted again.
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
        # 502: Returned when the evidence image could not be stored remotely.
        502: OpenApiResponse(
            description="Bad Gateway - The evidence image could not be uploaded. The report was not created; the client may retry."
        ),
    },
)
