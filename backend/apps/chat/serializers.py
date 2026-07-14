from rest_framework import serializers

from .models import PrivateChatRoom, PrivateMessage, Report, RevealRequest


class PrivateChatRoomSerializer(serializers.ModelSerializer):
    """Serializes a PrivateChatRoom instance for API responses.

    Exposes only the fields required by the client. User identities (user_one
    and user_two) are intentionally excluded to preserve chat anonymity until
    a reveal is accepted.
    """

    class Meta:
        model = PrivateChatRoom
        fields = [
            "id",
            "status",
            "reveal_completed",
            "created_at",
            "updated_at",
            "closed_at",
        ]


class PrivateMessageSerializer(serializers.ModelSerializer):
    """Serializes a PrivateMessage instance for API responses.

    The `id`, `created_at`, and `updated_at` fields are read-only and are
    always set by the server.
    """

    class Meta:
        model = PrivateMessage
        fields = [
            "id",
            "room",
            "sender",
            "message",
            "message_type",
            "is_read",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class ReportSerializer(serializers.ModelSerializer):
    """Serializes a Report instance for API responses.

    The `id`, `created_at`, and `updated_at` fields are read-only and are
    always set by the server.
    """

    class Meta:
        model = Report
        fields = [
            "id",
            "room",
            "reporter",
            "reported_user",
            "reason",
            "description",
            "evidence_url",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class StartChatSerializer(serializers.Serializer):
    """Serializer for the Start Chat endpoint.

    No input fields are required. Authentication is enforced at the view level.
    """

    pass


class EndChatSerializer(serializers.Serializer):
    """Serializer for the End Chat endpoint.

    Attributes:
        room_id: The UUID string of the chat room to end.
    """

    room_id = serializers.CharField()


class RevealRequestSerializer(serializers.Serializer):
    """Serializer for initiating a reveal identity request.

    Attributes:
        room_id: The UUID string of the active chat room in which to send
            the reveal request.
    """

    room_id = serializers.CharField()


class RevealResponseSerializer(serializers.Serializer):
    """Serializer for responding to a reveal identity request.

    Attributes:
        reveal_request_id: The UUID of the reveal request being responded to.
        status: The response decision. Must be either 'accepted' or 'rejected'.
    """

    reveal_request_id = serializers.UUIDField()
    status = serializers.ChoiceField(
        choices=RevealRequest.Status.choices,
    )
