import re

from django.core.exceptions import ValidationError


class StrongPasswordValidator:
    def validate(self, password, user=None):
        if len(password) < 8:
            raise ValidationError(
                "Password must be at least 8 characters long."
            )

        if not re.search(r"[A-Z]", password):
            raise ValidationError(
                "Password must contain at least one uppercase letter."
            )

        if not re.search(r"[a-z]", password):
            raise ValidationError(
                "Password must contain at least one lowercase letter."
            )

        if not re.search(r"\d", password):
            raise ValidationError(
                "Password must contain at least one number."
            )

        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]", password):
            raise ValidationError(
                "Password must contain at least one special character."
            )

    def get_help_text(self):
        return (
            "Password must contain at least 8 characters, "
            "one uppercase letter, one lowercase letter, "
            "one number, and one special character."
        )