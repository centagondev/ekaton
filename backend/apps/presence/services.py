from __future__ import annotations

from uuid import UUID

from core.redis import redis_client


class PresenceService:
    """
    Service responsible for managing event presence in Redis.

    Responsibilities:
    - Mark users as online.
    - Mark users as offline.
    - Retrieve online users.
    - Check whether a user is online.

    Presence data is stored in Redis Sets.

    Redis Key Format:
        presence:event:{event_id}:users
    """

    @classmethod
    def _event_presence_key(
        cls,
        event_id: UUID,
    ) -> str:
        """
        Generate the Redis key for an event's online users.
        """
        return f"presence:event:{event_id}:users"

    @classmethod
    def mark_online(
        cls,
        event_id: UUID,
        user_id: UUID,
    ) -> None:
        """
        Add a user to an event's online presence set.
        """

        key = cls._event_presence_key(event_id)

        redis_client.sadd(
            key,
            str(user_id),
        )

    @classmethod
    def mark_offline(
        cls,
        event_id: UUID,
        user_id: UUID,
    ) -> None:
        """
        Remove a user from an event's online presence set.
        """

        key = cls._event_presence_key(event_id)

        redis_client.srem(
            key,
            str(user_id),
        )

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

        return redis_client.sismember(
            key,
            str(user_id),
        )

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

        Useful when an event is deleted or permanently closed.
        """

        key = cls._event_presence_key(event_id)

        redis_client.delete(key)
