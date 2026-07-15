import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework.exceptions import ValidationError

from .services import (
    create_private_message,
    get_private_chat_room,
)


class ChatConsumer(AsyncWebsocketConsumer):
    """Handle WebSocket connections for private chat."""

    async def connect(self):
        """Accept a WebSocket connection for an authorized chat participant."""

        user = self.scope["user"]
        room_id = self.scope["url_route"]["kwargs"]["room_id"]

        room = await sync_to_async(get_private_chat_room)(
            room_id,
            user,
        )

        if room is None:
            await self.close()
            return

        self.room = room
        self.room_id = str(room.id)
        self.room_group_name = f"chat_{self.room_id}"

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

    async def disconnect(self, close_code):
        """Remove the socket from the chat group."""

        if hasattr(self, "room_group_name"):
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
            private_message = await sync_to_async(
                create_private_message
            )(
                room=self.room,
                sender=self.scope["user"],
                message=message,
            )

        except ValidationError as exc:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": exc.messages[0],
                    }
                )
            )
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "id": str(private_message.id),
                "sender": private_message.sender.email,
                "message": private_message.message,
                "created_at": private_message.created_at.isoformat(),
            },
        )

    async def handle_typing(self, data):
        """Broadcast typing status to the chat room."""

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