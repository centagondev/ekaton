from rest_framework import serializers


class CheckEmailSerializer(serializers.Serializer):
    """Serializer to validate the email address for status checks."""

    email = serializers.EmailField()


class SetPasswordSerializer(serializers.Serializer):
    """Serializer to handle and validate password setup for an unverified user."""

    token = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        """Validates the input data and ensures passwords match."""
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match.")

        return attrs


class LoginSerializer(serializers.Serializer):
    """Serializer to validate user login credentials."""

    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate(self, attrs):
        """Validates  password is provided."""
        password = attrs.get("password")

        if not password:
            raise serializers.ValidationError({"password": "A password is required."})

        return attrs


class LogoutSerializer(serializers.Serializer):
    """Serializer to validate the refresh token submitted during logout."""

    refresh = serializers.CharField()
