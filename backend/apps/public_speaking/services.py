import logging

from django.db import IntegrityError, transaction
from django.db.models import BooleanField, Case, Count, Exists, OuterRef, Value, When
from rest_framework.exceptions import ValidationError

from apps.events.models import AnonymousName
from core.redis import redis_client

from .models import (
    PublicSpeaking,
    PublicSpeakingMessage,
    PublicSpeakingParticipant,
    PublicSpeakingUpvote,
)

logger = logging.getLogger("public_speaking")

# One message every two seconds per participant. Enforced in Redis rather than
# DRF's throttle classes because the send path is a WebSocket frame, which
# never passes through the REST throttle layer.
MESSAGE_COOLDOWN_SECONDS = 2


def get_active_discussion():
    """
    Return the single live discussion, or None.

    Newest-active wins, so re-seeding before a talk cannot leave two rooms
    fighting over the audience.
    """
    return PublicSpeaking.objects.filter(is_active=True).order_by("-created_at").first()


def _assign_anonymous_name(*, discussion):
    """
    Take the next identity from the shared anonymous name pool.

    This is the events app's allocator (apps/events/services.py::
    _assign_anonymous_name) applied to a discussion instead of an event: walk
    the pool from a random per-room seed, step one place per participant. The
    caller must already hold a lock on the discussion row.

    Returns None when the pool is exhausted, which the caller treats as "the
    room is full" rather than handing out a duplicate name.
    """
    total_names = AnonymousName.objects.count()

    if total_names == 0:
        logger.warning(
            "No anonymous names are seeded; discussion %s cannot assign "
            "identities. Run 'manage.py migrate' to seed them.",
            discussion.id,
        )
        return None

    taken = set(
        PublicSpeakingParticipant.objects.filter(discussion=discussion)
        .exclude(anonymous_name=None)
        .values_list("anonymous_name_id", flat=True)
    )

    if len(taken) >= total_names:
        return None

    pool = list(AnonymousName.objects.order_by("id").values_list("id", flat=True))

    # Probe forward from the seeded offset until an unused name turns up. The
    # DB constraint is still the real guarantee — this just avoids burning a
    # round trip on a name we already know is gone.
    for step in range(total_names):
        index = (
            discussion.anonymous_seed + discussion.anonymous_counter + step
        ) % total_names
        candidate_id = pool[index]
        if candidate_id not in taken:
            discussion.anonymous_counter += step + 1
            discussion.save(update_fields=["anonymous_counter"])
            return AnonymousName.objects.get(id=candidate_id)

    return None


@transaction.atomic
def join_discussion(*, discussion, user):
    """
    Return this account's participant in the discussion, creating one if needed.

    Rejoining returns the same identity — that is what makes a refresh, a new
    tab, another browser or an incognito window all keep the same anonymous
    name and the same one-message allowance. The identity is the account, so
    none of those change who this resolves to.
    """
    existing = PublicSpeakingParticipant.objects.filter(
        discussion=discussion, user=user
    ).first()
    if existing:
        return existing

    # Lock the discussion so two simultaneous joins cannot read the same
    # counter and race for the same name.
    locked = PublicSpeaking.objects.select_for_update().get(id=discussion.id)

    # Re-check under the lock: a concurrent request for this same account
    # (e.g. two tabs opened together) may have already created it while this
    # request was waiting for the lock.
    existing = PublicSpeakingParticipant.objects.filter(
        discussion=locked, user=user
    ).first()
    if existing:
        return existing

    anonymous_name = _assign_anonymous_name(discussion=locked)

    if anonymous_name is None:
        raise ValidationError("This discussion is full.")

    try:
        participant = PublicSpeakingParticipant.objects.create(
            discussion=locked,
            user=user,
            anonymous_name=anonymous_name,
        )
    except IntegrityError:
        # Lost a race for the identity slot; re-fetch in case it was this same
        # account's own concurrent request that won it.
        existing = PublicSpeakingParticipant.objects.filter(
            discussion=discussion, user=user
        ).first()
        if existing:
            return existing
        raise ValidationError("Could not allocate an identity, please retry.")

    return participant


