from rest_framework import serializers

from .models import PrivateChatRoom, PrivateMessage, Report, RevealRequest


class PrivateChatRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivateChatRoom
        fields = [
            "id",
            "status",
            "reveal_completed",
            "closed_at",
            "created_at",
        ]


class PrivateMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivateMessage
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


class RevealRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RevealRequest
        fields = [
            "id",
            "room",
            "requester",
            "receiver",
            "status",
            "responded_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class ReportSerializer(serializers.ModelSerializer):
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
   pass

class EndChatSerializer(serializers.Serializer):
    room_id = serializers.CharField()

class RevealRequestSerializer(serializers.Serializer):
    room_id = serializers.CharField()

class RevealResponseSerializer(serializers.Serializer):
    reveal_request_id =serializers.UUIDField()
    status = serializers.CharField(
        choice=[
            "accepted",
            "rejected"
        ]
    )

class ReportSerializer(serializers.Serializer):
    room_id =serializers.UUIDField()
    reason = serializers.CharField(max_length=255)
    description = serializers.CharField(
        required =False,
        allow_blank = True
    )

    evidece_url =serializers.URLField(
        required=False,
        allow_blank =True
    )