from django.urls import path

from .consumers import ChatConsumer

websocket_urlpatters = [
    path(
        "ws/chat/<uuid:room_id>/", ChatConsumer.as_asgi(),
    )
]