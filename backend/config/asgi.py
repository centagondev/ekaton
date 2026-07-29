"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

# ruff: noqa: E402

import os

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings",
)

from django.core.asgi import get_asgi_application

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.conf import settings

from apps.chat.middleware import JwtAuthMiddleware
from apps.chat.routing import websocket_urlpatterns as chat_websocket_urlpatterns
from apps.events.routing import websocket_urlpatterns as event_websocket_urlpatterns
from apps.presence.routing import (
    websocket_urlpatterns as platform_websocket_urlpatterns,
)

websocket_urlpatterns = (
    chat_websocket_urlpatterns
    + event_websocket_urlpatterns
    + platform_websocket_urlpatterns
)

# Temporary public speaking mode. The route is appended only while the flag is
# on, so with it off the demo socket is not in the router and connecting to it
# is refused — the same as before the feature existed. It still sits behind
# JwtAuthMiddleware, which simply leaves scope["user"] anonymous when no token
# is present; the consumer authenticates from its own session token instead.
if settings.PUBLIC_SPEAKING_MODE:
    from apps.public_speaking.routing import (
        websocket_urlpatterns as public_speaking_websocket_urlpatterns,
    )

    websocket_urlpatterns += public_speaking_websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JwtAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
