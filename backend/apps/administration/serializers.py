from django.utils import timezone
from rest_framework import serializers

from apps.chat.models import Report
from apps.events.models import Event
from apps.users.models import User


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email", "is_superuser", "is_staff"]


class DashboardStatisticsSerializer(serializers.Serializer):
    users_count = serializers.IntegerField()
    active_users_count = serializers.IntegerField(allow_null=True)
    active_events_count = serializers.IntegerField(allow_null=True)
    pending_reports_count = serializers.IntegerField()
    total_chats_count = serializers.IntegerField()
    total_messages_count = serializers.IntegerField()
    pending_reveal_request_count = serializers.IntegerField()
    blocked_users_count = serializers.IntegerField()


class AdminUserUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(required=False)
    batch = serializers.CharField(required=False)
    gender = serializers.ChoiceField(choices=["male", "female"], required=False)

    profile_photo = serializers.URLField(
        required=False,
        allow_null=True,
        allow_blank=True,
    )

    is_active = serializers.BooleanField(required=False)
    is_verified = serializers.BooleanField(required=False)


class AdminCreateUserSerializer(serializers.Serializer):

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    batch = serializers.CharField(max_length=100)
    gender = serializers.ChoiceField(choices=User.Gender.choices)


class AdminreportUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "email"]


class AdminReportSerializer(serializers.ModelSerializer):
    reporter = AdminreportUserSerializer(read_only=True)
    reported_user = AdminreportUserSerializer(read_only=True)

    class Meta:
        model = Report
        fields = [
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


class AdminUpdateReportStatusSerializer(serializers.Serializer):

    status = serializers.ChoiceField(choices=Report.Status.choices)


class AdminEventSerializer(serializers.ModelSerializer):
    """
    Serializer for listing events in the admin dashboard.
    """

    owner = serializers.CharField(
        source="owner.full_name",
        read_only=True,
    )

    participant_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Event

        fields = (
            "id",
            "owner",
            "banner",
            "name",
            "venue",
            "status",
            "is_anonymous_chat",
            "end_time",
            "participant_count",
            "created_at",
        )


class AdminEventDetailSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()
    participant_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Event
        fields = (
            "id",
            "owner",
            "banner",
            "name",
            "description",
            "venue",
            "status",
            "is_anonymous_chat",
            "end_time",
            "participant_count",
            "created_at",
            "updated_at",
        )

    def get_owner(self, obj):
        return {
            "id": obj.owner.id,
            "full_name": obj.owner.full_name,
            "email": obj.owner.email,
        }


class AdminCreateEventSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True)
    )

    class Meta:
        model = Event
        fields = (
            "owner",
            "banner",
            "name",
            "description",
            "venue",
            "end_time",
            "is_anonymous_chat",
        )

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError(
                "Name must be at least 3 characters long."
            )
        return value

    def validate_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Description cannot be blank.")
        return value

    def validate_venue(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Venue cannot be blank.")
        return value

    def validate_end_time(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("End time must be in the future.")
        return value


class AdminUpdateEventSerializer(serializers.ModelSerializer):
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
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError(
                "Name must be at least 3 characters long."
            )
        return value

    def validate_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Description cannot be blank.")
        return value

    def validate_venue(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Venue cannot be blank.")
        return value

    def validate_end_time(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("End time must be in the future.")
        return value
