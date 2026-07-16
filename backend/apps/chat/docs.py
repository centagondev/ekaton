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
"""

from drf_spectacular.utils import (OpenApiExample, OpenApiResponse,
                                   extend_schema, inline_serializer)
from rest_framework import serializers as rf_serializers

from .serializers import EndChatSerializer

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