def get_participant(*, discussion, user):
    """Resolve the authenticated account to its participant, or None."""
    if user is None or not user.is_authenticated:
        return None
    return (
        PublicSpeakingParticipant.objects.select_related("anonymous_name")
        .filter(discussion=discussion, user=user)
        .first()
    )


def check_rate_limit(*, participant):
    """
    Allow at most one message per participant per cooldown window.

    SET NX is atomic, so two frames arriving together cannot both pass.
    Returns True when the message may proceed.
    """
    key = f"public_speaking_cooldown:{participant.id}"
    allowed = redis_client.set(key, 1, nx=True, ex=MESSAGE_COOLDOWN_SECONDS)
    return bool(allowed)


def has_posted(*, participant):
    """Whether this participant has already used their one response."""
    if participant is None:
        return False
    return PublicSpeakingMessage.objects.filter(participant=participant).exists()


def create_message(*, discussion, participant, content):
    """
    Validate and persist this participant's single response.

    One response per participant, checked here for a readable error and
    guaranteed by the unique constraint on PublicSpeakingMessage.participant.
    The constraint is not belt-and-braces: two frames sent together both pass
    the exists() check, and only the database can reject the second INSERT.
    """
    cleaned = (content or "").strip()

    if not cleaned:
        raise ValidationError("Message cannot be empty.")

    max_length = PublicSpeakingMessage._meta.get_field("content").max_length
    if len(cleaned) > max_length:
        raise ValidationError(f"Message cannot exceed {max_length} characters.")

    if has_posted(participant=participant):
        raise ValidationError("You have already posted your response.")

    try:
        return PublicSpeakingMessage.objects.create(
            discussion=discussion,
            participant=participant,
            content=cleaned,
        )
    except IntegrityError:
        # Lost a race with another frame from the same participant.
        raise ValidationError("You have already posted your response.")


def toggle_upvote(*, participant, message_id):
    """
    Reddit-style toggle: no vote → create it; existing vote → remove it.

    Self-votes stay forbidden. The unique constraint on (message, participant)
    means a duplicate row can never exist — two frames racing through
    get_or_create resolve as one create and one delete, i.e. two toggles, not
    a double count.

    Returns:
        (has_upvoted, count) — the caller's new state and the message total.
    """
    message = PublicSpeakingMessage.objects.filter(
        id=message_id, discussion=participant.discussion_id
    ).first()

    if message is None:
        raise ValidationError("Message not found.")

    if message.participant_id == participant.id:
        raise ValidationError("You can't vote for your own response.")

    try:
        upvote, created = PublicSpeakingUpvote.objects.get_or_create(
            message=message, participant=participant
        )
    except IntegrityError:
        created = False
        upvote = PublicSpeakingUpvote.objects.filter(
            message=message, participant=participant
        ).first()

    if not created and upvote is not None:
        upvote.delete()

    count = PublicSpeakingUpvote.objects.filter(message=message).count()
    return created, count


def vote_state(*, participant, message_id):
    """
    The server's current truth for one participant/message pair.

    Sent alongside a vote rejection so an optimistic client can roll back to
    exactly what the database says, not to a guess.
    """
    count = PublicSpeakingUpvote.objects.filter(message_id=message_id).count()
    has_upvoted = PublicSpeakingUpvote.objects.filter(
        message_id=message_id, participant=participant
    ).exists()
    return {"upvote_count": count, "has_upvoted": has_upvoted}


def messages_queryset(*, discussion, participant=None):
    """
    Messages ranked Reddit-style: most upvoted first, newest breaking ties.

    `has_upvoted` is annotated per participant so the client can paint its own
    votes without a second round trip.
    """
    queryset = (
        PublicSpeakingMessage.objects.filter(discussion=discussion)
        .select_related("participant", "participant__anonymous_name")
        .annotate(upvote_count=Count("upvotes", distinct=True))
    )

    if participant is not None:
        queryset = queryset.annotate(
            has_upvoted=Exists(
                PublicSpeakingUpvote.objects.filter(
                    message=OuterRef("pk"), participant=participant
                )
            ),
            # Lets the client hide the vote button on the caller's own
            # response; the server-side check in add_upvote is the guarantee.
            is_own=Case(
                When(participant=participant, then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            ),
        )

    return queryset.order_by("-upvote_count", "-created_at")
