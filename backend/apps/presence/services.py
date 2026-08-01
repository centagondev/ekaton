from __future__ import annotations

import logging
import time
from uuid import UUID

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from core.redis import redis_client

from .constants import (
    EVENT_CONNECTION_KEY,
    EVENT_PRESENCE_KEY,
    EVENT_PRESENCE_TTL,
    PLATFORM_BROADCAST_DEBOUNCE_KEY,
    PLATFORM_BROADCAST_DEBOUNCE_SECONDS,
    PLATFORM_CONNECTION_KEY,
    PLATFORM_CONNECTION_TTL,
    PLATFORM_LAST_BROADCAST_KEY,
    PLATFORM_LAST_BROADCAST_TTL,
    PLATFORM_PRESENCE_GROUP,
    PLATFORM_PRESENCE_KEY,
)
from .seed_services import SeedService

logger = logging.getLogger(__name__)


class EventPresenceService:
    """
    Service responsible for managing event presence in Redis.

    Responsibilities:
    - Mark users as online.
    - Mark users as offline.
    - Retrieve online users.
    - Check whether a user is online.

    Presence data is stored in Redis Sets. Each user also has a set of their
    open channel names, so several tabs on the same event count as one online
    user; see the key documentation in .constants.

    Redis Key Format:
        presence:event:{event_id}:users
        presence:event:{event_id}:connections:{user_id}
    """

    @classmethod
    def _event_presence_key(
        cls,
        event_id: UUID,
    ) -> str:
        """
        Generate the Redis key for an event's online users.
        """
        return EVENT_PRESENCE_KEY.format(event_id=event_id)

    @classmethod
    def _connection_key(
        cls,
        event_id: UUID,
        user_id: UUID,
    ) -> str:
        """
        Generate the Redis key holding a user's open sockets for an event.
        """
        return EVENT_CONNECTION_KEY.format(event_id=event_id, user_id=user_id)

    @classmethod
    def mark_online(
        cls,
        event_id: UUID,
        user_id: UUID,
        connection_id: str,
    ) -> int:
        """
        Register an open socket and add the user to the event's online set.

        Returns the number of sockets the user now has open on this event, so
        the caller can tell a genuine arrival (1) from an extra tab.
        """
        presence_key = cls._event_presence_key(event_id)
        connection_key = cls._connection_key(event_id, user_id)

        connection_count = redis_client.eval(
            """
            redis.call('SADD', KEYS[1], ARGV[1])
            redis.call('SADD', KEYS[2], ARGV[2])
            redis.call('EXPIRE', KEYS[1], ARGV[3])
            redis.call('EXPIRE', KEYS[2], ARGV[3])
            return redis.call('SCARD', KEYS[1])
            """,
            2,
            connection_key,
            presence_key,
            connection_id,
            str(user_id),
            EVENT_PRESENCE_TTL,
        )

        logger.debug(
            "User '%s' marked online in event '%s'. Active connections: %d.",
            user_id,
            event_id,
            connection_count,
        )

        return connection_count

    @classmethod
    def mark_offline(
        cls,
        event_id: UUID,
        user_id: UUID,
        connection_id: str,
    ) -> int:
        """
        Remove one open socket, and remove the user from the event's online
        set once none of their sockets remain.

        Returns the number of sockets the user still has open on this event.
        """
        presence_key = cls._event_presence_key(event_id)
        connection_key = cls._connection_key(event_id, user_id)

        connection_count = redis_client.eval(
            """
            redis.call('SREM', KEYS[1], ARGV[1])
            local count = redis.call('SCARD', KEYS[1])
            if count == 0 then
                redis.call('DEL', KEYS[1])
                redis.call('SREM', KEYS[2], ARGV[2])
            end
            return count
            """,
            2,
            connection_key,
            presence_key,
            connection_id,
            str(user_id),
        )

        logger.debug(
            "User '%s' closed a connection in event '%s'. Remaining: %d.",
            user_id,
            event_id,
            connection_count,
        )

        return connection_count

    @classmethod
    def get_online_users(
        cls,
        event_id: UUID,
    ) -> list[str]:
        """
        Return the IDs of all users currently online in an event.
        """
        key = cls._event_presence_key(event_id)
        return list(redis_client.smembers(key))

    @classmethod
    def is_online(
        cls,
        event_id: UUID,
        user_id: UUID,
    ) -> bool:
        """
        Check whether a user is currently online in an event.
        """
        key = cls._event_presence_key(event_id)
        return redis_client.sismember(key, str(user_id))

    @classmethod
    def get_online_count(
        cls,
        event_id: UUID,
    ) -> int:
        """
        Return the number of users currently online in an event.
        """
        key = cls._event_presence_key(event_id)
        return redis_client.scard(key)

    @classmethod
    def has_online_users(
        cls,
        event_id: UUID,
    ) -> bool:
        """
        Return True if the event has at least one online user.
        """
        return cls.get_online_count(event_id) > 0

    @classmethod
    def clear_event_presence(
        cls,
        event_id: UUID,
    ) -> None:
        """
        Remove all presence data for an event.

        Used when an event is cancelled or has expired, which is also what
        reclaims the per-user connection sets.
        """
        key = cls._event_presence_key(event_id)
        connection_pattern = EVENT_CONNECTION_KEY.format(
            event_id=event_id,
            user_id="*",
        )
        connection_keys = list(
            redis_client.scan_iter(match=connection_pattern, count=500),
        )

        redis_client.delete(key, *connection_keys)

        logger.info(
            "Presence data cleared for event '%s'. Connection keys removed: %d.",
            event_id,
            len(connection_keys),
        )


