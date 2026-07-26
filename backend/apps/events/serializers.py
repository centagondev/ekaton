from django.utils import timezone
from rest_framework import serializers

from .models import MAX_MESSAGE_LENGTH, Event, EventMessage, EventParticipant

# Shown when an anonymous event has a participant with no anonymous identity.
# Falling back to the real name here would de-anonymise them, so it never does.
ANONYMOUS_FALLBACK_NAME = "Anonymous Participant"


class BaseEventSerializer(serializers.ModelSerializer):
    """
    Base serializer holding the validation shared by
    creating and updating an event.
    """

    # allow_blank lets an empty value reach validate_* below,
    # so the error message comes from our own check.
    name = serializers.CharField(
        trim_whitespace=True,
        allow_blank=True,
    )

    description = serializers.CharField(
        trim_whitespace=True,
        allow_blank=True,
    )

    venue = serializers.CharField(
        trim_whitespace=True,
        allow_blank=True,
    )

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

    def validate_name(self, value):
        """
        Ensure the event name is not empty and has a valid length.
        """
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Event name cannot be empty.")

        if len(value) < 3:
            raise serializers.ValidationError(
                "Event name must be at least 3 characters long."
            )

        if len(value) > 100:
            raise serializers.ValidationError(
                "Event name cannot exceed 100 characters."
            )

        return value

    def validate_description(self, value):
        """
        Ensure the event description is not empty and has a valid length.
        """
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Event description cannot be empty.")

        if len(value) < 10:
            raise serializers.ValidationError(
                "Event description must be at least 10 characters long."
            )

        if len(value) > 1000:
            raise serializers.ValidationError(
                "Event description cannot exceed 1000 characters."
            )

        return value

    def validate_venue(self, value):
        """
        Ensure the event venue is not empty and has a valid length.
        """
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Event venue cannot be empty.")

        if len(value) < 3:
            raise serializers.ValidationError(
                "Event venue must be at least 3 characters long."
            )

        if len(value) > 200:
            raise serializers.ValidationError(
                "Event venue cannot exceed 200 characters."
            )

        return value

    def validate_end_time(self, value):
        """
        Ensure the event end time is in the future.
        """
        if value <= timezone.now():
            raise serializers.ValidationError(
                "The event end time must be in the future."
            )

        return value


class CreateEventSerializer(BaseEventSerializer):
    """
    Serializer for creating a new event.
    """

    class Meta(BaseEventSerializer.Meta):
        pass


class UpdateEventSerializer(BaseEventSerializer):
    """
    Serializer for updating an existing event.

    ``is_anonymous_chat`` is deliberately not updatable. Participants and
    messages are rendered against the event's current mode, so turning it
    off would reveal the real names behind messages that were sent
    anonymously, and turning it on would leave everyone who already joined
    without an anonymous identity.
    """

    class Meta(BaseEventSerializer.Meta):
        fields = (
            "banner",
            "name",
            "description",
            "venue",
            "end_time",
        )


class EventParticipantSerializer(serializers.ModelSerializer):
    """
    Serializer used to represent an event participant.
    """

    display_name = serializers.SerializerMethodField()

    class Meta:
        model = EventParticipant

        fields = (
            "id",
            "display_name",
            "is_active",
            "joined_at",
            "left_at",
        )

        read_only_fields = fields

    def get_display_name(self, obj):
        """
        Return the participant's display name.

        - Anonymous events → anonymous identity.
        - Normal events → user's full name.
        """

        if obj.event.is_anonymous_chat:
            if obj.anonymous_name is None:
                return ANONYMOUS_FALLBACK_NAME

            return obj.anonymous_name.display_name

        return obj.user.full_name


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


class EventMessageCreateSerializer(serializers.Serializer):
    """
    Validate incoming event chat messages.
    """

    content = serializers.CharField(
        max_length=MAX_MESSAGE_LENGTH,
        trim_whitespace=True,
    )

    def validate_content(self, value: str):
        """
        Ensure the message is not empty after trimming whitespace.
        """
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Message content cannot be empty.")

        return value


class EventMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()

    class Meta:
        model = EventMessage
        fields = (
            "id",
            "sender_name",
            "content",
            "created_at",
        )

    def get_sender_name(self, obj):
        if obj.event.is_anonymous_chat:
            if obj.participant.anonymous_name is None:
                return ANONYMOUS_FALLBACK_NAME

            return obj.participant.anonymous_name.display_name

        return obj.participant.user.full_name
