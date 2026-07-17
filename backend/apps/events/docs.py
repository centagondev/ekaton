"""
OpenAPI Schema definitions for the Events module.

This file contains all the drf-spectacular decorators used to generate
the Swagger and ReDoc documentation for the events endpoints.
By keeping these decorators here, we maintain clean and readable view classes.
"""

from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers

from .serializers import (
    CreateEventSerializer,
    EventDetailSerializer,
    EventParticipantSerializer,
    EventSerializer,
    JoinEventSerializer,
    LeaveEventSerializer,
    UpdateEventSerializer,
)


# Event Management Documentation
# ==============================================================================

create_event_doc = extend_schema(
    tags=["Events"],
    summary="Create Event",
    description="Create a new event. The authenticated user is automatically assigned as the owner.",
    request=CreateEventSerializer,
    responses={
        201: EventSerializer,
        400: OpenApiResponse(description="Validation Error"),
        401: OpenApiResponse(description="Unauthorized"),
    },
)

list_events_doc = extend_schema(
    tags=["Events"],
    summary="List Events",
    description="Retrieve a list of all active events, ordered by creation time.",
    responses={
        200: EventSerializer(many=True),
        401: OpenApiResponse(description="Unauthorized"),
    },
)

event_detail_doc = extend_schema(
    tags=["Events"],
    summary="Get Event Details",
    description="Retrieve the details of a single event by its UUID.",
    responses={
        200: EventDetailSerializer,
        401: OpenApiResponse(description="Unauthorized"),
        404: OpenApiResponse(description="Not Found"),
    },
)

update_event_doc = extend_schema(
    tags=["Events"],
    summary="Update Event",
    description="Update an existing active event. Only the owner can perform this action.",
    request=UpdateEventSerializer,
    responses={
        200: EventSerializer,
        400: OpenApiResponse(description="Validation Error"),
        401: OpenApiResponse(description="Unauthorized"),
        403: OpenApiResponse(description="Permission Denied"),
        404: OpenApiResponse(description="Not Found"),
    },
)

cancel_event_doc = extend_schema(
    tags=["Events"],
    summary="Cancel Event",
    description="Cancel an active event. Only the owner can perform this action. Active participants are marked as inactive.",
    responses={
        200: inline_serializer(
            name="CancelEventResponse",
            fields={"message": serializers.CharField()},
        ),
        401: OpenApiResponse(description="Unauthorized"),
        403: OpenApiResponse(description="Permission Denied"),
        404: OpenApiResponse(description="Not Found"),
    },
)


# Event Participation Documentation
# ==============================================================================

join_event_doc = extend_schema(
    tags=["Events"],
    summary="Join Event",
    description="Add the authenticated user as a participant in an active event.",
    request=JoinEventSerializer,
    responses={
        200: EventParticipantSerializer,
        400: OpenApiResponse(description="Validation Error"),
        401: OpenApiResponse(description="Unauthorized"),
        404: OpenApiResponse(description="Not Found"),
    },
)

leave_event_doc = extend_schema(
    tags=["Events"],
    summary="Leave Event",
    description="Remove the authenticated user from an active event.",
    request=LeaveEventSerializer,
    responses={
        200: EventParticipantSerializer,
        400: OpenApiResponse(description="Validation Error"),
        401: OpenApiResponse(description="Unauthorized"),
        404: OpenApiResponse(description="Not Found"),
    },
)
