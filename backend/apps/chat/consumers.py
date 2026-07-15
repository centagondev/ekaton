import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework.exceptions import ValidationError

from .services import create_private_message, get_private_chat_room


class ChatConsumer(AsyncWebsocketConsumer):
    """Handle WebSocket connections for private chat."""

    async def connect(self):
        print("1. Connect called")
        user = self.scope["user"]
        print("2. User:", user)

        room_id = self.scope["url_route"]["kwargs"]["room_id"]
        print("3. Room ID:", room_id)

        room = await sync_to_async(get_private_chat_room)(room_id, user)

        if room is None:
            print("5. Room not found")
            await self.close()
            return

        print("4. Room:", room.id)

        self.room = room
        self.room_id = str(room.id)
        self.room_group_name = f"chat_{self.room_id}"
        print("6. Before group_add")

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )
        print("7. After group_add")
        await self.accept()

        print("8. Accepted")

    async def disconnect(self, close_code):
        print("Disconnected:", close_code)
        """Handle WebSocket disconnection."""
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name, self.channel_name
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps({"type": "error", "message": "Invalid JSON"})
            )
            return

        if not isinstance(data, dict):
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Invalid JSON payload."}
                )
            )
            return

        message = data.get("message")

        if not isinstance(message, str):
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Message must be string."}
                )
            )

            return

        message = message.strip()

        if not message:
            await self.send(
                text_data=json.dumps(
                    {
                        "type": "error",
                        "message": "Message cannot be empty",
                    }
                )
            )
            return

        if len(message) > 500:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Message exceeds the maximum length ."}
                )
            )
            return

        try:
            private_message = await sync_to_async(create_private_message)(
                room=self.room, sender=self.scope["user"], message=message
            )

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
        except ValidationError as exc:
            await self.send(
                text_data=json.dumps({"type": "error", "message": exc.messages[0]})
            )
            return

    async def chat_message(self, event):
     """Send chat messages to every WebSocket in the room."""

     await self.send(
         text_data = json.dumps(
             {
                   "type": event["type"],
                "id": event["id"],
                "sender": event["sender"],
                "message": event["message"],
                "created_at": event["created_at"],
            }

         )
     )