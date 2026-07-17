from rest_framework import serializers

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
