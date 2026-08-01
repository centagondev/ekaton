import re

from django.core.exceptions import ValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

# Ceiling for any user-supplied image before it reaches Cloudinary. Kept here
# rather than per-app so the profile photo and report evidence flows can never
# drift apart. Mirrored client-side in frontend/src/lib/images.ts.
MAX_IMAGE_UPLOAD_SIZE = 2 * 1024 * 1024

# JPG and JPEG are the same format; browsers send "image/jpeg" for both, but
# "image/jpg" appears often enough in the wild to be worth accepting.
ALLOWED_IMAGE_CONTENT_TYPES = (
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
)

UNSUPPORTED_IMAGE_TYPE_MESSAGE = "Only JPG, JPEG, PNG, and WEBP images are allowed."

INVALID_IMAGE_MESSAGE = "Please select a valid image."

# DRF's own ImageField copy is technical ("...either not an image or a corrupted
# image"). Every upload field overrides it with the same plain sentence.
IMAGE_FIELD_ERROR_MESSAGES = {
    "invalid_image": INVALID_IMAGE_MESSAGE,
    "invalid": INVALID_IMAGE_MESSAGE,
    "empty": INVALID_IMAGE_MESSAGE,
    "no_name": INVALID_IMAGE_MESSAGE,
}


class ImageUploadValidator:
    """Reject uploads that are not a supported format or exceed the size cap.

    DRF's ImageField already proves the payload decodes as an image (Pillow),
    which the declared content type alone does not. This adds the two checks it
    does not make: an allow-list of formats, and a byte ceiling.

    `label` names the field in the size message, so the reporter reads
    "Evidence image must be smaller than 2 MB" and not a generic one.
    """

    def __init__(self, label="Image", max_size=MAX_IMAGE_UPLOAD_SIZE):
        self.label = label
        self.max_size = max_size

    def __call__(self, image):
        content_type = (getattr(image, "content_type", "") or "").lower()

        if content_type and content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
            raise DRFValidationError(UNSUPPORTED_IMAGE_TYPE_MESSAGE)

        if image.size > self.max_size:
            raise DRFValidationError(
                f"{self.label} must be smaller than "
                f"{self.max_size // (1024 * 1024)} MB."
            )

        return image


class StrongPasswordValidator:
    def validate(self, password, user=None):
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long.")

        if not re.search(r"[A-Z]", password):
            raise ValidationError(
                "Password must contain at least one uppercase letter."
            )

        if not re.search(r"[a-z]", password):
            raise ValidationError(
                "Password must contain at least one lowercase letter."
            )

        if not re.search(r"\d", password):
            raise ValidationError("Password must contain at least one number.")

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
