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
    online_users_count = serializers.IntegerField()
    active_events_count = serializers.IntegerField()
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
    """
    Serializer for creating an event from the admin dashboard.
    """

    owner = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True)
    )

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
        if len(value) > 100:
            raise serializers.ValidationError("Name cannot exceed 100 characters.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Description cannot be blank.")
        if len(value) < 10:
            raise serializers.ValidationError(
                "Description must be at least 10 characters long."
            )
        if len(value) > 1000:
            raise serializers.ValidationError(
                "Description cannot exceed 1000 characters."
            )
        return value

    def validate_venue(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Venue cannot be blank.")
        if len(value) < 3:
            raise serializers.ValidationError(
                "Venue must be at least 3 characters long."
            )
        if len(value) > 200:
            raise serializers.ValidationError("Venue cannot exceed 200 characters.")
        return value

    def validate_end_time(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("End time must be in the future.")
        return value


class AdminUpdateEventSerializer(serializers.ModelSerializer):
    """
    Serializer for updating an event from the admin dashboard.
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
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError(
                "Name must be at least 3 characters long."
            )
        if len(value) > 100:
            raise serializers.ValidationError("Name cannot exceed 100 characters.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Description cannot be blank.")
        if len(value) < 10:
            raise serializers.ValidationError(
                "Description must be at least 10 characters long."
            )
        if len(value) > 1000:
            raise serializers.ValidationError(
                "Description cannot exceed 1000 characters."
            )
        return value

    def validate_venue(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Venue cannot be blank.")
        if len(value) < 3:
            raise serializers.ValidationError(
                "Venue must be at least 3 characters long."
            )
        if len(value) > 200:
            raise serializers.ValidationError("Venue cannot exceed 200 characters.")
        return value

    def validate_end_time(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("End time must be in the future.")
        return value
