from __future__ import annotations

from celery import shared_task

from .services import PlatformPresenceService


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