class PlatformPresenceService:
    """
    Service responsible for managing platform-wide user presence in Redis.

    Responsibilities:
    - Mark users as online.
    - Mark users as offline.
    - Retrieve online users.
    - Check whether a user is online.
    - Broadcast updated online count via Django Channels.

    Presence data is stored in expiry-aware Redis sorted sets, scored by the
    UNIX timestamp at which each entry's lease expires.

    Redis Keys:
        presence:platform:users:v2
            member = user id, score = lease expiry. One entry per online user.

        presence:platform:connections:v2:{user_id}
            member = channel name, score = lease expiry. One entry per open
            socket, so a user with several tabs stays online until the last
            one closes. Carries a key-level TTL as a backstop.

    Leases are renewed by the consumer's keepalive; see
    PlatformPresenceConsumer._keepalive.
    """

    @classmethod
    def _platform_presence_key(cls) -> str:
        """
        Generate the Redis key for platform online users.
        """
        return PLATFORM_PRESENCE_KEY

    @staticmethod
    def _connection_key(user_id: UUID) -> str:
        """
        Return the Redis key that stores all active
        WebSocket connections for a user.
        """
        return PLATFORM_CONNECTION_KEY.format(user_id=user_id)

    @classmethod
    def mark_online(cls, user_id: UUID, connection_id: str) -> None:
        """
        Register a new WebSocket connection for a user and, if this
        is their first active connection, add them to the platform
        presence set.
        """
        presence_key = cls._platform_presence_key()
        connection_key = cls._connection_key(user_id)

        connection_count = redis_client.eval(
            """
            redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
            redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
            redis.call('ZADD', KEYS[2], ARGV[2], ARGV[4])
            redis.call('EXPIRE', KEYS[1], ARGV[5])
            return redis.call('ZCARD', KEYS[1])
            """,
            2,
            connection_key,
            presence_key,
            time.time(),
            time.time() + PLATFORM_CONNECTION_TTL,
            connection_id,
            str(user_id),
            PLATFORM_CONNECTION_TTL,
        )

        if connection_count == 1:
            logger.info(
                "User '%s' became online on the platform. Active connections: %d.",
                user_id,
                connection_count,
            )
        else:
            logger.debug(
                "User '%s' opened an additional tab. Active connections: %d.",
                user_id,
                connection_count,
            )

    @classmethod
    def mark_offline(cls, user_id: UUID, connection_id: str) -> None:
        """
        Remove a WebSocket connection for a user and, if no active
        connections remain, remove them from the platform presence set.
        """
        presence_key = cls._platform_presence_key()
        connection_key = cls._connection_key(user_id)

        connection_count = redis_client.eval(
            """
            redis.call('ZREM', KEYS[1], ARGV[1])
            redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[2])
            local count = redis.call('ZCARD', KEYS[1])
            if count == 0 then
                redis.call('ZREM', KEYS[2], ARGV[3])
                redis.call('DEL', KEYS[1])
            end
            return count
            """,
            2,
            connection_key,
            presence_key,
            connection_id,
            time.time(),
            str(user_id),
            PLATFORM_CONNECTION_TTL,
        )

        if connection_count == 0:
            logger.info(
                "User '%s' went offline from the platform. All connections closed.",
                user_id,
            )
        else:
            logger.debug(
                "User '%s' closed one tab. Remaining connections: %d.",
                user_id,
                connection_count,
            )

    @classmethod
    def get_online_users(cls) -> list[str]:
        """
        Return the IDs of all users currently online.
        """
        key = cls._platform_presence_key()
        redis_client.zremrangebyscore(key, "-inf", time.time())
        return list(redis_client.zrange(key, 0, -1))

    @classmethod
    def is_online(cls, user_id: UUID) -> bool:
        """
        Check whether a user is currently online.
        """
        key = cls._platform_presence_key()
        redis_client.zremrangebyscore(key, "-inf", time.time())
        return redis_client.zscore(key, str(user_id)) is not None

    @classmethod
    def get_online_count(cls) -> int:
        """
        Return the number of users currently online.
        """
        key = cls._platform_presence_key()
        redis_client.zremrangebyscore(key, "-inf", time.time())
        return redis_client.zcard(key)

    @classmethod
    def has_online_users(cls) -> bool:
        """
        Return True if at least one user is online.
        """
        return cls.get_online_count() > 0

    @classmethod
    def clear_platform_presence(cls) -> None:
        """
        Remove all platform presence data.

        Useful for development, testing, or administrative tasks.
        """
        key = cls._platform_presence_key()
        connection_pattern = PLATFORM_CONNECTION_KEY.format(user_id="*")
        connection_keys = list(
            redis_client.scan_iter(match=connection_pattern, count=500),
        )
        redis_client.delete(key, *connection_keys)
        logger.info(
            "Platform presence data cleared. Connection keys removed: %d.",
            len(connection_keys),
        )

    @classmethod
    def refresh_connection(cls, user_id: UUID, connection_id: str) -> bool:
        """
        Extend the presence lease for a connection that is still open.

        The connection is re-registered unconditionally, so a lease that has
        already lapsed (for example after a transient Redis outage or a long
        pause in renewals) is restored rather than left permanently invisible
        while the socket is still connected.

        Returns True if the lease was still active, False if it had expired
        and had to be restored.
        """
        connection_key = cls._connection_key(user_id)
        presence_key = cls._platform_presence_key()
        now = time.time()

        was_active = redis_client.eval(
            """
            redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[3])
            local was_active = redis.call('ZSCORE', KEYS[1], ARGV[2]) and 1 or 0
            redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
            redis.call('ZADD', KEYS[2], ARGV[1], ARGV[4])
            redis.call('EXPIRE', KEYS[1], ARGV[5])
            return was_active
            """,
            2,
            connection_key,
            presence_key,
            now + PLATFORM_CONNECTION_TTL,
            connection_id,
            now,
            str(user_id),
            PLATFORM_CONNECTION_TTL,
        )

        if not was_active:
            logger.warning(
                "Restored a lapsed presence lease: user='%s', channel='%s'.",
                user_id,
                connection_id,
            )

        return bool(was_active)

    @classmethod
    def claim_broadcast(cls) -> int | None:
        """
        Reserve the right to broadcast, and return the count to send.

        Only the first caller in each debounce window gets a value; everyone
        else gets None and must not send. This is what stops a few hundred
        simultaneous connects from each fanning a message out to the whole
        group. The caller is expected to call record_broadcast afterwards.

        Note this is a leading-edge debounce: the winner sends the count as it
        was at the start of the window, so the tail of a burst is not
        reflected. broadcast_if_changed is what settles the final value.
        """
        reserved = redis_client.set(
            PLATFORM_BROADCAST_DEBOUNCE_KEY,
            "1",
            nx=True,
            ex=PLATFORM_BROADCAST_DEBOUNCE_SECONDS,
        )

        if not reserved:
            return None

        return SeedService.get_display_count()

    @classmethod
    def record_broadcast(cls, count: int) -> None:
        """
        Remember the count that was last sent to clients.
        """
        redis_client.set(
            PLATFORM_LAST_BROADCAST_KEY,
            count,
            ex=PLATFORM_LAST_BROADCAST_TTL,
        )

    @classmethod
    def last_broadcast_count(cls) -> int | None:
        """
        Return the count clients were last told, or None if unknown.
        """
        count = redis_client.get(PLATFORM_LAST_BROADCAST_KEY)
        return None if count is None else int(count)

    @classmethod
    def _send_online_count(cls, count: int) -> bool:
        """
        Push a count to the platform group. Returns whether it was sent.

        Synchronous, for callers outside the event loop such as Celery.
        """
        channel_layer = get_channel_layer()

        if channel_layer is None:
            logger.error(
                "No channel layer configured; cannot broadcast online count.",
            )
            return False

        async_to_sync(channel_layer.group_send)(
            PLATFORM_PRESENCE_GROUP,
            {
                "type": "platform.online_count",
                "count": count,
            },
        )
        cls.record_broadcast(count)

        logger.debug("Platform online count broadcast. Count: %d.", count)
        return True

    @classmethod
    def broadcast_online_count(cls, *, debounce: bool = True) -> bool:
        """
        Broadcast the latest platform display count to all connected clients.

        Pass debounce=False for updates that must always propagate, such as a
        seed refresh, where suppressing the message would leave clients on a
        stale number until something else happens to trigger a send.
        """
        if debounce:
            count = cls.claim_broadcast()
            if count is None:
                return False
        else:
            count = SeedService.get_display_count()

        return cls._send_online_count(count)

    @classmethod
    def broadcast_if_changed(cls) -> bool:
        """
        Re-broadcast only when the display count has moved since the last send.

        Two things make the count drift away from what clients are showing:
        the debounce above drops the tail of a connect burst, and presence
        leases expire silently without any connect or disconnect to react to.
        Running this periodically settles both, and costs nothing when the
        number has not changed.
        """
        count = SeedService.get_display_count()

        if count == cls.last_broadcast_count():
            return False

        logger.info(
            "Platform online count drifted; re-broadcasting %d.",
            count,
        )
        return cls._send_online_count(count)
