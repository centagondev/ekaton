from __future__ import annotations

import logging
from random import randint

from core.redis import redis_client

from .constants import (
    MAX_PLATFORM_SEED,
    MIN_PLATFORM_SEED,
    PLATFORM_SEED_DRIFT_MAX,
    PLATFORM_SEED_DRIFT_MIN,
    PLATFORM_SEED_KEY,
    PLATFORM_SEED_REVERSION_STRENGTH,
    PLATFORM_SEED_THRESHOLD,
)

logger = logging.getLogger(__name__)


class SeedService:
    """
    Handles the platform display seed.

    Responsibilities:
    - Initialize the seed.
    - Retrieve the current seed.
    - Refresh the seed.
    - Decide whether the seed should be applied.
    - Calculate the display count.

    This service never communicates with WebSockets.
    All state is stored exclusively in Redis.
    """

    @classmethod
    def initialize_seed(cls) -> int:
        """
        Create the initial platform seed if it does not already exist.

        Returns the existing seed if already initialized, otherwise
        generates a new random value within the configured bounds and
        persists it to Redis.
        """
        seed = redis_client.get(PLATFORM_SEED_KEY)

        if seed is not None:
            logger.debug(
                "Platform seed already initialized. Current value: %s.",
                seed,
            )
            return int(seed)

        new_seed = randint(MIN_PLATFORM_SEED, MAX_PLATFORM_SEED)

        if not redis_client.set(PLATFORM_SEED_KEY, new_seed, nx=True):
            # Another worker won the race, so defer to the value it wrote.
            existing = redis_client.get(PLATFORM_SEED_KEY)

            if existing is None:
                # The winner's key vanished between its write and this read —
                # an eviction, or an explicit clear. Nothing to defer to, so
                # keep our own value rather than crashing on int(None).
                logger.warning(
                    "Platform seed disappeared immediately after being set. "
                    "Falling back to the locally generated value %d.",
                    new_seed,
                )
                return new_seed

            return int(existing)

        logger.info(
            "Platform seed initialized with value %d (range %d–%d).",
            new_seed,
            MIN_PLATFORM_SEED,
            MAX_PLATFORM_SEED,
        )

        return new_seed

    @classmethod
    def get_seed(cls) -> int:
        """
        Retrieve the current platform seed.

        If the seed does not exist, initialize a new one.
        """
        seed = redis_client.get(PLATFORM_SEED_KEY)

        if seed is None:
            logger.debug("Platform seed missing. Initializing.")
            return cls.initialize_seed()

        return int(seed)

    @classmethod
    def should_apply_seed(cls, real_count: int) -> bool:
        """
        Determine whether the platform seed should be applied.

        The seed is only applied while the platform has fewer real
        online users than the configured threshold.
        """
        return real_count < PLATFORM_SEED_THRESHOLD

    @classmethod
    def get_display_count(cls) -> int:
        """
        Return the online count that should be displayed to clients.

        Applies the seed offset only when the real count is below
        the configured threshold.
        """
        # Local import breaks the circular dependency:
        # services.py imports SeedService; seed_services.py imports
        # PlatformPresenceService only here at call time, not at module load.
        from .services import PlatformPresenceService  # noqa: PLC0415

        real_count = PlatformPresenceService.get_online_count()

        if not cls.should_apply_seed(real_count):
            logger.debug(
                "Seed not applied. Real count %d meets threshold %d.",
                real_count,
                PLATFORM_SEED_THRESHOLD,
            )
            return real_count

        seed = cls.get_seed()
        display_count = real_count + seed

        logger.debug(
            "Display count: real=%d, seed=%d, display=%d.",
            real_count,
            seed,
            display_count,
        )

        return display_count

    @classmethod
    def refresh_seed(cls) -> int:
        """
        Refresh the platform seed using a gradual, mean-reverting drift.

        Each refresh applies a symmetric random step plus a gentle pull back
        toward the middle of the configured range. The pull is what keeps the
        seed centred over time: a random step alone would let the seed wander
        onto a clamp bound and linger there, and biasing the step to
        compensate would park it on the opposite bound instead.

        The result is clamped to [MIN, MAX] so the displayed count never falls
        outside acceptable bounds.
        """
        current_seed = cls.get_seed()

        target = (MIN_PLATFORM_SEED + MAX_PLATFORM_SEED) // 2
        # int() truncates toward zero, so the pull is symmetric about the
        # target. Floor division would round negative corrections away from
        # zero and reintroduce a downward bias.
        reversion = int((target - current_seed) / PLATFORM_SEED_REVERSION_STRENGTH)
        drift = randint(PLATFORM_SEED_DRIFT_MIN, PLATFORM_SEED_DRIFT_MAX)

        updated_seed = current_seed + reversion + drift
        updated_seed = max(
            MIN_PLATFORM_SEED,
            min(updated_seed, MAX_PLATFORM_SEED),
        )

        redis_client.set(PLATFORM_SEED_KEY, updated_seed)

        logger.info(
            "Platform seed refreshed: %d → %d (reversion %+d, drift %+d).",
            current_seed,
            updated_seed,
            reversion,
            drift,
        )

        return updated_seed

    @classmethod
    def clear_seed(cls) -> None:
        """
        Remove the platform seed from Redis.
        """
        redis_client.delete(PLATFORM_SEED_KEY)
        logger.info("Platform seed cleared from Redis.")
