import logging

import resend
from django.conf import settings

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
        Send a transactional email using Resend.
        """

        return resend.Emails.send(
            {
                "from": from_email,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )
