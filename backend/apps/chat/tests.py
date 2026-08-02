import io
from unittest.mock import AsyncMock, MagicMock, patch

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


class CancelChatSearchTests(APITestCase):
    """Covers what leaving the waiting queue has to clean up besides the queue.

    A queued user stays claimable until their removal actually lands, and a
    claim creates the room there and then — so a cancel can arrive a moment
    after someone has already been matched with the caller. The caller is never
    going to open that room, which used to leave their partner sitting in it
    alone with no explanation.
    """

    def setUp(self):
        cache.clear()
        self.url = reverse("cancel-chat-search")
        self.user = self.create_user("canceller@example.com", "Canceller One")
        self.partner = self.create_user("waiter@example.com", "Waiter Two")
        self.client.force_authenticate(user=self.user)

    def create_user(self, email, full_name):
        return get_user_model().objects.create_user(
            email=email,
            password="StrongPass123!",
            full_name=full_name,
            batch="2024",
            gender="male",
            is_verified=True,
        )

    def cancel(self, *, joined):
        """POST the cancel with the caller's socket slot present or absent.

        Returns the response and the `group_send` stub, so a test can assert on
        what the other participant was (or was not) told.
        """
        redis = MagicMock()
        redis.exists.return_value = 1 if joined else 0

        # async_to_sync awaits whatever group_send returns, so it has to be an
        # async callable rather than a plain MagicMock attribute.
        group_send = AsyncMock()

        with (
            patch("apps.chat.matchmaking.redis_client", redis),
            patch("apps.chat.views.get_channel_layer") as get_channel_layer,
        ):
            get_channel_layer.return_value.group_send = group_send
            response = self.client.post(self.url, {}, format="json")

        return response, group_send

    def test_room_the_caller_never_joined_is_ended_and_announced(self):
        room = PrivateChatRoom.objects.create(
            user_one=self.partner,
            user_two=self.user,
            status=PrivateChatRoom.Status.ACTIVE,
        )

        response, group_send = self.cancel(joined=False)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        room.refresh_from_db()
        self.assertEqual(room.status, PrivateChatRoom.Status.ENDED)
        self.assertIsNotNone(room.closed_at)

        group_send.assert_awaited_once()
        self.assertEqual(group_send.call_args.args[0], f"chat_{room.id}")
        self.assertEqual(group_send.call_args.args[1], {"type": "chat_ended"})

    def test_conversation_the_caller_is_sitting_in_is_left_alone(self):
        room = PrivateChatRoom.objects.create(
            user_one=self.partner,
            user_two=self.user,
            status=PrivateChatRoom.Status.ACTIVE,
        )

        response, group_send = self.cancel(joined=True)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        room.refresh_from_db()
        self.assertEqual(room.status, PrivateChatRoom.Status.ACTIVE)
        group_send.assert_not_awaited()

    def test_cancel_without_any_room_stays_a_plain_success(self):
        response, group_send = self.cancel(joined=False)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        group_send.assert_not_awaited()

    def test_already_ended_room_is_not_re_announced(self):
        room = PrivateChatRoom.objects.create(
            user_one=self.partner,
            user_two=self.user,
            status=PrivateChatRoom.Status.ENDED,
        )

        response, group_send = self.cancel(joined=False)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        room.refresh_from_db()
        self.assertEqual(room.status, PrivateChatRoom.Status.ENDED)
        group_send.assert_not_awaited()
