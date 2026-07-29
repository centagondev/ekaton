from django.urls import path

from .consumers import PublicSpeakingConsumer

# Added to the ASGI router ONLY when settings.PUBLIC_SPEAKING_MODE is on.
websocket_urlpatterns = [
    path("ws/public-speaking/", PublicSpeakingConsumer.as_asgi()),
]
