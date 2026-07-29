from django.db import models

from apps.events.models import MAX_MESSAGE_LENGTH, AnonymousName
from core.base_model import BaseModel

# Deliberately reuses events.MAX_MESSAGE_LENGTH and events.AnonymousName rather
# than redeclaring either. The name pool is the SAME table the anonymous event
# chat draws from, which is what keeps the two experiences identical.


class PublicSpeaking(BaseModel):
    """
    The single live discussion shown during a public speaking session.

    Only one row is ever expected to be active. There is deliberately no
    creation, editing or deletion API: the row is managed from the Django admin
    or the seed command, so the audience-facing surface has no way to make,
    rename or destroy a discussion.
    """

    title = models.CharField(max_length=200)

    topic = models.TextField(
        help_text="The question put to the room, e.g. 'What is the worst "
        "friendship experience you have ever had?'",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Unticking this closes the room without touching the feature flag.",
    )

    # Mirrors Event.anonymous_seed / anonymous_counter so the allocation
    # algorithm in services.py can be the same one the events app uses.
    anonymous_seed = models.PositiveIntegerField(
        default=0,
        help_text="Randomised starting offset into the anonymous name pool.",
    )

    anonymous_counter = models.PositiveIntegerField(
        default=0,
        help_text="How many identities have been handed out so far.",
    )

    class Meta:
        db_table = "public_speaking_discussions"
        ordering = ["-created_at"]
        verbose_name = "Public Speaking Discussion"
        verbose_name_plural = "Public Speaking Discussions"

    def __str__(self):
        return self.title


class PublicSpeakingParticipant(BaseModel):
    """
    One anonymous browser session inside the discussion.

    There is no user FK on purpose. Participants are identified by an opaque
    session token the browser holds for the length of its session, so the same
    tab keeps its identity across refreshes and rejoins, and no account, email
    or IP is involved.
    """

    discussion = models.ForeignKey(
        PublicSpeaking,
        on_delete=models.CASCADE,
        related_name="participants",
    )

    # Opaque, unguessable, generated server-side. Never rendered to any client
    # other than the one it belongs to.
    session_token = models.CharField(max_length=64, db_index=True)

    anonymous_name = models.ForeignKey(
        AnonymousName,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="public_speaking_participants",
    )

    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "public_speaking_participants"
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["discussion", "session_token"],
                name="unique_public_speaking_session",
            ),
            # One identity per participant per room: the pool allocator must
            # never be able to hand the same name to two live sessions.
            models.UniqueConstraint(
                fields=["discussion", "anonymous_name"],
                name="unique_public_speaking_identity",
            ),
        ]

    def __str__(self):
        return self.display_name

    @property
    def display_name(self):
        if self.anonymous_name is None:
            return "Anonymous"
        return self.anonymous_name.display_name


class PublicSpeakingMessage(BaseModel):
    """A single message in the discussion. Immutable, like EventMessage."""

    discussion = models.ForeignKey(
        PublicSpeaking,
        on_delete=models.CASCADE,
        related_name="messages",
    )

    participant = models.ForeignKey(
        PublicSpeakingParticipant,
        on_delete=models.CASCADE,
        related_name="messages",
    )

    content = models.TextField(max_length=MAX_MESSAGE_LENGTH)

    class Meta:
        db_table = "public_speaking_messages"
        # Reddit ordering: most upvoted first, newest breaking ties. Applied as
        # an annotation in services.py; this default keeps raw queries sane.
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["discussion", "-created_at"]),
        ]
        constraints = [
            # One response per participant, enforced at the storage layer.
            # The service check in create_message() gives a friendly error, but
            # two frames arriving together would both pass that check; only the
            # constraint can actually stop the second INSERT.
            models.UniqueConstraint(
                fields=["participant"],
                name="one_message_per_participant",
            ),
        ]

    def __str__(self):
        return f"{self.participant.display_name}: {self.content[:40]}"


class PublicSpeakingUpvote(BaseModel):
    """
    One vote per participant per message.

    Same shape as complaints.ComplaintUpvote — the unique constraint is what
    enforces "one vote", and toggling is a get_or_create/delete pair.
    """

    message = models.ForeignKey(
        PublicSpeakingMessage,
        on_delete=models.CASCADE,
        related_name="upvotes",
    )

    participant = models.ForeignKey(
        PublicSpeakingParticipant,
        on_delete=models.CASCADE,
        related_name="given_upvotes",
    )

    class Meta:
        db_table = "public_speaking_upvotes"
        constraints = [
            models.UniqueConstraint(
                fields=["message", "participant"],
                name="unique_public_speaking_upvote",
            ),
        ]

    def __str__(self):
        return f"{self.participant.display_name} upvoted {self.message_id}"
