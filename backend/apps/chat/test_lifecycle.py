"""Tests for chat room lifecycle recovery.

The invariant under test: an ACTIVE room past its idle deadline is stale
state, never a conversation, and every recovery path — the periodic reaper,
the lazy reap in matchmaking — must end it, while a room inside its idle
window must never be touched.

Redis and the channel layer are mocked throughout: these tests assert the
DATABASE lifecycle, and the configured Redis may be a live shared instance
that tests must never write to.
"""

from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from apps.chat.models import PrivateChatRoom
from apps.chat.tasks import reap_expired_chat_rooms
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone


def make_user(email, full_name):
    return get_user_model().objects.create_user(
        email=email,
        password="StrongPass123!",
        full_name=full_name,
        batch="2024",
    )


def make_room(user_one, user_two, age_seconds=0):
    room = PrivateChatRoom.objects.create(
        user_one=user_one,
        user_two=user_two,
        status=PrivateChatRoom.Status.ACTIVE,
    )
    if age_seconds:
        # created_at is auto-set on insert; age the room with an UPDATE.
        PrivateChatRoom.objects.filter(id=room.id).update(
            created_at=timezone.now() - timedelta(seconds=age_seconds)
        )
        room.refresh_from_db()
    return room


@patch("apps.chat.matchmaking.get_channel_layer")
@patch("apps.chat.matchmaking.redis_client", new_callable=MagicMock)
class ReapExpiredChatRoomsTests(TestCase):
    """The periodic reaper: ends abandoned rooms, spares live ones."""

    @classmethod
    def setUpTestData(cls):
        cls.alice = make_user("alice@example.com", "Alice One")
        cls.bob = make_user("bob@example.com", "Bob Two")

    def test_expired_room_is_ended(self, mock_redis, mock_layer):
        mock_layer.return_value.group_send = AsyncMock()
        room = make_room(self.alice, self.bob, age_seconds=600)

        reaped = reap_expired_chat_rooms()

        room.refresh_from_db()
        self.assertEqual(reaped, 1)
        self.assertEqual(room.status, PrivateChatRoom.Status.ENDED)
        self.assertIsNotNone(room.closed_at)
        # Both participants' seat keys are cleared with the room, so the
        # leftovers cannot interfere with their next connection.
        mock_redis.delete.assert_called_once_with(
            f"chat_conn:{room.id}:{self.alice.id}",
            f"chat_conn:{room.id}:{self.bob.id}",
        )

    def test_every_expired_room_is_ended_in_one_pass(self, mock_redis, mock_layer):
        """A user carrying SEVERAL poison rooms must be fully healed at once.

        This is the accumulation that made specific users permanently
        unmatchable until their account was deleted (the CASCADE removed the
        rooms). One reaper pass must clear all of it.
        """
        mock_layer.return_value.group_send = AsyncMock()
        rooms = [make_room(self.alice, self.bob, age_seconds=600 + i) for i in range(3)]

        reaped = reap_expired_chat_rooms()

        self.assertEqual(reaped, 3)
        for room in rooms:
            room.refresh_from_db()
            self.assertEqual(room.status, PrivateChatRoom.Status.ENDED)

    def test_room_inside_idle_window_is_untouched(self, mock_redis, mock_layer):
        room = make_room(self.alice, self.bob, age_seconds=30)

        reaped = reap_expired_chat_rooms()

        room.refresh_from_db()
        self.assertEqual(reaped, 0)
        self.assertEqual(room.status, PrivateChatRoom.Status.ACTIVE)
        mock_redis.delete.assert_not_called()

    def test_old_room_with_recent_message_is_untouched(self, mock_redis, mock_layer):
        """The deadline runs from the LAST MESSAGE, not from room creation —
        a long, living conversation must never be reaped mid-sentence."""
        room = make_room(self.alice, self.bob, age_seconds=600)
        room.messages.create(sender=self.alice, message="still here")

        reaped = reap_expired_chat_rooms()

        room.refresh_from_db()
        self.assertEqual(reaped, 0)
        self.assertEqual(room.status, PrivateChatRoom.Status.ACTIVE)

    def test_ended_rooms_are_ignored(self, mock_redis, mock_layer):
        room = make_room(self.alice, self.bob, age_seconds=600)
        PrivateChatRoom.objects.filter(id=room.id).update(
            status=PrivateChatRoom.Status.ENDED
        )

        self.assertEqual(reap_expired_chat_rooms(), 0)
