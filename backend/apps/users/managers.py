from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    """
    Custom manager for the User model.
    Responsible for creating normal users and superusers.
    """

    def create_user(self, email, password=None, **extra_fields):
        """
        Creates and saves a regular user.
        """
        if not email:
            raise ValueError("Email address is required")

        # Convert email to a normalized format.
        # Example: USER@GMAIL.COM -> USER@gmail.com

        email = self.normalize_email(email)

        # Create a User object in memory (not yet saved to the database).
        user = self.model(email=email, **extra_fields)

        # Hash the plain-text password before storing it.
        user.set_password(password)

        # Save the user object into the database.
        user.save()

        return user

    def create_superuser(self, email, password, **extra_fields):
        """
        Create and return a superuser with all required permissions enabled.

        This method ensures that the user has:
        - is_staff = True
        - is_superuser = True
        - is_active = True

        It reuses create_user() to avoid duplicating user creation logic.
        """

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff = True")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email=email, password=password, **extra_fields)
