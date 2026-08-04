"""Tests for the chat system's atomic Redis scripts.

These scripts carry the whole weight of the matchmaking and socket-seat
invariants, so they are tested directly, against a throwaway local Redis
database — never against the application's configured Redis, which in some
environments is a live shared instance.

Covered invariants:
  - claim-or-enqueue leaves the caller either partnered or queued, never both;
  - a claimed user is reserved (pending marker) until their room commits, so
    no concurrent poll can requeue them or claim them into a second room;
  - a socket seat is released only by the socket that still owns it, and a
    takeover hands back the previous holder exactly once.
"""

import unittest

import redis
from apps.chat.consumers import _RELEASE_SEAT_IF_OWNER_LUA, _TAKE_OVER_SEAT_LUA
from apps.chat.matchmaking import _CLAIM_PARTNER_LUA

# A local database index unlikely to hold anything anyone wants.
LOCAL_TEST_REDIS = "redis://localhost:6379/9"

QUEUE = "waiting_users"
QUEUE_SET = "waiting_users_set"
ALIVE = "waiting_alive"
PENDING = "match_pending"


def _local_client():
    client = redis.from_url(LOCAL_TEST_REDIS, decode_responses=True)
    client.ping()
    return client


class AtomicScriptTestCase(unittest.TestCase):
    """Shared setup: a flushed local Redis DB and registered scripts."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        try:
            cls.redis = _local_client()
        except redis.exceptions.RedisError:  # pragma: no cover
            raise unittest.SkipTest("No local Redis on localhost:6379")

    def setUp(self):
        self.redis.flushdb()

    def claim(self, user_id, alive_ttl=60, pending_ttl=15):
        script = self.redis.register_script(_CLAIM_PARTNER_LUA)
        return script(
            keys=[QUEUE, QUEUE_SET],
            args=[user_id, ALIVE, alive_ttl, PENDING, pending_ttl],
        )

    def enqueue(self, user_id):
        """Put a user in the queue the way the claim script's miss-path does."""
        self.redis.rpush(QUEUE, user_id)
        self.redis.sadd(QUEUE_SET, user_id)
        self.redis.set(f"{ALIVE}:{user_id}", 1, ex=60)


class ClaimPartnerScriptTests(AtomicScriptTestCase):
    def test_empty_queue_enqueues_caller(self):
        result = self.claim("alice")

        self.assertIsNone(result)
        self.assertEqual(self.redis.lrange(QUEUE, 0, -1), ["alice"])
        self.assertTrue(self.redis.sismember(QUEUE_SET, "alice"))
        self.assertTrue(self.redis.exists(f"{ALIVE}:alice"))

    def test_claims_live_partner_and_reserves_them(self):
        self.enqueue("bob")

        result = self.claim("alice")

        self.assertEqual(result, "bob")
        # Bob left the queue entirely, and is reserved for Alice until her
        # room INSERT commits.
        self.assertEqual(self.redis.lrange(QUEUE, 0, -1), [])
        self.assertFalse(self.redis.sismember(QUEUE_SET, "bob"))
        self.assertFalse(self.redis.exists(f"{ALIVE}:bob"))
        self.assertEqual(self.redis.get(f"{PENDING}:bob"), "alice")
        self.assertGreater(self.redis.ttl(f"{PENDING}:bob"), 0)
        # Alice walked away with a partner, so she must NOT be queued.
        self.assertFalse(self.redis.sismember(QUEUE_SET, "alice"))

    def test_skips_stale_partner_without_liveness(self):
        self.enqueue("bob")
        self.redis.delete(f"{ALIVE}:bob")

        result = self.claim("alice")

        # Bob abandoned his search; Alice ends up queued instead, and Bob's
        # stale entry is consumed rather than left to poison later claims.
        self.assertIsNone(result)
        self.assertEqual(self.redis.lrange(QUEUE, 0, -1), ["alice"])
        self.assertFalse(self.redis.sismember(QUEUE_SET, "bob"))
        self.assertFalse(self.redis.exists(f"{PENDING}:bob"))

    def test_reserved_caller_neither_claims_nor_requeues(self):
        # Alice was claimed a moment ago; her partner's room INSERT has not
        # committed. Her own poll lands now, with another user available.
        self.redis.set(f"{PENDING}:alice", "bob", ex=15)
        self.enqueue("carol")

        result = self.claim("alice")

        # She must hold: not enter the queue, and not claim Carol into what
        # would become her second simultaneous room.
        self.assertEqual(result, "@pending")
        self.assertEqual(self.redis.lrange(QUEUE, 0, -1), ["carol"])
        self.assertFalse(self.redis.sismember(QUEUE_SET, "alice"))

    def test_reservation_expires_and_frees_the_caller(self):
        self.redis.set(f"{PENDING}:alice", "bob", ex=15)
        self.redis.delete(f"{PENDING}:alice")  # as after room commit / crash TTL

        result = self.claim("alice")

        self.assertIsNone(result)
        self.assertEqual(self.redis.lrange(QUEUE, 0, -1), ["alice"])

    def test_caller_never_claims_themselves(self):
        self.enqueue("alice")
        self.enqueue("alice")  # duplicate entry from a double enqueue

        result = self.claim("alice")

        self.assertIsNone(result)
        # Exactly one entry survives — her own re-enqueue from this claim.
        self.assertEqual(self.redis.lrange(QUEUE, 0, -1), ["alice"])


class SeatScriptTests(AtomicScriptTestCase):
    SEAT = "chat_conn:room1:alice"

    def take_over(self, channel):
        script = self.redis.register_script(_TAKE_OVER_SEAT_LUA)
        return script(keys=[self.SEAT], args=[channel, 3600])

    def release(self, channel):
        script = self.redis.register_script(_RELEASE_SEAT_IF_OWNER_LUA)
        return script(keys=[self.SEAT], args=[channel])

    def test_takeover_returns_previous_holder(self):
        self.redis.set(self.SEAT, "channel-old")

        old = self.take_over("channel-new")

        self.assertEqual(old, "channel-old")
        self.assertEqual(self.redis.get(self.SEAT), "channel-new")
        self.assertGreater(self.redis.ttl(self.SEAT), 0)

    def test_owner_release_deletes_seat(self):
        self.redis.set(self.SEAT, "channel-a")

        self.assertEqual(self.release("channel-a"), 1)
        self.assertFalse(self.redis.exists(self.SEAT))

    def test_superseded_socket_cannot_release_successors_seat(self):
        # channel-a held the seat, channel-b took it over; a's late disconnect
        # must leave b's claim (and therefore the room) untouched.
        self.redis.set(self.SEAT, "channel-a")
        self.take_over("channel-b")

        self.assertEqual(self.release("channel-a"), 0)
        self.assertEqual(self.redis.get(self.SEAT), "channel-b")

    def test_racing_takeovers_hand_back_distinct_holders(self):
        # Two sockets racing: each must learn a DIFFERENT previous holder, so
        # exactly one replacement notice reaches every displaced socket.
        self.redis.set(self.SEAT, "channel-a")

        first = self.take_over("channel-b")
        second = self.take_over("channel-c")

        self.assertEqual(first, "channel-a")
        self.assertEqual(second, "channel-b")
        self.assertEqual(self.redis.get(self.SEAT), "channel-c")
