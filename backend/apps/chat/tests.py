import io
from unittest.mock import patch

from apps.chat.models import PrivateChatRoom, Report
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

# Stand-in for core.cloudinary.upload_image's return value.
FAKE_UPLOAD = {
    "url": "https://res.cloudinary.com/demo/image/upload/v1/reports/evidence/abc.png",
    "public_id": "reports/evidence/abc",
}


def image_file(name="evidence.png", size=(24, 24), image_format="PNG"):
    """A small, genuinely decodable upload — DRF's ImageField runs Pillow on it."""
    buffer = io.BytesIO()
    Image.new("RGB", size, "red").save(buffer, format=image_format)
    return SimpleUploadedFile(
        name,
        buffer.getvalue(),
        content_type=f"image/{image_format.lower()}",
    )


class ReportEvidenceUploadTests(APITestCase):
    """Covers the evidence image attached to a moderation report.

    The contract under test: the file goes to Cloudinary, only the resulting
    URL is persisted, and an upload is never left orphaned behind a report that
    was not created.
    """

    def setUp(self):
        cache.clear()
        self.url = reverse("report-user")
        self.reporter = self.create_user("reporter@example.com", "Reporter One")
        self.partner = self.create_user("partner@example.com", "Partner Two")
        self.room = PrivateChatRoom.objects.create(
            user_one=self.reporter,
            user_two=self.partner,
        )
        self.client.force_authenticate(user=self.reporter)

    def create_user(self, email, full_name):
        return get_user_model().objects.create_user(
            email=email,
            password="StrongPass123!",
            full_name=full_name,
            batch="2024",
            gender="male",
            is_verified=True,
        )

    def test_uploads_the_image_and_stores_only_its_url(self):
        with patch(
            "apps.chat.services.upload_image", return_value=FAKE_UPLOAD
        ) as upload:
            response = self.client.post(
                self.url,
                {
                    "room_id": str(self.room.id),
                    "reason": Report.ReportReason.SPAM,
                    "description": "Sent the same link ten times.",
                    "evidence_image": image_file(),
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        upload.assert_called_once()
        self.assertEqual(upload.call_args.args[1], "reports/evidence")
        self.assertEqual(Report.objects.get().evidence_url, FAKE_UPLOAD["url"])

    def test_json_request_without_a_file_is_unaffected(self):
        response = self.client.post(
            self.url,
            {
                "room_id": str(self.room.id),
                "reason": Report.ReportReason.HARASSMENT,
                "evidence_url": "https://example.com/screenshot.png",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Report.objects.get().evidence_url,
            "https://example.com/screenshot.png",
        )

    def test_uploaded_image_is_deleted_when_the_report_is_rejected(self):
        Report.objects.create(
            room=self.room,
            reporter=self.reporter,
            reported_user=self.partner,
            reason=Report.ReportReason.SPAM,
            status=Report.Status.PENDING,
        )

        with (
            patch("apps.chat.services.upload_image", return_value=FAKE_UPLOAD),
            patch("apps.chat.services.delete_image") as delete,
        ):
            response = self.client.post(
                self.url,
                {
                    "room_id": str(self.room.id),
                    "reason": Report.ReportReason.SPAM,
                    "evidence_image": image_file(),
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        delete.assert_called_once_with(FAKE_UPLOAD["public_id"])
        self.assertEqual(Report.objects.count(), 1)

    def test_upload_failure_returns_502_and_creates_no_report(self):
        with patch(
            "apps.chat.services.upload_image",
            side_effect=RuntimeError("cloudinary unreachable"),
        ):
            response = self.client.post(
                self.url,
                {
                    "room_id": str(self.room.id),
                    "reason": Report.ReportReason.SPAM,
                    "evidence_image": image_file(),
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(Report.objects.count(), 0)

    def test_no_upload_is_attempted_for_a_room_the_user_is_not_in(self):
        outsider = self.create_user("outsider@example.com", "Outsider Three")
        foreign_room = PrivateChatRoom.objects.create(
            user_one=self.partner,
            user_two=outsider,
        )

        with patch("apps.chat.services.upload_image") as upload:
            response = self.client.post(
                self.url,
                {
                    "room_id": str(foreign_room.id),
                    "reason": Report.ReportReason.SPAM,
                    "evidence_image": image_file(),
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        upload.assert_not_called()

    def test_unsupported_image_format_is_rejected_before_any_upload(self):
        # A BMP decodes fine, so this exercises the format allow-list rather
        # than ImageField's "is it an image at all" check.
        with patch("apps.chat.services.upload_image") as upload:
            response = self.client.post(
                self.url,
                {
                    "room_id": str(self.room.id),
                    "reason": Report.ReportReason.SPAM,
                    "evidence_image": image_file("evidence.bmp", image_format="BMP"),
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("evidence_image", response.data)
        upload.assert_not_called()
        self.assertEqual(Report.objects.count(), 0)

    def test_non_image_payload_is_rejected(self):
        with patch("apps.chat.services.upload_image") as upload:
            response = self.client.post(
                self.url,
                {
                    "room_id": str(self.room.id),
                    "reason": Report.ReportReason.SPAM,
                    "evidence_image": SimpleUploadedFile(
                        "evidence.png",
                        b"this is not an image",
                        content_type="image/png",
                    ),
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        upload.assert_not_called()
