import logging

import sib_api_v3_sdk
from django.conf import settings
from sib_api_v3_sdk.rest import ApiException

logger = logging.getLogger("email")

configuration = sib_api_v3_sdk.Configuration()
configuration.api_key["api-key"] = settings.BREVO_API_KEY

_api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))


class EmailService:
    @staticmethod
    def send_email(
        to_email: str,
        subject: str,
        html: str,
        from_email: str = settings.DEFAULT_FROM_EMAIL,
    ):
        """
        Send an email via Brevo, synchronously, in the request path.

        This used to enqueue onto Celery (core/tasks.py::send_email_task,
        now removed — account setup and password reset were the only
        callers anywhere in the codebase). Both are infrequent, user-
        initiated actions, so the extra latency of a real API call here is
        an accepted trade, not an oversight.

        A delivery failure is logged, not raised. Both call sites
        (CheckEmailAPIView — which runs on every login attempt for an
        unverified user, not just account setup — and the password-reset
        request flow) have no error handling above them, and previously a
        failed send was invisible to the caller: `.delay()` returned before
        the send even started, so nothing could turn an email-provider
        hiccup into a failed request. Swallowing the error here preserves
        that guarantee. What it does NOT preserve is Celery's automatic 5x
        retry-with-backoff — a synchronous retry loop would add whole
        seconds to a request meant to cost "a few hundred milliseconds," so
        this sends once and gives up.
        """
        try:
            email = sib_api_v3_sdk.SendSmtpEmail(
                to=[{"email": to_email}],
                sender={
                    "email": from_email,
                    "name": "Ekaton",
                },
                subject=subject,
                html_content=html,
            )

            response = _api_instance.send_transac_email(email)

            logger.info("Email sent successfully to %s", to_email)

            return response.to_dict()

        except ApiException as e:
            logger.error("Failed to send email to %s: %s", to_email, str(e))
            return None
