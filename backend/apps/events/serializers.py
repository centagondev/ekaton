from django.utils import timezone
from rest_framework import serializers

from .models import Event, EventParticipant


class CreateEventSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new event.
    """

    class Meta:
        model = Event

        fields = (
            "banner",
            "name",
            "description",
            "venue",
            "end_time",
            "is_anonymous_chat",
        )

    def validate_end_time(self, value):
        """
        Ensure the event end time is in the future.
        """
        if value <= timezone.now():
            raise serializers.ValidationError(
                "The event end time must be in the future."
            )

        return value


class UpdateEventSerializer(serializers.ModelSerializer):
    """
    Serializer for updating an existing event.
    """

    class Meta:
        model = Event

        fields = (
            "banner",
            "name",
            "description",
            "venue",
            "end_time",
            "is_anonymous_chat",
        )

    def validate_end_time(self, value):
        """
        Ensure the updated end time is in the future.
        """
        if value <= timezone.now():
            raise serializers.ValidationError(
                "The event end time must be in the future."
            )
        return value


class EventParticipantSerializer(serializers.ModelSerializer):
    """
    Serializer used to represent an event participant.
    """

    user = serializers.ReadOnlyField(source="user.full_name")

    class Meta:
        model = EventParticipant

        fields = (
            "id",
            "user",
            "anonymous_name",
            "is_active",
            "joined_at",
            "left_at",
        )

        read_only_fields = fields


class EventSerializer(serializers.ModelSerializer):
    """
    Serializer used to represent an event.
    """

    owner = serializers.ReadOnlyField(source="owner.full_name")

    class Meta:
        model = Event

        fields = (
            "id",
            "owner",
            "banner",
            "name",
            "description",
            "venue",
            "end_time",
            "is_anonymous_chat",
            "status",
            "created_at",
        )

        read_only_fields = (
            "id",
            "owner",
            "status",
            "created_at",
        )


class EventDetailSerializer(EventSerializer):
    """
    Detailed serializer for an event.
    """

    participant_count = serializers.SerializerMethodField()

    class Meta(EventSerializer.Meta):
        fields = EventSerializer.Meta.fields + ("participant_count",)

    def get_participant_count(self, obj):
        """
        Return the number of active participants for the event.

        Uses the prefetched ``participants`` queryset attached by ``get_event()``
        in the service layer, so no additional database query is issued.
        """
        return len(obj.participants.all())  # uses prefeched cache,no extra query


class JoinEventSerializer(serializers.Serializer):
    """
    Serializer for joining an event.

    No request body is required.
    """

    pass


class LeaveEventSerializer(serializers.Serializer):
    """
    Serializer for leaving an event.

    No request body is required.
    """

    pass
