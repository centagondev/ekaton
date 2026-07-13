from django.contrib import admin

from .models import PasswordResetToken

admin.site.register(PasswordResetToken)
