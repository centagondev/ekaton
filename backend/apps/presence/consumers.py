from __future__ import annotations

import asyncio
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .constants import PLATFORM_KEEPALIVE_INTERVAL, PLATFORM_PRESENCE_GROUP
from .seed_services import SeedService
from .services import PlatformPresenceService

logger = logging.getLogger(__name__)


class PlatformPresenceConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for platform-wide user presence.

    Responsibilities:
    - Authenticate users.
    - Track online users.
    - Join the platform presence group.
    - Keep the presence lease alive for as long as the socket is open.
    - Broadcast online count on connect and disconnect.
    """

    user = None
    group_name = PLATFORM_PRESENCE_GROUP
    _keepalive_task: asyncio.Task | None = None

    async def connect(self) -> None:
        """
        Handle a new WebSocket connection.

        Rejects anonymous users with close code 4001.
        """
        user = self.scope.get("user")

        if user is None or user.is_anonymous:
            logger.warning(
                "Rejected anonymous WebSocket connection attempt "
                "to platform presence. Channel: '%s'.",
                self.channel_name,
            )
            await self.close(code=4001)
            return

        self.user = user
        presence_registered = False

        try:
            await self.join_platform_group()
            await self.accept()
            await self.mark_user_online()
            presence_registered = True
            self._start_keepalive()
            await self.send_online_count()
            await self.broadcast_online_count()
        except Exception:
            logger.exception("Failed to initialize platform presence connection")
            await self._stop_keepalive()
            if presence_registered:
                await self.mark_user_offline()
            await self.leave_platform_group()
            await self.close()
            return

        logger.info(
            "WebSocket connected: user='%s', channel='%s'.",
            self.user.id,
            self.channel_name,
        )

    async def disconnect(
        self,
        close_code: int,
    ) -> None:
        """
        Handle WebSocket disconnection.

        If the user was never authenticated (rejected before accept),
        no group operations or presence updates are performed.
        """
        if self.user is None:
            return

        logger.info(
            "WebSocket disconnecting: user='%s', channel='%s', code=%s.",
            self.user.id,
            self.channel_name,
            close_code,
        )

        # Stop renewals before deregistering, otherwise an in-flight keepalive
        # tick could re-register the connection after it has been removed.
        await self._stop_keepalive()

        try:
            await self.mark_user_offline()
            await self.broadcast_online_count()
        except Exception:
            logger.exception("Failed to finalize platform presence connection")
        finally:
            await self.leave_platform_group()

    async def join_platform_group(self) -> None:
        """
        Add the current connection to the platform group.
        """
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )
        logger.debug(
            "Channel '%s' joined group '%s'.",
            self.channel_name,
            self.group_name,
        )

    async def leave_platform_group(self) -> None:
        """
        Remove the current connection from the platform group.
        """
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name,
        )
        logger.debug(
            "Channel '%s' left group '%s'.",
            self.channel_name,
            self.group_name,
        )

    def _start_keepalive(self) -> None:
        """
        Start renewing this connection's presence lease server-side.
        """
        self._keepalive_task = asyncio.create_task(self._keepalive())

    async def _stop_keepalive(self) -> None:
        """
        Cancel the keepalive loop and wait for it to finish.

        Awaiting the cancellation matters: a renewal that is already in flight
        must not be allowed to complete after the connection has been
        deregistered, or it would re-register a closed connection for a full
        TTL and leave the user counted as online.
        """
        task, self._keepalive_task = self._keepalive_task, None

        if task is None:
            return

        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    async def _keepalive(self) -> None:
        """
        Renew the presence lease for as long as this socket is open.

        Presence entries expire after PLATFORM_CONNECTION_TTL seconds. Renewing
        them here rather than from inbound client messages keeps the online
        count correct even when the browser sends no application traffic:
        backgrounded tabs, sleeping devices, and clients with no heartbeat of
        their own all stay counted. Protocol-level ping/pong frames are handled
        by the ASGI server and never reach the consumer, so they cannot be used
        for this.
        """
        while True:
            await asyncio.sleep(PLATFORM_KEEPALIVE_INTERVAL)
            try:
                await self.refresh_user_presence()
            except Exception:
                # A failed renewal is recoverable: the next tick retries, and
                # the lease only lapses after several consecutive failures.
                logger.exception(
                    "Presence keepalive failed: user='%s', channel='%s'.",
                    self.user.id,
                    self.channel_name,
                )

    async def receive(
        self,
        text_data: str | None = None,
        bytes_data: bytes | None = None,
        **kwargs,
    ) -> None:
        """
        Ignore everything the client sends.

        This channel is send-only: presence is maintained entirely by the
        server-side keepalive, so a client has nothing it needs to tell us.

        Overriding receive rather than receive_json is deliberate. The JSON
        base class decodes the frame before dispatching, so malformed payloads
        raise JSONDecodeError and binary frames raise ValueError, both of which
        would propagate out of the consumer and drop the connection. Discarding
        the frame here costs no parsing, no Redis call, and cannot be used to
        flood the shared connection pool.
        """
        return

    async def refresh_user_presence(self) -> None:
        """
        Extend the presence lease for this connection.
        """
        await database_sync_to_async(
            PlatformPresenceService.refresh_connection,
        )(
            self.user.id,
            self.channel_name,
        )

    async def mark_user_online(self) -> None:
        """
        Mark the authenticated user as online.
        """
        await database_sync_to_async(
            PlatformPresenceService.mark_online,
        )(
            self.user.id,
            self.channel_name,
        )

    async def mark_user_offline(self) -> None:
        """
        Remove the authenticated user from the online presence set.
        """
        await database_sync_to_async(
            PlatformPresenceService.mark_offline,
        )(
            self.user.id,
            self.channel_name,
        )

    async def send_online_count(self) -> None:
        """
        Send the current display count to this client only.

        Used on connect so a new client sees the right number immediately,
        without making every other client pay for a group broadcast.
        """
        count = await database_sync_to_async(
            SeedService.get_display_count,
        )()

        await self.send_json(
            {
                "type": "platform.online_count",
                "count": count,
            },
        )

    async def broadcast_online_count(self) -> None:
        """
        Tell every connected client the latest display count.

        Debounced in Redis across all workers: during a connect burst only the
        first caller in each window actually sends, and the periodic
        reconciler settles the final value.
        """
        count = await database_sync_to_async(
            PlatformPresenceService.claim_broadcast,
        )()

        if count is None:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "platform.online_count",
                "count": count,
            },
        )

        await database_sync_to_async(
            PlatformPresenceService.record_broadcast,
        )(count)

    async def platform_online_count(
        self,
        event: dict,
    ) -> None:
        """
        Send the latest online user count to the connected client.
        """
        await self.send_json(
            {
                "type": "platform.online_count",
                "count": event["count"],
            },
        )
