from channels.generic.websocket import AsyncWebsocketConsumer
from .services import get_private_chat_room
from asgiref.sync import sync_to_async

class ChatConsumer(AsyncWebsocketConsumer):
    """Handle WebSocket connections for private chat."""

    async def connect(self):
        user = self.scope["user"]

        room_id = self.scope["url_route"]["kwargs"]["room_id"]

        room = await sync_to_async(get_private_chat_room)(
            room_id,
            user
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
        """Handle WebSocket disconnection."""
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        pass