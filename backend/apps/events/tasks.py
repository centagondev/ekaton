import logging

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from .models import Event, EventStatus

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
    - Retries automatically on unexpected failures.
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
                locked_event.save(update_fields=["status"])
                updated_count += 1

                logger.info(
                    "Event %s (%s) automatically ended.",
                    locked_event.id,
                    getattr(locked_event, "name", ""),
                )
        except Exception:
            logger.exception(
                "Failed to expire event %s",
                event.id,
            )
            raise
    logger.info(
        "%s event(s) automatically ended.",
        updated_count,
    )

    return f"{updated_count} event(s) ended."
