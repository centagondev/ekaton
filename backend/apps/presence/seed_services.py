from random import randint

from backend.apps.presence.services import PlatformPresenceService
from core.redis import redis_client

from .constants import (
    PLATFORM_SEED_KEY,
    MIN_PLATFORM_SEED,
    MAX_PLATFORM_SEED,
    PLATFORM_SEED_THRESHOLD,
    PLATFORM_SEED_DRIFT_MIN,
    PLATFORM_SEED_DRIFT_MAX,
)


class SeedService:
    """
    Handles the platform display seed.

    Responsibilities:
    - Initialize the seed.
    - Retrieve the current seed.
    - Refresh the seed.
    - Decide whether the seed should be applied.
    - Calculate the display count.
    """
    
    @classmethod
    def initialize_seed(cls) -> int:
        """
        Create the initial platform seed if it does not already exist.
        """
        seed=redis_client.get(PLATFORM_SEED_KEY)
        
        if seed is not None :
            return int(seed)
        
        seed = randint(
        MIN_PLATFORM_SEED,
        MAX_PLATFORM_SEED)
        
        redis_client.set(
            PLATFORM_SEED_KEY,
            seed
        )
        
        return seed 
    
    
    @classmethod
    def get_seed(cls) -> int:
        """
        Retrieve the current platform seed.

        If the seed does not exist, initialize a new one.
        """
        
        seed =redis_client.get(PLATFORM_SEED_KEY)
        
        if seed is None:
            return cls.initialize_seed()
        
        return int(seed)
    @classmethod
    def should_apply_seed(cls,real_count: int) -> bool:
        """
        Determine whether the platform seed should be applied.

        The seed is only applied while the platform has fewer than the
        configured threshold of real online users.
        """
        return real_count < PLATFORM_SEED_THRESHOLD     
    
    @classmethod
    def get_display_count(cls) -> int:
        """
        Return the online count that should be displayed
        to clients.
        """
        
        real_count=PlatformPresenceService.get_online_count()
        
        if not cls.should_apply_seed(real_count) :
            return real_count
        
        seed =cls.get_seed()
        
        return real_count+ seed
    
    @classmethod
    def refresh_seed(cls) -> int:
        """
        Refresh the platform seed using a gradual drift.
        """
        current_seed = cls.get_seed()
        
        drift = randint(
        PLATFORM_SEED_DRIFT_MIN,
        PLATFORM_SEED_DRIFT_MAX)
        
        updated_seed = current_seed + drift
        updated_seed = max(MIN_PLATFORM_SEED,
                                             min(updated_seed,MAX_PLATFORM_SEED,))
        
        redis_client.set(
            PLATFORM_SEED_KEY,updated_seed
        )
        
        return updated_seed
    
    @classmethod
    def clear_seed(cls) -> None:
        """
        Remove the platform seed from Redis.
        """
        
        redis_client.delete(
        PLATFORM_SEED_KEY)