# Chat models are intentionally not registered with the admin site in this
# branch. Full admin configurations (list_display, search_fields, filters)
# will be added in a future branch alongside the moderation workflow.


from django.contrib import admin

from .models import PrivateMessage, Report

admin.site.register(PrivateMessage)
admin.site.register(Report)
