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

from apps.chat.middleware import JwtAuthMiddleware
from apps.chat.routing import \
    websocket_urlpatterns as chat_websocket_urlpatterns
from apps.events.routing import \
    websocket_urlpatterns as event_websocket_urlpatterns

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JwtAuthMiddleware(
            URLRouter(chat_websocket_urlpatterns + event_websocket_urlpatterns)
        ),
    }
)
