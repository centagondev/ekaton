import io
from unittest.mock import patch

from core.validators import MAX_IMAGE_UPLOAD_SIZE
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

FAKE_UPLOAD = {
    "url": "https://res.cloudinary.com/demo/image/upload/v1/profile/new.png",
    "public_id": "profile/new",
}


def image_file(name="photo.png", image_format="PNG", size=(24, 24)):
    """A small, genuinely decodable upload — DRF's ImageField runs Pillow on it."""
    buffer = io.BytesIO()
    Image.new("RGB", size, "green").save(buffer, format=image_format)
    return SimpleUploadedFile(
        name,
        buffer.getvalue(),
        content_type=f"image/{image_format.lower()}",
    )


def oversize_image_file():
    """A valid PNG larger than the cap — random noise so it cannot compress down."""
    import random

    side = 1200
    image = Image.new("RGB", (side, side))
    image.putdata(
        [
            (random.randrange(256), random.randrange(256), random.randrange(256))
            for _ in range(side * side)
        ]
    )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    assert len(buffer.getvalue()) > MAX_IMAGE_UPLOAD_SIZE
    return SimpleUploadedFile("big.png", buffer.getvalue(), content_type="image/png")


class ProfilePhotoUploadTests(APITestCase):
    """Covers validation and the stored result of a profile photo upload."""

    def setUp(self):
        self.url = reverse("users:me")
        self.user = get_user_model().objects.create_user(
            email="owner@example.com",
            password="StrongPass123!",
            full_name="Owner User",
            batch="2024",
            gender="male",
            is_verified=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_valid_upload_stores_the_cloudinary_url(self):
        with patch(
            "apps.users.services.upload_image", return_value=FAKE_UPLOAD
        ) as upload:
            response = self.client.patch(
                self.url,
                {"profile_photo": image_file()},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        upload.assert_called_once()
        self.user.refresh_from_db()
        self.assertEqual(self.user.profile_photo, FAKE_UPLOAD["url"])
        self.assertEqual(self.user.profile_photo_public_id, FAKE_UPLOAD["public_id"])
        # The response is what the client renders from, so it must already
        # carry the new URL — no second fetch required to see the photo.
        self.assertEqual(response.data["data"]["profile_photo"], FAKE_UPLOAD["url"])

    def test_get_returns_the_new_url_immediately_after_upload(self):
        with patch("apps.users.services.upload_image", return_value=FAKE_UPLOAD):
            self.client.patch(
                self.url, {"profile_photo": image_file()}, format="multipart"
            )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["profile_photo"], FAKE_UPLOAD["url"])

    def test_missing_file_is_a_validation_error_not_a_crash(self):
        with patch("apps.users.services.upload_image") as upload:
            response = self.client.patch(self.url, {}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("profile_photo", response.data)
        upload.assert_not_called()

    def test_unsupported_image_format_is_rejected(self):
        # A BMP decodes fine, so this exercises the format allow-list rather
        # than ImageField's "is it an image at all" check.
        with patch("apps.users.services.upload_image") as upload:
            response = self.client.patch(
                self.url,
                {"profile_photo": image_file("photo.bmp", image_format="BMP")},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["profile_photo"][0]),
            "Only JPG, JPEG, PNG, and WEBP images are allowed.",
        )
        upload.assert_not_called()

    def test_non_image_payload_is_rejected(self):
        with patch("apps.users.services.upload_image") as upload:
            response = self.client.patch(
                self.url,
                {
                    "profile_photo": SimpleUploadedFile(
                        "photo.png",
                        b"definitely not an image",
                        content_type="image/png",
                    )
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["profile_photo"][0]), "Please select a valid image."
        )
        upload.assert_not_called()

    def test_image_over_two_megabytes_is_rejected(self):
        with patch("apps.users.services.upload_image") as upload:
            response = self.client.patch(
                self.url,
                {"profile_photo": oversize_image_file()},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(response.data["profile_photo"][0]),
            "Profile photo must be smaller than 2 MB.",
        )
        upload.assert_not_called()

    def test_webp_and_jpeg_are_accepted(self):
        for image_format in ("WEBP", "JPEG"):
            with self.subTest(image_format=image_format):
                with patch(
                    "apps.users.services.upload_image", return_value=FAKE_UPLOAD
                ):
                    response = self.client.patch(
                        self.url,
                        {
                            "profile_photo": image_file(
                                f"photo.{image_format.lower()}",
                                image_format=image_format,
                            )
                        },
                        format="multipart",
                    )

                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_upload_requires_authentication(self):
        self.client.force_authenticate(user=None)

        with patch("apps.users.services.upload_image") as upload:
            response = self.client.patch(
                self.url, {"profile_photo": image_file()}, format="multipart"
            )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        upload.assert_not_called()
