from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.responses import success_response

from .serializers import (CreateEventSerializer, EventDetailSerializer,
                          EventParticipantSerializer, EventSerializer,
                          JoinEventSerializer, LeaveEventSerializer,
                          UpdateEventSerializer)
from .services import (
    cancel_event,
    create_event,
    get_event,
    join_event,
    leave_event,
    list_events,
    update_event,
)
from .docs import (
    create_event_doc,
    list_events_doc,
    event_detail_doc,
    update_event_doc,
    cancel_event_doc,
    join_event_doc,
    leave_event_doc,
)


class CreateEventAPIView(APIView):
    """
    Create a new event for the authenticated user.
    """

    permission_classes = [IsAuthenticated]

    @create_event_doc
    def post(self, request):
        """
        Create a new event.
        """
        serializer = CreateEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event = create_event(
            user=request.user, validated_data=serializer.validated_data
        )

        response_serializer = EventSerializer(
            event,
        )
        return success_response(
            message="Event created successfully.",
            data=response_serializer.data,
            status_code=201,
        )


class EventListAPIView(APIView):
    """
    Retrieve all active events.
    """

    permission_classes = [IsAuthenticated]

    @list_events_doc
    def get(self, request):
        """
        Return all active events.
        """

        events = list_events()

        serializer = EventSerializer(
            events,
            many=True,
        )

        return success_response(
            message="Events retrieved successfully.",
            data=serializer.data,
        )


class EventDetailAPIView(APIView):
    """
    Retrieve a single event.
    """

    permission_classes = [IsAuthenticated]

    @event_detail_doc
    def get(self, request, pk):

        event = get_event(event_id=pk)

        serializer = EventDetailSerializer(event)

        return success_response(
            message="Event retrieved successfully.",
            data=serializer.data,
        )


class UpdateEventAPIView(APIView):
    """
    Update an existing event.
    """

    permission_classes = [IsAuthenticated]

    @update_event_doc
    def patch(self, request, pk):
        """
        Update an event owned by the authenticated user.
        """
        event = get_event(event_id=pk)

        serializer = UpdateEventSerializer(event, data=request.data, partial=True)

        serializer.is_valid(raise_exception=True)

        event = update_event(
            event=event,
            user=request.user,
            validated_data=serializer.validated_data,
        )

        response_serializer = EventSerializer(event)

        return success_response(
            message="Event updated successfully.",
            data=response_serializer.data,
        )


class CancelEventAPIView(APIView):
    """
    Cancel an existing event.
    """

    permission_classes = [IsAuthenticated]

    @cancel_event_doc
    def delete(self, request, pk):
        """
        Cancel an event owned by the authenticated user.
        """
        event = get_event(event_id=pk)

        cancel_event(
            event=event,
            user=request.user,
        )

        return success_response(
            message="Event cancelled successfully.",
        )


class JoinEventAPIView(APIView):
    """
    Join an active event.
    """

    permission_classes = [IsAuthenticated]

    @join_event_doc
    def post(self, request, pk):
        """
        Add the authenticated user as a participant
        in an active event.
        """

        event = get_event(
            event_id=pk,
        )

        request_serializer = JoinEventSerializer(
            data=request.data,
        )

        request_serializer.is_valid(
            raise_exception=True,
        )

        participant = join_event(
            event=event,
            user=request.user,
        )

        response_serializer = EventParticipantSerializer(
            participant,
        )

        return success_response(
            message="You have joined the event successfully.",
            data=response_serializer.data,
        )


class LeaveEventAPIView(APIView):
    """
    Leave an event.
    """

    permission_classes = [IsAuthenticated]

    @leave_event_doc
    def post(self, request, pk):
        """
        Leave an active event.
        """
        event = get_event(
            event_id=pk,
        )

        request_serializer = LeaveEventSerializer(data=request.data)

        request_serializer.is_valid(raise_exception=True)

        participant = leave_event(
            event=event,
            user=request.user,
        )
        response_serializer = EventParticipantSerializer(participant)

        return success_response(
            message="You have left the event successfully.",
            data=response_serializer.data,
        )
