from __future__ import annotations

import logging
import time

from celery import shared_task

from .seed_services import SeedService
from .services import PlatformPresenceService

logger = logging.getLogger(__name__)


@shared_task
def refresh_platform_seed() -> None:
    """
    Refresh the platform seed and broadcast the updated display count.

    Scheduled to run every 30 minutes via Celery Beat.
    """
    logger.info("Celery task 'refresh_platform_seed' started.")

    start = time.monotonic()

    try:
        SeedService.refresh_seed()
        # Bypass the debounce: a seed change must always reach clients, and
        # suppressing it would leave the old number up for a further 30 minutes.
        PlatformPresenceService.broadcast_online_count(debounce=False)
    finally:
        elapsed_ms = (time.monotonic() - start) * 1000
        logger.info(
            "Celery task 'refresh_platform_seed' finished in %.2f ms.",
            elapsed_ms,
        )


@shared_task
def reconcile_platform_online_count() -> None:
    """
    Re-broadcast the online count whenever it has drifted from what clients show.

    Connect and disconnect broadcasts are debounced, so the tail of a burst is
    never sent, and presence leases expire silently with no socket event to
    react to. This settles both. It sends nothing when the count is unchanged,
    which is the common case.
    """
    PlatformPresenceService.broadcast_if_changed()
