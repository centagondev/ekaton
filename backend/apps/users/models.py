from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin
from django.db import models

from apps.users.managers import UserManager
from core.base_model import BaseModel


class User(BaseModel, AbstractBaseUser, PermissionsMixin):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"

    full_name = models.CharField(max_length=255)
    batch = models.CharField(max_length=100)

    email = models.EmailField(unique=True)

    gender = models.CharField(
        max_length=10,
        choices=Gender.choices,
    )

    profile_photo = models.URLField(blank=True, null=True)

    can_edit_name = models.BooleanField(default=False)

    is_available = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)

    is_verified = models.BooleanField(default=False)

    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"

    REQUIRED_FIELDS = ["full_name", "batch"]

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.email
