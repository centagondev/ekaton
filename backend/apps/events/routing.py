from django.urls import path

from .consumers import EventConsumer

websocket_urlpatterns = [
    path(
        "ws/events/<uuid:event_id>/",
        EventConsumer.as_asgi(),
    )
]
