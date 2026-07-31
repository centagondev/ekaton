import logging
import sib_api_v3_sdk
from celery import shared_task
from django.conf import settings
from sib_api_v3_sdk.rest import ApiException

logger = logging.getLogger(__name__)

# Configure Resend exactly once
configuration = sib_api_v3_sdk.Configuration()
configuration.api_key["api-key"] = settings.BREVO_API_KEY

api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
    sib_api_v3_sdk.ApiClient(configuration)
)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def send_email_task(self, to_email: str, subject: str, html: str, from_email: str):
    """
    Asynchronous Celery task to send emails via Resend.
    """
    try:
        email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": to_email}],
            sender={
                "email":from_email,
                "name":"Ekaton",
            },
            subject=subject,
            html_content=html
        )

        response = api_instance.send_transac_email(email)

        logger.info("Email send successfully to %s", to_email)

        return response.to_dict()
    
    except ApiException as e:
        logger.error("Failed to send email to %s: %s", to_email, str(e))
        raise
