import json
import logging

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework.exceptions import ValidationError

from core.encryption import decrypt_message

logger = logging.getLogger("chat")

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
        
        if room.status!=room.Status.ACTIVE:
            await self.close(code=4001)
            return

        self.room = room
        self.room_id = str(room.id)
        self.room_group_name = f"chat_{self.room_id}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()
        logger.info("User %s connected to room %s", user.id, self.room_id)

    async def disconnect(self, close_code):
        """Remove the socket from the chat group."""

        if not hasattr(self, "room_group_name"):
            return
        
        logger.info(
                "User %s disconnected from room %s (code=%s)",
                self.scope["user"].id,
                self.room_id,
                close_code,
            )
        try:

            await sync_to_async(end_private_chat_room)(self.room)

            await self.channel_layer.group_send(
                self.room_group_name,{
                    "type": "chat_ended"
                }
            )
        except Exception:
            logger.exception(
                "Failed to clean up room %s during disconnect",
                self.room_id,
                )
        finally:
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
