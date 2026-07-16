from rest_framework import serializers
from apps.users.models import User

class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "is_superuser",
            "is_staff"
        ]

class DashboardStatisticsSerializer(serializers.Serializer):
    users_count = serializers.IntegerField()
    active_users_count = serializers.IntegerField(allow_null=True)
    active_events_count = serializers.IntegerField(allow_null=True)
    pending_reports_count = serializers.IntegerField()
    total_chats_count = serializers.IntegerField()
    total_messages_count = serializers.IntegerField()
    pending_reveal_request_count = serializers.IntegerField()
    blocked_users_count = serializers.IntegerField()