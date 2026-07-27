import logging

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import Event, EventStatus
from .services import close_event_connections

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
)
def end_expired_events(self):
    """
    Automatically end all expired events.

    Runs periodically via Celery Beat.

    - Finds ACTIVE events whose end_time has passed.
    - Marks them as ENDED.
    - Notifies anyone still connected to each of them.

    Each event is handled on its own: one failure is logged and skipped so
    the rest of the batch still runs, and the skipped event is picked up by
    the next run because it is still ACTIVE.
    """

    expired_events = Event.objects.filter(
        status=EventStatus.ACTIVE,
        end_time__lte=timezone.now(),
    )
    updated_count = 0
    for event in expired_events:
        try:
            with transaction.atomic():
                locked_event = Event.objects.select_for_update().get(pk=event.pk)

                # Event may already have been updated
                if locked_event.status != EventStatus.ACTIVE:
                    continue

                locked_event.status = EventStatus.ENDED
                locked_event.save(update_fields=["status", "updated_at"])
        except Exception:
            logger.exception(
                "Failed to expire event %s",
                event.id,
            )
            continue

        # Counted after the commit, so a transaction that rolls back is not
        # reported as an ended event.
        updated_count += 1

        logger.info(
            "Event %s (%s) automatically ended.",
            locked_event.id,
            locked_event.name,
        )

        # Outside the transaction: anyone still connected is told the event
        # is over and the event's presence data is released.
        #
        # Its failure is swallowed rather than raised. The status change is
        # already committed at this point, so letting the task retry would
        # find the event no longer ACTIVE, skip it, and lose the
        # notification for good.
        try:
            close_event_connections(event=locked_event, reason="ended")
        except Exception:
            logger.exception(
                "Event %s was ended but its clients could not be notified.",
                locked_event.id,
            )

    logger.info(
        "%s event(s) automatically ended.",
        updated_count,
    )

    return f"{updated_count} event(s) ended."
