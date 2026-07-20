import logging

import resend
from django.conf import settings

from core.tasks import send_email_task

logger = logging.getLogger("email")

resend.api_key = settings.RESEND_API_KEY


class EmailService:
    @staticmethod
    def send_email(
        to_email: str,
        subject: str,
        html: str,
        from_email: str = settings.DEFAULT_FROM_EMAIL,
    ):
        """
        Dispatch the email sending job to a Celery background worker.
        """
        # Call the celery task using .delay()
        send_email_task.delay(
            to_email=to_email,
            subject=subject,
            html=html,
            from_email=from_email,
        )
