from django.utils import timezone
from rest_framework import serializers

from .models import MAX_MESSAGE_LENGTH, Event, EventMessage, EventParticipant

# Shown when an anonymous event has a participant with no anonymous identity.
# Falling back to the real name here would de-anonymise them, so it never does.
ANONYMOUS_FALLBACK_NAME = "Anonymous Participant"

# A quote shows only one line on screen, so sending the full message would
# download text nobody sees — and history loads 150 messages at a time.
REPLY_PREVIEW_LENGTH = 120


def sender_display_name(event, participant):
    """
    Return the name a participant is shown under inside an event.

    Used by both the message and the quote inside a reply. Written once so the
    two can never disagree — a second copy could end up showing real names in
    an anonymous event.

    The event is passed in rather than read off the participant so a reply can
    resolve its quote against the event being viewed.
    """
    if event.is_anonymous_chat:
        if participant.anonymous_name is None:
            return ANONYMOUS_FALLBACK_NAME

        return participant.anonymous_name.display_name

    return participant.user.full_name


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

    owner = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()

    class Meta:
        model = Event

        fields = (
            "id",
            "owner",
            "is_owner",
            "banner",
            "name",
            "description",
            "venue",
            "end_time",
            "is_anonymous_chat",
            "status",
            "participant_count",
            "created_at",
        )

        read_only_fields = (
            "id",
            "owner",
            "status",
            "created_at",
        )

    def get_owner(self, obj):
        """
        Return the event owner's display name.

        - Anonymous events → None, so the host's real name never leaves
          the backend. The frontend shows its own "Anonymous host" label.
        - Normal events → owner's full name.
        """
        if obj.is_anonymous_chat:
            return None

        return obj.owner.full_name

    def get_is_owner(self, obj) -> bool:
        """
        Return whether the requesting user owns this event.

        The client cannot work this out from ``owner``: that field is a
        display name, so two users sharing a name would both be shown the
        owner-only controls and both be refused by the service layer.

        Returns False when no request is in the serializer context, which
        keeps the owner controls hidden rather than showing them to
        everyone.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if user is None or not user.is_authenticated:
            return False

        return obj.owner_id == user.id

    def get_participant_count(self, obj) -> int:
        """
        Return the number of active participants for the event.

        Reads the annotation added by ``list_events()`` when it is present
        and falls back to the ``participants`` prefetch attached by
        ``get_event()``. Both avoid a query per event; the final fallback
        only runs for a freshly created event, which has neither.
        """
        annotated = getattr(obj, "participant_count", None)

        if annotated is not None:
            return annotated

        return len(obj.participants.all())  # uses prefeched cache,no extra query


class EventDetailSerializer(EventSerializer):
    """
    Detailed serializer for an event.

    Kept separate from ``EventSerializer`` so the detail endpoint can carry
    fields the list endpoint should not have to pay for.
    """

    class Meta(EventSerializer.Meta):
        pass


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
    
    reply_to = serializers.UUIDField(required=False, allow_null=True)


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
    reply_to = serializers.SerializerMethodField()

    class Meta:
        model = EventMessage
        fields = (
            "id",
            "sender_name",
            "content",
            "created_at",
            "reply_to",
        )

    def get_sender_name(self, obj):
        return sender_display_name(obj.event, obj.participant)

    def get_reply_to(self, obj):
        """
        Return a short quote of the message this one replies to.

        None means either "not a reply" or "the original is gone".

        The quote never includes its own reply_to, so a reply to a reply
        shows only its direct parent instead of a whole chain.

        The name is resolved against THIS event, not the quoted message's own
        event. The service only ever links messages inside one event, so the
        two are the same — but reading the local one means an anonymous event
        can never render a real name, whatever row it is handed.
        """
        if obj.reply_to is None:
            return None

        # Comparing the id columns already loaded on both rows, so no query.
        if obj.reply_to.event_id != obj.event_id:
            return None

        return {
            "id": str(obj.reply_to.id),
            "sender_name": sender_display_name(obj.event, obj.reply_to.participant),
            "content": obj.reply_to.content[:REPLY_PREVIEW_LENGTH],
        }
