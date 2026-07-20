import logging

import resend
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)

# Configure Resend exactly once
resend.api_key = settings.RESEND_API_KEY


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_email_task(self, to_email: str, subject: str, html: str, from_email: str):
    """
    Asynchronous Celery task to send emails via Resend.
    """

    try:
        response = resend.Emails.send(
            {
                "from": from_email,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )
        logger.info(f"Email sent successfully to {to_email}")
        return response
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        raise
