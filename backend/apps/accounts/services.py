import logging
from datetime import timedelta
from secrets import token_urlsafe

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

from apps.users.models import User
from core.email import EmailService

from .models import AccountSetupToken, PasswordResetToken

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
    Retrieve and validate an account setup token.
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
    Sends an account setup email to a newly created user.

    Constructs a secure one-time account setup link and delivers it
    via the project email service.
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


# Password Reset
# ==========================================================


def generate_password_reset_token(user):
    """Generate and store a secure one-time password reset token.

    Any previously issued unused password reset tokens for the same user
    are invalidated before creating a new token.

    Args:
        user (User): The verified user requesting a password reset.

    Returns:
        PasswordResetToken: The newly created password reset token instance.
    """

    # Invalidates old tokens
    PasswordResetToken.objects.filter(
        user=user,
        used=False,
    ).update(used=True)

    password_reset_token = PasswordResetToken.objects.create(
        user=user,
        token=token_urlsafe(32),
        expires_at=timezone.now() + settings.PASSWORD_RESET_TOKEN_LIFETIME,
    )

    logger.info(
        "Password reset token generated for user_id=%s",
        user.id,
    )

    return password_reset_token


def get_valid_password_reset_token(token):
    """Retrieve and validate a password reset token.

    Ensures the token exists, has not expired, has not been used,
    and belongs to an active, verified user.
    """
    password_reset_token = (
        PasswordResetToken.objects.select_related("user").filter(token=token).first()
    )

    if password_reset_token is None:
        logger.warning("Password reset failed: Invalid token provided.")
        raise ValidationError("The password reset link is invalid.")

    if password_reset_token.used:
        logger.warning(
            "Password reset failed: Reused token for user_id=%s",
            password_reset_token.user.id,
        )
        raise ValidationError("This password reset link has already been used.")

    if password_reset_token.expires_at < timezone.now():
        logger.warning(
            "Password reset failed: Expired token for user_id=%s",
            password_reset_token.user.id,
        )
        raise ValidationError(
            "This password reset link has expired. Please request a new one."
        )
    if not password_reset_token.user.is_active:
        logger.warning(
            "Password reset failed: Inactive account for user_id=%s",
            password_reset_token.user.id,
        )
        raise ValidationError("This account is currently inactive.")

    if not password_reset_token.user.is_verified:
        logger.warning(
            "Password reset failed: Unverified account for user_id=%s",
            password_reset_token.user.id,
        )
        raise ValidationError("Password reset is available only for verified accounts.")

    return password_reset_token


def request_password_reset(email):
    """Handle a password reset request.

    For security reasons, this function never reveals whether an account exists.
    Only active and verified users receive a password reset email.
    """

    user = User.objects.filter(email=email).first()

    if user is None:
        logger.info(
            "Password reset requested for unknown email='%s'",
            email,
        )
        return

    if not user.is_active:
        logger.warning(
            "Password reset requested for inactive user_id=%s",
            user.id,
        )
        return

    if not user.is_verified:
        logger.warning(
            "Password reset requested for unverified user_id=%s",
            user.id,
        )
        return

    password_reset_token = generate_password_reset_token(user)

    send_password_reset_email(password_reset_token)
    logger.info(
        "Password reset email sent successfully for user_id=%s",
        user.id,
    )


def send_password_reset_email(password_reset_token):
    """Send a password reset email containing a secure one-time link."""

    frontend_url = settings.FRONTEND_URL

    reset_link = f"{frontend_url}/reset-password" f"?token={password_reset_token.token}"

    try:
        html_message = render_to_string(
            "emails/password_reset.html",
            {
                "link": reset_link,
            },
        )

        EmailService.send_email(
            to_email=password_reset_token.user.email,
            subject="Reset your password",
            html=html_message,
        )

    except ResendError:
        logger.exception("Failed to send password reset email.")

        raise ValidationError(
            "Unable to send the password reset email. Please try again."
        )


@transaction.atomic
def reset_password(password_reset_token, password):
    """Reset the password for a verified user.

    Validates the password using Django's password validators, securely hashes it,
    marks the current reset token as used, invalidates any remaining unused
    reset tokens, and updates the user's password within a single database transaction.
    """

    user = password_reset_token.user

    validate_password(password, user)
    user.set_password(password)

    user.save(update_fields=["password"])
    password_reset_token.used = True
    password_reset_token.save(update_fields=["used"])

    PasswordResetToken.objects.filter(
        user=user,
        used=False,
    ).exclude(
        id=password_reset_token.id,
    ).update(used=True)

    logger.info(
        "Password reset completed successfully for user_id=%s",
        user.id,
    )
    return user


@transaction.atomic
def change_password(user, current_password, new_password):
    """Change the password for an authenticated user.

    Checks account status, verifies the current password, validates the new
    password against Django's password validators, securely hashes it,
    and saves the updated credentials within a single atomic database
    transaction.
    """
    if not user.is_active:
        logger.warning(
            "Password change failed: Inactive account for user_id=%s",
            user.id,
        )
        raise ValidationError("This account is currently inactive.")

    if not user.is_verified:
        logger.warning(
            "Password change failed: Unverified account for user_id=%s",
            user.id,
        )
        raise ValidationError("Your account has not been verified.")

    if not user.check_password(current_password):
        logger.warning(
            "Password change failed: Invalid current password for user_id=%s",
            user.id,
        )
        raise ValidationError(
            {"current_password": "The current password you entered is incorrect."}
        )

    if current_password == new_password:
        raise ValidationError(
            {
                "new_password": "The new password must be different from the current password."
            }
        )

    validate_password(new_password, user)
    user.set_password(new_password)
    user.save(update_fields=["password"])

    logger.info(
        "Password changed successfully for user_id=%s",
        user.id,
    )

    return user