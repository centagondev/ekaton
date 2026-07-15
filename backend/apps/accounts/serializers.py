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


class ForgotPasswordSerializer(serializers.Serializer):
    """Validate password reset requests.

    Validates only the email format. User existence, verification status,
    and account status checks are delegated to the service layer.
    """

    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    """Validate password reset data."""

    token = serializers.CharField()

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    confirm_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate(self, attrs):

        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        return attrs


class ResendPasswordResetSerializer(serializers.Serializer):
    """Validate password reset email resend requests."""

    email = serializers.EmailField()


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for validating password change requests."""

    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        """Validates that the new password and confirmation password match."""
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {
                    "confirm_password": "The new password and confirmation password do not match."
                }
            )
        return attrs
