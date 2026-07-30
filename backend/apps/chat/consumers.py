import asyncio
import json
import logging
import time

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework.exceptions import ValidationError

from core.encryption import decrypt_message
from core.redis import redis_client

logger = logging.getLogger("chat")

# A private room exists only for active conversations: if neither participant
# sends a real chat message for this long, the room is ended automatically.
IDLE_TIMEOUT_SECONDS = 300

# One socket per participant per room. Opening the same room in a second tab
# would otherwise put three sockets in a two-person group, so the extra one is
# refused with a code the client can tell apart from a real error.
CONNECTION_KEY_PREFIX = "chat_conn"

# Backstop only, in case a process dies without running disconnect(). Well
# beyond any real conversation, which releases the slot the moment it ends.
CONNECTION_TTL_SECONDS = 60 * 60 * 12

# At most one real chat message per participant per cooldown window. Applied
# before any DB work so a flooding socket costs one Redis round trip, not an
# encrypt + insert + broadcast. Typing and system events are unaffected.
MESSAGE_COOLDOWN_SECONDS = 1

from .services import (
    create_private_message,
    create_reveal_request,
    end_private_chat_room,
    get_pending_reveal_request,
    get_private_chat_room,
    respond_to_reveal_request,
)


class ChatConsumer(AsyncWebsocketConsumer):
    """Handle WebSocket connections for private chat."""

    async def connect(self):
        """Accept a WebSocket connection for an authorized chat participant."""

        user = self.scope["user"]

        if user.is_anonymous:
            await self.close(code=4001)
            return

        room_id = self.scope["url_route"]["kwargs"]["room_id"]

        room = await sync_to_async(get_private_chat_room)(
            room_id,
            user,
        )

        if room is None:
            await self.close(code=4004)
            return

        if room.status != room.Status.ACTIVE:
            await self.close(code=4001)
            return

        # Claim this participant's single slot in the room. SET NX is atomic,
        # so of two tabs racing to connect exactly one wins. The key is only
        # remembered after a successful claim: a refused socket must never be
        # able to release the slot the winner is holding.
        conn_key = f"{CONNECTION_KEY_PREFIX}:{room.id}:{user.id}"
        claimed = await sync_to_async(redis_client.set)(
            conn_key,
            self.channel_name,
            nx=True,
            ex=CONNECTION_TTL_SECONDS,
        )

        if not claimed:
            logger.info(
                "Refused duplicate socket for user %s in room %s",
                user.id,
                room.id,
            )
            await self.close(code=4008)
            return

        self._conn_key = conn_key
        self.room = room
        self.room_id = str(room.id)
        self.room_group_name = f"chat_{self.room_id}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()
        logger.info("User %s connected to room %s", user.id, self.room_id)

        # Idle timeout: authoritative on the server. The deadline is reset
        # ONLY by real chat messages (see chat_message) — never by typing,
        # reveal, or system events.
        self._reset_idle_timer()
        self._idle_task = asyncio.create_task(self._idle_watchdog())

    async def disconnect(self, close_code):
        """Remove the socket from the chat group."""

        if not hasattr(self, "room_group_name"):
            return

        await self._cancel_idle_watchdog()

        logger.info(
            "User %s disconnected from room %s (code=%s)",
            self.scope["user"].id,
            self.room_id,
            close_code,
        )
        try:

            await sync_to_async(end_private_chat_room)(self.room)

            await self.channel_layer.group_send(
                self.room_group_name, {"type": "chat_ended"}
            )
        except Exception:
            logger.exception(
                "Failed to clean up room %s during disconnect",
                self.room_id,
            )
        finally:
            # Release the participant's slot so they can open the room again.
            # Only this socket ever reaches here holding _conn_key — a refused
            # duplicate returns above, before room_group_name is set.
            if hasattr(self, "_conn_key"):
                await sync_to_async(redis_client.delete)(self._conn_key)

            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name,
            )

    # FIX 1: The entire body of receive() was unindented, placing it at module
    # scope instead of inside the class. This caused an IndentationError and
    # made the consumer non-functional. The body is now correctly indented.
    async def receive(self, text_data):
        """Route incoming WebSocket events."""

        try:
            data = json.loads(text_data)

        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Invalid JSON.",
                    }
                )
            )
            return

        if not isinstance(data, dict):
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Invalid JSON payload.",
                    }
                )
            )
            return

        event_type = data.get("type")

        # FIX: Restore backward compatibility. If the client doesn't send a "type"
        # but sends a "message" (the old payload format), default to "chat_message".
        if not event_type and "message" in data:
            event_type = "chat_message"

        handlers = {
            "chat_message": self.handle_chat_message,
            "typing": self.handle_typing,
            "reveal_request": self.handle_reveal_request,
            "reveal_response": self.handle_reveal_response,
            "skip_chat": self.handle_skip_chat,
        }

        handler = handlers.get(event_type)

        if handler is None:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Unsupported event type.",
                    }
                )
            )
            return

        await handler(data)

    # ------------------------------------------------------------------
    # Idle timeout
    # ------------------------------------------------------------------

    def _reset_idle_timer(self):
        """Push the idle deadline IDLE_TIMEOUT_SECONDS into the future."""
        self._idle_deadline = time.monotonic() + IDLE_TIMEOUT_SECONDS

    async def _cancel_idle_watchdog(self):
        task = getattr(self, "_idle_task", None)
        self._idle_task = None
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def _idle_watchdog(self):
        """End the room once neither participant has messaged for
        IDLE_TIMEOUT_SECONDS.

        Both participants' consumers run this watchdog and both reset on the
        same broadcast messages, so their deadlines agree to within delivery
        jitter. An atomic Redis SET NX claim guarantees that exactly ONE of
        them ends the room and broadcasts — the group then delivers the same
        chat_timeout event to both clients.
        """
        try:
            while True:
                remaining = self._idle_deadline - time.monotonic()
                if remaining > 0:
                    await asyncio.sleep(remaining)
                    continue

                claimed = await sync_to_async(redis_client.set)(
                    f"chat_idle_timeout:{self.room_id}",
                    "1",
                    nx=True,
                    ex=60,
                )
                if claimed:
                    await sync_to_async(end_private_chat_room)(self.room)
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {"type": "chat_timeout"},
                    )
                return
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "Idle watchdog failed for room %s",
                getattr(self, "room_id", "?"),
            )

    async def chat_timeout(self, event):
        """Deliver the inactivity end event, then close the socket."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "chat_timeout",
                    "message": "Chat ended due to inactivity.",
                }
            )
        )
        await self.close(code=4000)

    async def _ensure_active_room(self):
        """Ensure the current room still exists and is active."""

        room = await sync_to_async(get_private_chat_room)(
            self.room_id,
            self.scope["user"],
        )

        if room is None or room.status != room.Status.ACTIVE:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "This chat room is no longer active.",
                    }
                )
            )
            await self.close(code=4000)
            return None

        self.room = room
        return room

    async def handle_chat_message(self, data):
        """Validate, persist and broadcast a chat message."""

        message = data.get("message")

        if not isinstance(message, str):
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Message must be a string.",
                    }
                )
            )
            return

        message = message.strip()

        if not message:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Message cannot be empty.",
                    }
                )
            )
            return

        if len(message) > 500:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Message exceeds the maximum length.",
                    }
                )
            )
            return

        # SET NX is atomic, so two frames arriving together cannot both pass.
        allowed = await sync_to_async(redis_client.set)(
            f"chat_msg_cooldown:{self.room_id}:{self.scope['user'].id}",
            1,
            nx=True,
            ex=MESSAGE_COOLDOWN_SECONDS,
        )

        if not allowed:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "You're sending messages too quickly.",
                    }
                )
            )
            return

        try:
            room = await self._ensure_active_room()
            if room is None:
                return

            private_message = await sync_to_async(create_private_message)(
                room=room,
                sender=self.scope["user"],
                message=message,
            )

        except ValidationError as exc:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": str(exc.detail[0]),
                    }
                )
            )
            return

        try:
            plaintext = decrypt_message(private_message.message)
        except Exception:
            logger.exception(
                "Failed to decrypt message %s for broadcast in room %s",
                private_message.id,
                self.room_id,
            )
            plaintext = private_message.message

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "id": str(private_message.id),
                "sender": private_message.sender.email,
                "message": plaintext,
                "created_at": private_message.created_at.isoformat(),
            },
        )

    async def handle_typing(self, data):
        """Broadcast typing status to the chat room."""

        room = await self._ensure_active_room()
        if room is None:
            return

        is_typing = bool(data.get("is_typing", False))

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "typing",
                "sender": self.scope["user"].email,
                "is_typing": is_typing,
            },
        )

    async def chat_message(self, event):
        """Send a chat message event to the connected client."""

        # Every REAL message — from either participant — resets the idle
        # countdown. Typing, reveal and system events deliberately do not
        # pass through here and so never reset it.
        self._reset_idle_timer()

        await self.send(
            text_data=json.dumps(
                {
                    "type": event["type"],
                    "id": event["id"],
                    "sender": event["sender"],
                    "message": event["message"],
                    "created_at": event["created_at"],
                }
            )
        )

    async def typing(self, event):
        """Send a typing indicator event to the connected client."""

        await self.send(
            text_data=json.dumps(
                {
                    "type": "typing",
                    "sender": event["sender"],
                    "is_typing": event["is_typing"],
                }
            )
        )

    async def handle_reveal_request(self, data):
        room = await self._ensure_active_room()
        if room is None:
            return

        requester = self.scope["user"]
        if room.user_one == requester:
            receiver = room.user_two
        else:
            receiver = room.user_one

        try:
            await sync_to_async(create_reveal_request)(
                room=room, requester=requester, receiver=receiver
            )
        except ValidationError as exc:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": str(exc.detail[0]),
                    }
                )
            )
            return
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "reveal_request", "requester_id": str(requester.id)},
        )

    async def reveal_request(self, event):
        """Send reveal request event to participants."""
        if str(self.scope["user"].id) == str(event["requester_id"]):
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "reveal_request_sent",
                        "message": "Waiting for the other user to respond.",
                    }
                )
            )
        else:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "reveal_request_received",
                        "message": "The other user wants to reveal their identity.",
                    }
                )
            )

    async def handle_reveal_response(self, data):
        """Handle a reveal request response."""

        room = await self._ensure_active_room()
        if room is None:
            return

        status = data.get("status")

        if status not in ("accepted", "rejected"):
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Invalid reveal response.",
                    }
                )
            )
            return

        reveal_request = await sync_to_async(get_pending_reveal_request)(
            room=room,
            receiver=self.scope["user"],
        )

        if reveal_request is None:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "No pending reveal request found.",
                    }
                )
            )
            return

        try:
            reveal_request = await sync_to_async(respond_to_reveal_request)(
                reveal_request=reveal_request,
                receiver=self.scope["user"],
                status=status,
            )
        except ValidationError as exc:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": str(exc.detail[0]),
                    }
                )
            )
            return

        if status == "accepted":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "reveal_success",
                },
            )
        else:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "reveal_rejected",
                },
            )

    async def reveal_success(self, event):
        """Send reveal success event to participants."""
        if self.scope["user"].id == self.room.user_one.id:
            other_user = self.room.user_two
        else:
            other_user = self.room.user_one

        await self.send(
            text_data=json.dumps(
                {
                    "type": "reveal_success",
                    "message": "Identity reveal accepted.",
                    "user": {
                        "id": str(other_user.id),
                        "full_name": other_user.full_name,
                        "email": other_user.email,
                        "batch": other_user.batch,
                        "profile_photo": (
                            other_user.profile_photo
                            if other_user.profile_photo
                            else None
                        ),
                    },
                }
            )
        )

    async def reveal_rejected(self, event):
        """Send reveal rejected event to participants."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "reveal_rejected",
                    "message": "Reveal request was rejected.",
                }
            )
        )

    async def handle_skip_chat(self, data):
        room = await self._ensure_active_room()
        if room is None:
            return

        await sync_to_async(end_private_chat_room)(room)

        await self.channel_layer.group_send(
            self.room_group_name, {"type": "chat_skipped"}
        )

    async def chat_skipped(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": "chat_skipped", "message": "Chat skipped successfully"}
            )
        )

        await self.close()

    async def chat_ended(self, event):
        """Send chat ended event and close the connection."""
        await self.send(
            text_data=json.dumps(
                {
                    "type": "chat_ended",
                    "message": "The chat has been ended.",
                }
            )
        )
        await self.close(code=4000)
