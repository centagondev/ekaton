import logging
import time

import sib_api_v3_sdk
from django.conf import settings
from sib_api_v3_sdk.rest import ApiException

logger = logging.getLogger("email")

configuration = sib_api_v3_sdk.Configuration()
configuration.api_key["api-key"] = settings.BREVO_API_KEY

_api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
    sib_api_v3_sdk.ApiClient(configuration)
)

# (connect, read) seconds for the call to api.brevo.com.
#
# The SDK defaults to no timeout at all: sib_api_v3_sdk.rest passes
# `timeout=None` straight through to urllib3, which means block forever. A
# stalled connection — an egress rule, a DNS answer that never comes, a
# half-open socket — therefore pinned the request thread indefinitely, and
# because the send happens inline (see send_email below) the caller's HTTP
# request hung with it. A bounded wait turns that into a logged failure.
BREVO_TIMEOUT = (5, 15)


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

        Every outcome is logged, because this is the only record that the
        send happened at all. Note that "swallowed" is not "silent": the
        except branches below are the sole evidence a delivery failed, so
        removing a log line here removes the ability to debug the flow in
        production.
        """
        started = time.monotonic()
        logger.info("Sending email to %s (subject=%r, from=%s)", to_email, subject, from_email)

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

            response = _api_instance.send_transac_email(
                email, _request_timeout=BREVO_TIMEOUT
            )

            elapsed_ms = (time.monotonic() - started) * 1000
            result = response.to_dict()
            logger.info(
                "Email accepted by Brevo for %s in %.0fms (message_id=%s)",
                to_email,
                elapsed_ms,
                result.get("message_id") or result.get("messageId"),
            )

            return result

        except ApiException as e:
            # Brevo answered and refused: bad API key, unverified sender
            # domain, blocked recipient, quota. The body carries the reason,
            # and without it "failed to send" is unactionable.
            elapsed_ms = (time.monotonic() - started) * 1000
            logger.error(
                "Brevo rejected the email to %s after %.0fms "
                "(status=%s, reason=%s, body=%s)",
                to_email,
                elapsed_ms,
                getattr(e, "status", None),
                getattr(e, "reason", None),
                getattr(e, "body", None),
            )
            return None

        except Exception:
            # Everything that is not an API-level refusal: DNS failure, egress
            # blocked, TLS error, timeout. None of these are ApiException, so
            # they used to propagate out of here, out of the view, and become
            # an opaque 500 — which Django then declined to log at all under
            # DEBUG=False (see the django.request logger in settings). That
            # combination is how a broken email path could look like nothing
            # happening whatsoever. Caught here so the failure is recorded and
            # the caller keeps the "a send never fails the request" contract
            # described above.
            elapsed_ms = (time.monotonic() - started) * 1000
            logger.exception(
                "Email to %s failed before Brevo answered, after %.0fms "
                "(network, DNS, TLS or timeout)",
                to_email,
                elapsed_ms,
            )
            return None
