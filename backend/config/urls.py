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
# Temporary public speaking mode.
#
# These are the project's only unauthenticated endpoints, so they are added
# here rather than inside the app: with PUBLIC_SPEAKING_MODE off the include
# never runs, the routes are not in the URLconf at all, and every demo path
# returns 404. Turning the flag off is therefore a complete removal of the
# public surface, not a permission check that could be got around.
# ---------------------------------------------------------------------------
if settings.PUBLIC_SPEAKING_MODE:
    urlpatterns += [
        path("api/v1/public-speaking/", include("apps.public_speaking.urls")),
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
    from drf_spectacular.views import (
        SpectacularAPIView,
        SpectacularRedocView,
        SpectacularSwaggerView,
    )

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
