from rest_framework import serializers

from .models import PublicSpeaking, PublicSpeakingMessage


class PublicSpeakingSerializer(serializers.ModelSerializer):
    """The room itself. No host, no dates, no participant list — one topic."""

    class Meta:
        model = PublicSpeaking
        fields = ["id", "title", "topic", "is_active"]
        read_only_fields = fields


class PublicSpeakingMessageSerializer(serializers.ModelSerializer):
    """
    One message.

    Exposes only the anonymous display name. There is no participant id, no
    session token and no user object in the payload, so nothing here can be
    used to correlate two messages back to a person beyond the pseudonym they
    were given.
    """

    display_name = serializers.CharField(
        source="participant.display_name", read_only=True
    )
    upvote_count = serializers.IntegerField(read_only=True, default=0)
    has_upvoted = serializers.BooleanField(read_only=True, default=False)
    # True only on the caller's own response, so the client can hide the vote
    # button. Defaults False on broadcasts, which are serialized once for all.
    is_own = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = PublicSpeakingMessage
        fields = [
            "id",
            "content",
            "display_name",
            "upvote_count",
            "has_upvoted",
            "is_own",
            "created_at",
        ]
        read_only_fields = fields


class JoinDiscussionSerializer(serializers.Serializer):
    """Optional token so a returning tab keeps the identity it already has."""

    session_token = serializers.CharField(
        required=False, allow_blank=True, max_length=64
    )
