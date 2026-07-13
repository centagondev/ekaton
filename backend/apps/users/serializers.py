from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user details."""

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "batch",
            "gender",
            "profile_photo",
            "is_available",
            "is_verified",
        ]
