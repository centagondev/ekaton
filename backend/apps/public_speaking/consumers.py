import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework.exceptions import ValidationError

from . import services
from .serializers import PublicSpeakingMessageSerializer

logger = logging.getLogger("public_speaking")

# Close codes, matching the convention the chat consumer already uses.
CLOSE_NO_DISCUSSION = 4004
CLOSE_NOT_JOINED = 4001


class PublicSpeakingConsumer(AsyncJsonWebsocketConsumer):
    """
    Live socket for the single public speaking discussion.

    Modelled on apps.events.consumers.EventConsumer — same group-broadcast
    shape, same typing and message frame names — but identity comes from an
    opaque session token instead of an EventParticipant, because participants
    here have no account. EventConsumer could not be reused directly: every one
    of its database helpers resolves an EventParticipant, whose `user` column
    is non-null.

    Nothing here touches Event, EventParticipant or EventMessage.
    """

    async def connect(self):
        query = parse_qs(self.scope["query_string"].decode())
        # Same resolution order as the REST layer: explicit token first, the
        # persistent identity cookie second. Browsers attach cookies to the
        # WebSocket handshake automatically.
        token = (
            query.get("session", [""])[0]
            or self.scope.get("cookies", {}).get("anonymous_participant_id", "")
        )

        self.discussion = await self.get_discussion()

        if self.discussion is None:
            await self.close(code=CLOSE_NO_DISCUSSION)
            return

        self.participant = await self.get_participant(token)

        if self.participant is None:
            # Joining is an explicit HTTP call, so an unknown token means the
            # tab never joined (or the room was reset).
            await self.close(code=CLOSE_NOT_JOINED)
            return

        self.group_name = f"public_speaking_{self.discussion.id}"
        self.display_name = self.participant.display_name

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if not hasattr(self, "group_name"):
            return
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if not hasattr(self, "group_name"):
            return

        message_type = content.get("type")

        if message_type == "message":
            await self.handle_message(content.get("content", ""))
        elif message_type == "upvote":
            await self.handle_upvote(content.get("message_id"))
        elif message_type == "typing":
            await self.handle_typing(bool(content.get("is_typing")))
        elif message_type == "ping":
            await self.send_json({"type": "pong"})

    # ------------------------------- inbound -------------------------------

    async def handle_message(self, content):
        allowed = await self.check_rate_limit()

        if not allowed:
            await self.send_json(
                {
                    "type": "error",
                    "message": "You're sending messages too quickly.",
                }
            )
            return

        try:
            payload = await self.save_message(content)
        except ValidationError as exc:
            message = str(exc.detail[0])
            await self.send_json(
                {
                    "type": "error",
                    "message": message,
                    # Locks the composer when the rejection was "you already
                    # answered", so a stale tab stops offering an input that
                    # can never succeed. Named to match the REST state field.
                    "already_posted": await self.get_has_posted(),
                }
            )
            return

        await self.channel_layer.group_send(
            self.group_name, {"type": "chat.message", "message": payload}
        )

        # Only the author is told they have spent their one response. The id
        # lets the client mark that message as its own without a refetch, so
        # the no-self-vote rule applies to it immediately.
        await self.send_json({"type": "posted", "message_id": payload["id"]})

    async def handle_upvote(self, message_id):
        if not message_id:
            return

        try:
            upvoted, count = await self.toggle_upvote(message_id)
        except ValidationError as exc:
            # The client voted optimistically; hand it the database's actual
            # state so its rollback lands on the truth, not on a guess.
            state = await self.get_vote_state(message_id)
            await self.send_json(
                {
                    "type": "upvote_error",
                    "message_id": str(message_id),
                    "message": str(exc.detail[0]),
                    **state,
                }
            )
            return

        # Everyone needs the new total so the ranking re-sorts live; the ack
        # confirms the voter's optimistic state.
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.upvote",
                "message_id": str(message_id),
                "upvote_count": count,
            },
        )
        await self.send_json(
            {
                "type": "upvote_ack",
                "message_id": str(message_id),
                "has_upvoted": upvoted,
                "upvote_count": count,
            }
        )

    async def handle_typing(self, is_typing):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat.typing",
                "display_name": self.display_name,
                "is_typing": is_typing,
                "sender": self.channel_name,
            },
        )

    # ------------------------------- outbound ------------------------------

    async def chat_message(self, event):
        await self.send_json({"type": "message", "message": event["message"]})

    async def chat_upvote(self, event):
        await self.send_json(
            {
                "type": "upvote",
                "message_id": event["message_id"],
                "upvote_count": event["upvote_count"],
            }
        )

    async def chat_typing(self, event):
        # Never echo someone's own typing indicator back at them.
        if event.get("sender") == self.channel_name:
            return
        await self.send_json(
            {
                "type": "typing",
                "display_name": event["display_name"],
                "is_typing": event["is_typing"],
            }
        )

    # ------------------------------- database ------------------------------

    @database_sync_to_async
    def get_discussion(self):
        return services.get_active_discussion()

    @database_sync_to_async
    def get_participant(self, token):
        return services.get_participant(discussion=self.discussion, session_token=token)

    @database_sync_to_async
    def check_rate_limit(self):
        return services.check_rate_limit(participant=self.participant)

    @database_sync_to_async
    def get_has_posted(self):
        return services.has_posted(participant=self.participant)

    @database_sync_to_async
    def save_message(self, content):
        message = services.create_message(
            discussion=self.discussion,
            participant=self.participant,
            content=content,
        )
        # Re-read through the ranking queryset so the broadcast payload carries
        # the same annotated shape the REST history does.
        annotated = (
            services.messages_queryset(discussion=self.discussion)
            .filter(id=message.id)
            .first()
        )
        return PublicSpeakingMessageSerializer(annotated).data

    @database_sync_to_async
    def toggle_upvote(self, message_id):
        return services.toggle_upvote(
            participant=self.participant, message_id=message_id
        )

    @database_sync_to_async
    def get_vote_state(self, message_id):
        return services.vote_state(
            participant=self.participant, message_id=message_id
        )
