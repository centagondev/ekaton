import logging
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.presence.services import PresenceService

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

        await self.mark_user_online()

        await self.send_online_users()

        await self.broadcast_presence("presence.joined")

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
        if hasattr(self, "participant"):
            await self.mark_user_offline()
            await self.broadcast_presence("presence.left")

        await self.leave_event_group()

    async def receive_json(self, content, **kwargs):
        """
        Handle incoming JSON messages.
        """
        now = time.time()

        self.last_message_time = now

        # Validate payload type
        if not isinstance(content, dict):
            await self.send_json(
                {
                    "error": "Invalid payload format.",
                }
            )
            return

        # Handle Typing Indicator Events
        message_type = content.get("type")
        if message_type == "typing.start":
            await self.broadcast_typing_start()
            return

        if message_type == "typing.stop":
            await self.broadcast_typing_stop()
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

    async def mark_user_online(self):
        """
        Mark the current participant as online.
        """
        await database_sync_to_async(PresenceService.mark_online)(
            event_id=self.participant.event_id, user_id=self.participant.user_id
        )

    async def mark_user_offline(self):
        """
        Remove the current participant from the event presence set.
        """
        await database_sync_to_async(PresenceService.mark_offline)(
            event_id=self.participant.event_id, user_id=self.participant.user_id
        )

    async def broadcast_presence(self, event_type: str):
        """
        Broadcast a participant presence event to everyone in the event.
        """

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": event_type,
                "participant": {
                    "id": str(self.participant.id),
                    "anonymous_name": (
                        self.participant.anonymous_name.display_name
                        if self.participant.anonymous_name
                        else None
                    ),
                },
            },
        )

    async def broadcast_typing_start(self):
        """
        Broadcast that the current participant started typing.
        """
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "typing.started",
                "participant": {
                    "id": str(self.participant.id),
                    "anonymous_name": (
                        self.participant.anonymous_name.display_name
                        if self.participant.anonymous_name
                        else None
                    ),
                    "sender_channel": self.channel_name,
                },
            },
        )

    async def broadcast_typing_stop(self):
        """
        Broadcast that the current participant stopped typing.
        """
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "typing.stopped",
                "participant": {
                    "id": str(self.participant.id),
                    "sender_channel": self.channel_name,
                },
            },
        )

    async def presence_joined(self, event):
        """
        Send participant joined event.
        """

        await self.send_json(
            {
                "type": "presence.joined",
                "participant": event["participant"],
            }
        )

    async def presence_left(self, event):
        """
        Send participant left event.
        """

        await self.send_json(
            {
                "type": "presence.left",
                "participant": event["participant"],
            }
        )

    async def typing_started(self, event):
        """
        Send typing started event to everyone except the sender.
        """

        # the sender doesn't get their own typing notification.
        if event["participant"]["sender_channel"] == self.channel_name:
            return

        await self.send_json(
            {
                "type": "typing.started",
                "participant": {
                    "id": event["participant"]["id"],
                    "anonymous_name": event["participant"]["anonymous_name"],
                },
            }
        )

    async def typing_stopped(self, event):
        """
        Send typing stopped event to everyone except the sender.
        """

        if event["participant"]["sender_channel"] == self.channel_name:
            return

        await self.send_json(
            {
                "type": "typing.stopped",
                "participant": {
                    "id": event["participant"]["id"],
                },
            }
        )

    @database_sync_to_async
    def get_online_participants(self):
        """
        Return the online participants for this event.
        """
        user_ids = PresenceService.get_online_users(self.participant.event_id)

        participants = EventParticipant.objects.filter(
            event_id=self.participant.event_id,
            user_id__in=user_ids,
            is_active=True,
        ).select_related("anonymous_name")

        return [
            {
                "id": str(participant.id),
                "anonymous_name": participant.anonymous_name.display_name,
            }
            for participant in participants
        ]

    async def send_online_users(self):
        """
        Send the list of currently online participants.
        """
        participants = await self.get_online_participants()

        await self.send_json(
            {
                "type": "presence.online_users",
                "count": len(participants),
                "participants": participants,
            }
        )
