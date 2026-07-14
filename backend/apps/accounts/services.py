import logging
from datetime import timedelta
from secrets import token_urlsafe

from apps.users.models import User
from core.email import EmailService
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from resend.exceptions import ResendError
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AccountSetupToken

logger = logging.getLogger("authentication")


def get_email_status(email):
    """
    Retrieves the verification status of a user by their email address.
    """

    user = User.objects.filter(email=email).first()

    if user is None:
        return None

    return {"exists": True, "is_verified": user.is_verified, "user": user}


@transaction.atomic
def set_password(account_setup_token, password):
    """Sets a new password for an unverified user and marks them as verified."""

    user = account_setup_token.user

    if user.is_verified:
        logger.warning(
            "Failed password setup: Account already verified for user_id=%s", user.id
        )
        raise ValidationError(
            {"password": "A password has already been set for this account."}
        )

    validate_password(password, user)
    user.set_password(password)
    user.is_verified = True

    user.save(update_fields=["password", "is_verified"])
    account_setup_token.used = True
    account_setup_token.save(update_fields=["used"])

    logger.info("Password setup completed successfully for user_id=%s", user.id)
    return user


def generate_account_setup_token(user):
    """
    Generate and store a secure one-time account token.
    """

    AccountSetupToken.objects.filter(user=user, used=False).update(used=True)

    account_setup_token = AccountSetupToken.objects.create(
        user=user,
        token=token_urlsafe(32),
        expires_at=timezone.now() + timedelta(minutes=30),
    )

    logger.info("Account setup token generated for user_id=%s", user.id)
    return account_setup_token


def get_valid_account_setup_token(token):
    """
    Retrieve and validate a password reset token.
    """
    account_setup_token = (
        AccountSetupToken.objects.select_related("user").filter(token=token).first()
    )

    if account_setup_token is None:
        logger.warning("Failed password setup: Invalid token provided.")
        raise ValidationError("The provided password setup link is invalid.")

    if account_setup_token.used:
        logger.warning(
            "Failed password setup: Reused token for user_id=%s",
            account_setup_token.user.id,
        )
        raise ValidationError("This password setup link has already been used.")

    if account_setup_token.expires_at < timezone.now():
        logger.warning(
            "Failed password setup: Expired token for user_id=%s",
            account_setup_token.user.id,
        )
        raise ValidationError(
            "This password setup link has expired. Please request a new one."
        )

    return account_setup_token


def send_account_setup_email(account_setup_token):
    """
    Print the password setup link during development.
    """

    frontend_url = settings.FRONTEND_URL

    link = f"{frontend_url}/set-password" f"?token={account_setup_token.token}"
    try:
        html_message = render_to_string("emails/account_setup.html", {"link": link})
        EmailService.send_email(
            to_email=account_setup_token.user.email,
            subject="Set new password",
            html=html_message,
        )
    except ResendError:
        logger.exception("Failed to send password setup email")
        raise ValidationError(
            "Unable to send the password setup email. Please try again"
        )


def login_user(request, email, password):
    """Authenticates a user and generates JWT access and refresh tokens."""

    user = authenticate(request=request, email=email, password=password)

    if user is None:
        logger.warning("Failed login attempt for email='%s'", email)
        raise AuthenticationFailed("The provided email or password is incorrect.")

    if not user.is_active:
        logger.warning("Failed login attempt: Inactive account for user_id=%s", user.id)
        raise AuthenticationFailed("This account is currently inactive.")

    if not user.is_verified:
        logger.warning(
            "Failed login attempt: Unverified account for user_id=%s", user.id
        )
        raise AuthenticationFailed("Your account has not been activated yet.")

    refresh = RefreshToken.for_user(user)

    logger.info("Successful login for user_id=%s", user.id)
    return {"user": user, "access": str(refresh.access_token), "refresh": str(refresh)}


def logout_user(refresh_token):
    """
    Blacklist a refresh token.
    """

    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError:
        raise ValidationError("The refresh token is invalid or has already expired.")
