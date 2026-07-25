
from django.urls import re_path

from .consumers import PlatformPresenceConsumer

websocket_urlpatterns=[
    re_path(r"ws/platform-presence/$",
    PlatformPresenceConsumer.as_asgi()),
    
]