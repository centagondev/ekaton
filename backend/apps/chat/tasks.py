from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .matchmaking import release_expired_room
from .models import PrivateChatRoom
from .services import IDLE_TIMEOUT_SECONDS

logger = logging.getLogger("chat")


@shared_task
def reap_expired_chat_rooms() -> int:
    """End every ACTIVE room whose idle deadline has passed.

    The lazy reap in ``start_chat`` only fires when one of the room's own
    participants searches again. A room both participants walked away from —
    crashed browser, closed laptop, deploy that killed the sockets — has
    nobody left to trigger it, and stayed ACTIVE in the database forever:
    exactly the orphaned rows that made their owners unmatchable, and the
    reason deleting the user account "fixed" them (the CASCADE took the
    poison rooms with it).

    ``release_expired_room`` applies the same idle rule the live watchdog
    uses, so a room with an active conversation can never be caught here.
    Rooms younger than the idle window are excluded in the query — their
    last activity cannot be older than the room itself.

    Returns the number of rooms reaped, for the task result log.
    """
    cutoff = timezone.now() - timedelta(seconds=IDLE_TIMEOUT_SECONDS)

    stale_candidates = PrivateChatRoom.objects.filter(
        status=PrivateChatRoom.Status.ACTIVE,
        created_at__lt=cutoff,
    )

    reaped = 0
    for room in stale_candidates.iterator():
        if release_expired_room(room):
            reaped += 1

    if reaped:
        logger.info("Reaper: ended %d expired chat room(s)", reaped)

    return reaped
