from __future__ import annotations

from uuid import UUID

from core.redis import redis_client


class EventPresenceService:
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


class PlatformPresenceService:
    """
    Service responsible for managing platform-wide user presence in Redis.

    Responsibilities:
    - Mark users as online.
    - Mark users as offline.
    - Retrieve online users.
    - Check whether a user is online.

    Presence data is stored in a Redis Set.

    Redis Key Format:
        presence:platform:users
    """
    @classmethod
    def _platform_presence_key(cls)->str :
        """
        Generate the Redis key for platform online users.
        """
        return "presence:platform:users"
    
    @classmethod
    def mark_online(cls,user_id:UUID,connection_id:str ) -> None:
        """
        Add a user to the platform online presence set.
        """
        
        presence_key=cls._platform_presence_key()
        
        connection_key=cls._connection_key(user_id)
        
        redis_client.sadd(connection_key,
                          connection_id)
        
        connection_count=redis_client.scard(connection_key)
        if connection_count == 1:
            redis_client.sadd(presence_key,str(user_id))
        
    @classmethod
    def mark_offline(cls,user_id:UUID,connection_id: str,) -> None:
        """
        Remove a user from the platform online presence set.
        """
        presence_key=cls._platform_presence_key()
        connection_key=cls._connection_key(user_id)
        
        redis_client.srem(connection_key,connection_id)
    
        connection_count=redis_client.scard(connection_key)
        
        if connection_count == 0 :
            
            redis_client.srem(presence_key,str(user_id))
            redis_client.delete(connection_key)
    
    @classmethod
    def get_online_users(cls)->list[str]:
        """
        Return the IDs of all users currently online.
        """
        key=cls._platform_presence_key()
        
        return list(redis_client.smembers(key))
    
    @classmethod
    def is_online(cls,user_id:UUID)-> bool:
        """
        Check whether a user is currently online.
        """
        
        key=cls._platform_presence_key()
        
        return redis_client.sismember(key,str(user_id))
    
    @classmethod 
    def get_online_count(cls)-> int:
        """
        Return the number of users currently online.
        """
        
        key=cls._platform_presence_key()
        
        return redis_client.scard(key)
    
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
        key=cls._platform_presence_key()
        redis_client.delete(key)
        
    @staticmethod
    def _connection_key(user_id:UUID)-> str:
        """
        Return the Redis key that stores all active
        WebSocket connections for a user.
        """
        return f"presence:platform:connections:{user_id}"
    
        
        

    


class SeedService:
    """
    Future service responsible for:

    - Dynamic display seed
    - Seed generation
    - Seed refresh
    - Display count calculation
    """
    


