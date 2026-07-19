import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.users.models import User

logger = logging.getLogger("authentication")


@database_sync_to_async
def get_user(user_id):
    """Return the authenticated user for the given ID."""
    return User.objects.filter(id=user_id, is_active=True, is_verified=True).first()


class JwtAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope["query_string"].decode()
        query_params = parse_qs(query_string)

        token = query_params.get("token", [None])[0]

        scope["user"] = AnonymousUser()

        if token:
            try:
                access_token = AccessToken(token)
                user = await get_user(access_token["user_id"])

                if user:
                    scope["user"] = user

            except (TokenError, KeyError):
                logger.warning(
                    "WebSocket auth failed: invalid token from %s",
                    scope.get("client"),
                )

        return await self.inner(scope, receive, send)
