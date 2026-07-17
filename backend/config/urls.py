from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    # API v1 — Application endpoints
    path("api/v1/accounts/", include("apps.accounts.urls")),
    path("api/v1/users/", include("apps.users.urls")),
    path("api/v1/chat/", include("apps.chat.urls")),
    path("api/v1/events/", include("apps.events.urls")),
    path("api/v1/complaints/", include("apps.complaints.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/admin/", include("apps.administration.urls")),
]


# ---------------------------------------------------------------------------
# Development-only URL patterns — ONLY loaded when DEBUG = True.
#
# In production (DEBUG = False):
#   - These imports never execute.
#   - These URL patterns are never registered.
#   - Visiting /api/schema/, /api/docs/, or /api/redoc/ returns a 404.
#   - No API structure, no endpoint list, and no schema is exposed publicly.
# ---------------------------------------------------------------------------
if settings.DEBUG:
    from drf_spectacular.views import (SpectacularAPIView,
                                       SpectacularRedocView,
                                       SpectacularSwaggerView)

    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
        path(
            "api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"
        ),
    ]
