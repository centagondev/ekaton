from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    # API endpoints
    path("api/v1/accounts/", include("apps.accounts.urls")),
    path("api/v1/users/", include("apps.users.urls")),
    path("api/v1/chat/", include("apps.chat.urls")),
    path("api/v1/events/", include("apps.events.urls")),
    path("api/v1/complaints/", include("apps.complaints.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/admin/", include("apps.administration.urls")),
]
