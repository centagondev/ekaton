from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.responses import success_response
from django.shortcuts import get_object_or_404
from rest_framework.generics import GenericAPIView
from .models import Event, EventParticipant, EventMessage

from .serializers import (CreateEventSerializer, EventDetailSerializer,
                          EventParticipantSerializer, EventSerializer,
                          JoinEventSerializer, LeaveEventSerializer,
                          UpdateEventSerializer,EventMessageCreateSerializer,
                          EventMessageSerializer)
from .services import (
    cancel_event,
    create_event,
    get_event,
    join_event,
    leave_event,
    list_events,
    update_event,
    send_event_message
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

class EventMessageAPIView(GenericAPIView):
    """
    API for retrieving and sending event chat messages.
    """
    permission_classes=[IsAuthenticated]
    
    def get_serializer_class(self):
        """
        Return the serializer class based on the request method.
        """
        if self.request.method == "POST":
            
            return EventMessageCreateSerializer
        
        return EventMessageSerializer
    
    def get_event(self):
        """
        Return the requested event.
        """
        return get_object_or_404(
    Event,
    pk=self.kwargs["event_id"],
)
    
    def get_participant(self,event):
        """
        Return the authenticated user's participant record.
        """
        return get_object_or_404(EventParticipant,event=event,user=self.request.user)
    
    def get_messages(self,event):
        """
        Return all messages for the given event.
        """
        return (EventMessage.objects.filter(event=event).select_related("participant","participant__user").order_by("created_at"))
    
    def get(self,request,*args,**kwargs):
        """
        Retrieve all messages for an event.
        """
        event=self.get_event()
        
        # Ensure the authenticated user is a participant.
        self.get_participant(event)
        
        messages=self.get_messages(event)
        
        serializer=self.get_serializer(messages,many=True)
        
        return success_response(
            data=serializer.data,
            message="Messages retrieved successfully.",
        )
        
    def post(self, request, *args, **kwargs):
        """
        Send a message to an event.
        """

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event = self.get_event()

        participant = self.get_participant(event)

        message = send_event_message(
            participant=participant,
            content=serializer.validated_data["content"],
        )

        response_serializer = EventMessageSerializer(message)

        return success_response(
            message="Message sent successfully.",
            data=response_serializer.data,
            status_code=201,
        )
        
        
        