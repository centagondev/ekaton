import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
import time
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import EventMessage, EventParticipant, EventStatus
from .serializers import EventMessageSerializer
from .services import send_event_message

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 1000


class EventConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for event chat.
    """

    async def connect(self):
        """
        Handle a new WebSocket connection.

        Flow:
        1. Reject unauthenticated users.
        2. Verify the authenticated user is an active participant of the event.
        3. Cache the participant for this WebSocket connection.
        4. Join the Redis group.
        5. Accept the WebSocket connection.
        6. Send recent message history to the connected user.
        """
        self.event_id = str(self.scope["url_route"]["kwargs"]["event_id"])

        self.group_name = f"event_{self.event_id}"

        # Get the authenticated user from the JWT middleware.
        user = self.scope.get("user")

        # Reject unauthenticated users.
        if user is None or user.is_anonymous:
            await self.close(code=4001)
            return

        try:  # Verify that the authenticated user is an active participant.

            self.participant = await self.get_participant()
        except EventParticipant.DoesNotExist:
            await self.close(code=4003)
            return

        # Join the Redis channel group.
        await self.join_event_group()

        await self.accept()

        # Deliver the last 150 messages to the newly connected client only.
        # This uses send_json (direct send) — not group_send — so only this
        # connection receives the history, not every other connected user.
        history = await self.get_message_history()

        # Track history IDs to drop duplicate live messages broadcasted during connection
        self.history_message_ids = {msg.get("id") for msg in history if msg.get("id")}
        self.last_message_time = 0

        await self.send_json(
            {
                "type": "history",
                "messages": history,
            }
        )

    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        """

        await self.leave_event_group()

    async def receive_json(self, content, **kwargs):
        """
        Handle incoming JSON messages.
        """
        now = time.time()
        if hasattr(self, "last_message_time") and now - self.last_message_time < 0.5:
            await self.send_json(
                {"error": "You are sending messages too quickly. Please wait."}
            )
            return
        self.last_message_time = now

        # Validate payload type
        if not isinstance(content, dict):
            await self.send_json(
                {
                    "error": "Invalid payload format.",
                }
            )
            return

        message_content = content.get("content")

        # Validate message content type
        if not isinstance(message_content, str):
            await self.send_json(
                {
                    "error": "Message content must be a string.",
                }
            )
            return

        message_content = message_content.strip()

        if not message_content:
            await self.send_json(
                {
                    "error": "Message content is required.",
                }
            )
            return

        if len(message_content) > MAX_MESSAGE_LENGTH:
            await self.send_json(
                {
                    "error": f"Message cannot exceed {MAX_MESSAGE_LENGTH} characters.",
                }
            )
            return

        try:

            message_data = await self.save_and_serialize_message(
                self.participant,
                message_content,
            )
        except ValidationError as exc:
            await self.send_json(
                {
                    "error": str(exc),
                }
            )

            return
        except Exception:
            logger.exception("Unexpected WebSocket error")

            await self.send_json(
                {
                    "error": "An unexpected error occurred. Please try again later.",
                }
            )
            return
        # Broadcast message to all participants
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "event.message",
                "message": message_data,
            },
        )

    async def event_message(self, event):
        """
        Send a broadcasted message to the connected client.
        """
        message_data = event["message"]

        # Deduplicate messages that were already sent during the initial history load
        if (
            getattr(self, "history_message_ids", None)
            and message_data.get("id") in self.history_message_ids
        ):
            return

        await self.send_json(
            message_data,
        )

    async def join_event_group(self):
        """
        Add the current connection to the event group.
        """
        await self.channel_layer.group_add(self.group_name, self.channel_name)

    async def leave_event_group(self):
        """
        Remove the current connection from the event group.
        """
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def get_message_history(self):
        """
        Return the last 150 messages for this event, ordered oldest-first,
        serialized as a list of plain dicts ready for JSON delivery.

        select_related pre-loads every foreign key accessed by
        EventMessageSerializer so no extra queries are issued per message.
        """
        messages = list(
            EventMessage.objects.filter(event_id=self.event_id)
            .select_related(
                "event",
                "participant__user",
                "participant__anonymous_name",
            )
            .order_by("-created_at")[:150]
        )

        messages.reverse()
        return list(EventMessageSerializer(messages, many=True).data)

    @database_sync_to_async
    def get_participant(self):
        """
        Return the authenticated user's active event participant.
        """
        return EventParticipant.objects.select_related(
            "event",
            "user",
            "anonymous_name",
        ).get(
            event_id=self.event_id,
            user=self.scope["user"],
            is_active=True,
            event__status=EventStatus.ACTIVE,
            event__end_time__gt=timezone.now(),
        )

    @database_sync_to_async
    def save_and_serialize_message(self, participant, content):
        """
        Create and serialize an event message in a single sync context.
        """

        message = send_event_message(
            participant=participant,
            content=content,
        )

        return EventMessageSerializer(message).data
