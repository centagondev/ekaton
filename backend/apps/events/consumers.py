import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.presence.services import EventPresenceService

from .models import MAX_MESSAGE_LENGTH, EventMessage, EventParticipant, EventStatus
from .serializers import EventMessageSerializer
from .services import event_group_name, event_member_group_name, send_event_message

logger = logging.getLogger(__name__)

# Close code sent when the event itself ends while clients are connected.
EVENT_CLOSED_CODE = 4004

# Close codes sent when a connection is refused. They are delivered through
# reject() rather than a bare close() so the client can actually read them.
UNAUTHENTICATED_CODE = 4001
NOT_A_PARTICIPANT_CODE = 4003


class EventConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for event chat.
    """

    # Resolved once the connecting user is known. Stays None on a refused
    # connection, which never reaches the point of joining a group.
    member_group_name = None

    async def connect(self):
        """
        Handle a new WebSocket connection.

        Flow:
        1. Reject unauthenticated users.
        2. Verify the authenticated user is an active participant of the event.
        3. Cache the participant for this WebSocket connection.
        4. Join the Redis groups.
        5. Accept the WebSocket connection.
        6. Send recent message history to the connected user.
        """
        self.event_id = str(self.scope["url_route"]["kwargs"]["event_id"])

        self.group_name = event_group_name(self.event_id)

        # Get the authenticated user from the JWT middleware.
        user = self.scope.get("user")

        # Reject unauthenticated users.
        if user is None or user.is_anonymous:
            await self.reject(code=UNAUTHENTICATED_CODE)
            return

        # Addresses this participant's sockets alone, which is how leaving
        # the event reaches the tabs they left open behind them.
        self.member_group_name = event_member_group_name(self.event_id, user.id)

        try:  # Verify that the authenticated user is an active participant.

            self.participant = await self.get_participant()
        except EventParticipant.DoesNotExist:
            await self.reject(code=NOT_A_PARTICIPANT_CODE)
            return

        self.anonymous_display_name = await self.get_anonymous_display_name()

        # Join the Redis channel group.
        await self.join_event_group()

        await self.accept()

        connection_count = await self.mark_user_online()

        await self.send_online_users()

        # Only the first socket is an arrival. Announcing every socket would
        # make a second tab look like another participant joining.
        if connection_count == 1:
            await self.broadcast_presence("presence.joined")

        # Deliver the last 150 messages to the newly connected client only.
        # This uses send_json (direct send) — not group_send — so only this
        # connection receives the history, not every other connected user.
        history = await self.get_message_history()

        # Track history IDs to drop duplicate live messages broadcasted during connection
        self.history_message_ids = {msg.get("id") for msg in history if msg.get("id")}

        await self.send_json(
            {
                "type": "history",
                "messages": history,
            }
        )

    async def reject(self, code):
        """
        Refuse a connection with a close code the client can read.

        Closing before accept() makes Channels answer the handshake with an
        HTTP 403 instead of a WebSocket close frame, and browsers surface
        that as a generic 1006. The code passed here never reaches them, so
        the client cannot tell "not signed in" apart from "not a
        participant". Accepting first costs one extra frame and keeps the
        codes meaningful.

        Args:
            code:
                The close code to send to the client.
        """
        await self.accept()
        await self.close(code=code)

    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        """
        if hasattr(self, "participant"):
            remaining_connections = await self.mark_user_offline()

            # The user has only left once their last tab is gone.
            if remaining_connections == 0:
                await self.broadcast_presence("presence.left")

        await self.leave_event_group()

    async def receive_json(self, content, **kwargs):
        """
        Handle incoming JSON messages.
        """
        # Validate payload type
        if not isinstance(content, dict):
            await self.send_json(
                {
                    "error": "Invalid payload format.",
                }
            )
            return

        message_type = content.get("type")

        # Answer the client's keep-alive. Without a branch of its own a ping
        # falls through to the message handling below, where it has no
        # "content" key, so every client would be sent a spurious validation
        # error for as long as it stayed connected.
        if message_type == "ping":
            await self.send_json({"type": "pong"})
            return

        # Handle Typing Indicator Events
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
            # exc.detail is a list of ErrorDetail; str(exc) would send its
            # Python repr to the client instead of the message itself.
            await self.send_json(
                {
                    "error": str(exc.detail[0]),
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
            {
                "type": "message",
                "message": message_data,
            }
        )

    async def event_closed(self, event):
        """
        Tell the client this connection is finished, then close it.

        Sent to the whole event when it is cancelled or expires, and to one
        participant's sockets when they leave. Without it a client keeps an
        open socket on an event that rejects every message it sends — and,
        once they have left, one that would still receive other people's
        messages. ``reason`` says which of the three it was.
        """
        await self.send_json(
            {
                "type": "event.closed",
                "reason": event["reason"],
            }
        )

        await self.close(code=EVENT_CLOSED_CODE)

    async def join_event_group(self):
        """
        Add the current connection to the event group and to the group that
        carries messages addressed to this participant alone.
        """
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(self.member_group_name, self.channel_name)

    async def leave_event_group(self):
        """
        Remove the current connection from the groups it joined.

        Also runs for refused connections, which never joined anything and
        may have no member group resolved, so both discards are guarded.
        """
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

        if self.member_group_name:
            await self.channel_layer.group_discard(
                self.member_group_name, self.channel_name
            )

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
    def get_anonymous_display_name(self):
        """
        Return the participant's anonymous display name, or None.

        Read once at connect time, in a sync context, because the presence
        and typing broadcasts run in the event loop and cannot follow a
        foreign key themselves. The relation is not always cached on the
        participant either: send_event_message refreshes it from the
        database, which drops every cached relation.
        """
        return (
            self.participant.anonymous_name.display_name
            if self.participant.anonymous_name
            else None
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

        Returns how many sockets this participant now has open on the event.
        """
        return await database_sync_to_async(EventPresenceService.mark_online)(
            event_id=self.participant.event_id,
            user_id=self.participant.user_id,
            connection_id=self.channel_name,
        )

    async def mark_user_offline(self):
        """
        Release this socket's presence for the current participant.

        Returns how many of their sockets are still open on the event.
        """
        return await database_sync_to_async(EventPresenceService.mark_offline)(
            event_id=self.participant.event_id,
            user_id=self.participant.user_id,
            connection_id=self.channel_name,
        )

    async def broadcast_presence(self, event_type: str):
        """
        Broadcast a participant presence event to everyone in the event.

        The sending channel is carried along so the handlers can skip the
        participant the event is about, the same way the typing events do.
        They already know they connected, and the online user list they get
        on connect includes them.

        The current online count travels with the event as well. Clients only
        receive a count on connect otherwise, so they would have to keep their
        own tally and it would drift: a participant who leaves the event over
        the REST API is dropped from a later connection's online list, yet
        still produces a presence.left when their socket finally closes.
        """
        online_participants = await self.get_online_participants()

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": event_type,
                "count": len(online_participants),
                "participant": {
                    "id": str(self.participant.id),
                    "anonymous_name": self.anonymous_display_name,
                    "sender_channel": self.channel_name,
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
                    "anonymous_name": self.anonymous_display_name,
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
        Send participant joined event to everyone except the participant
        who joined.
        """

        if event["participant"]["sender_channel"] == self.channel_name:
            return

        await self.send_json(
            {
                "type": "presence.joined",
                "count": event["count"],
                "participant": {
                    "id": event["participant"]["id"],
                    "anonymous_name": event["participant"]["anonymous_name"],
                },
            }
        )

    async def presence_left(self, event):
        """
        Send participant left event to everyone except the participant
        who left.
        """

        if event["participant"]["sender_channel"] == self.channel_name:
            return

        await self.send_json(
            {
                "type": "presence.left",
                "count": event["count"],
                "participant": {
                    "id": event["participant"]["id"],
                    "anonymous_name": event["participant"]["anonymous_name"],
                },
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
        user_ids = EventPresenceService.get_online_users(self.participant.event_id)

        participants = EventParticipant.objects.filter(
            event_id=self.participant.event_id,
            user_id__in=user_ids,
            is_active=True,
        ).select_related("anonymous_name")

        return [
            {
                "id": str(participant.id),
                "anonymous_name": (
                    participant.anonymous_name.display_name
                    if participant.anonymous_name
                    else None
                ),
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
