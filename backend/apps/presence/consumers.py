from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from .services import PlatformPresenceService


class PlatformPresenceConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for platform-wide user presence.

    Responsibilities:
    - Authenticate users.
    - Track online users.
    - Join the platform presence group.
    """
    async def connect(self):
        """
        Handle a new WebSocket connection.

        Flow:
        1. Reject unauthenticated users.
        2. Join the platform presence group.
        3. Accept the connection.
        4. Mark the user as online.
        """
        self.group_name ="platform_presence"
        user=self.scope.get("user")
        
        if user is None or user.is_anonymous :
            await self.close(code=4001)
            return
        
        self.user=user
        
        await self.join_platform_group()
        
        await self.accept()
        
        await self.mark_user_online()
        
    async def disconnect(self, close_code):
        
        """
        Handle WebSocket disconnection.
        """
        
        if hasattr(self,"user"):
            await self.mark_user_offline()
            
        await self.leave_platform_group()
        
    async def join_platform_group(self):
        
        """
        Add the current connection to the platform group.
        """
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        
    async def leave_platform_group(self):
        """
        Remove the current connection from the platform group.
        """
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        
    async def receive_json(self, content,**kwargs):
        """
        Platform presence currently does not receive messages.
        """
        return
        
    async def mark_user_online(self):
        """
        Mark the authenticated user as online.
        """
        
        await database_sync_to_async(PlatformPresenceService.mark_online)(self.user.id)
    
    async def mark_user_offline(self):
        """
        Remove the authenticated user from the online presence set.
        """
        await database_sync_to_async(PlatformPresenceService.mark_offline)(self.user.id)
        
        
