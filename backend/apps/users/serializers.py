from core.validators import IMAGE_FIELD_ERROR_MESSAGES, ImageUploadValidator
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
            "is_active",
        ]


class UpdateProfileSerializer(serializers.Serializer):
    """Validates a profile photo before it is handed to Cloudinary.

    `required=True` is what the view already assumed: it reads
    `validated_data["profile_photo"]` unconditionally, so an absent file used to
    raise KeyError and surface as a 500 instead of a validation error.
    """

    profile_photo = serializers.ImageField(
        required=True,
        error_messages={
            **IMAGE_FIELD_ERROR_MESSAGES,
            "required": "Please select an image to upload.",
        },
        validators=[ImageUploadValidator("Profile photo")],
    )
