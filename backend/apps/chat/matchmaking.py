import logging
from datetime import timedelta

from apps.chat.models import PrivateChatRoom
from apps.chat.services import (
    IDLE_TIMEOUT_SECONDS,
    create_private_chat_room,
    end_private_chat_room,
    room_connection_key,
)
from apps.users.models import User
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from core.redis import redis_client
from django.db.models import Q
from django.utils import timezone
from redis.exceptions import LockError

logger = logging.getLogger("chat")

# Redis key for the FIFO queue (LIST) maintaining insertion order.
WAITING_QUEUE_KEY = "waiting_users"

# Redis key for the membership SET enabling O(1) presence checks.
WAITING_USERS_SET_KEY = "waiting_users_set"

# Per-user liveness marker, refreshed every time a user (re)enters the queue.
# A client that keeps searching keeps renewing it; one that closed its tab
# stops, and its entry is then skipped as stale instead of being matched into
# a room nobody is sitting in.
WAITING_ALIVE_PREFIX = "waiting_alive"

# How long a queue entry stays claimable without being renewed. Comfortably
# longer than the client's re-check interval, short enough that an abandoned
# entry cannot linger.
WAITING_ALIVE_TTL_SECONDS = 60

# Marks a user whose partner has claimed them but whose room INSERT has not
# committed yet. Without it there is a window in which the claimed user's own
# concurrent poll sees an empty queue and re-enqueues them — where a third
# searcher can claim them into a SECOND room, leaving the first partner alone
# in a room whose other seat nobody ever fills. The claimer deletes the marker
# the moment the room commits (or the claim is discarded); the TTL only covers
# a claimer that crashed mid-create.
MATCH_PENDING_PREFIX = "match_pending"
MATCH_PENDING_TTL_SECONDS = 15

# Sentinel returned by the claim script for a caller who is being matched
# RIGHT NOW: stay out of the queue and let the next poll find the room. The
# '@' guarantees it can never collide with a user id.
CLAIM_PENDING = "@pending"


def waiting_alive_key(user_id):
    """Return the liveness key for a queued user id."""
    return f"{WAITING_ALIVE_PREFIX}:{user_id}"


def match_pending_key(user_id):
    """Return the claimed-but-room-not-committed marker key for a user id."""
    return f"{MATCH_PENDING_PREFIX}:{user_id}"


def add_user_to_queue(user):
    """Add a user to the anonymous chat waiting queue.

    Atomically pushes the user's ID to the tail of the FIFO waiting list and
    registers them in the membership set. Using a pipeline ensures both
    commands are sent to Redis in a single round trip.

    Args:
        user: The User instance to add to the queue.
    """
    user_id = str(user.id)
    pipe = redis_client.pipeline()
    pipe.rpush(WAITING_QUEUE_KEY, user_id)
    pipe.sadd(WAITING_USERS_SET_KEY, user_id)
    # Refresh liveness alongside the enqueue, in the same round trip.
    pipe.set(waiting_alive_key(user_id), 1, ex=WAITING_ALIVE_TTL_SECONDS)
    pipe.execute()


# Claims a partner in ONE atomic step. Redis executes Lua single-threaded, so
# no other user can interleave between the removal of the caller and the pop
# of a partner — which is exactly the window that let two simultaneous
# searchers remove themselves, both observe an empty queue, and both requeue
# without matching (a livelock that left users stuck "searching" forever).
#
# KEYS[1] waiting list, KEYS[2] waiting set, ARGV[1] caller id,
# ARGV[2] liveness key prefix, ARGV[3] liveness TTL,
# ARGV[4] pending-match key prefix, ARGV[5] pending-match TTL.
# Returns the claimed partner's id, '@pending' when the caller has just been
# claimed by somebody else, or false when nobody is available.
_CLAIM_PARTNER_LUA = """
local me = ARGV[1]
local prefix = ARGV[2]
local ttl = tonumber(ARGV[3])
local pending_prefix = ARGV[4]
local pending_ttl = tonumber(ARGV[5])

-- Somebody claimed us an instant ago and is creating our room right now.
-- Claiming a partner of our own (or re-joining the queue) here is exactly
-- what used to produce two ACTIVE rooms for one user, stranding the first
-- partner in a room whose second seat never fills. Stay put; the room will
-- be visible to the next poll.
if redis.call('exists', pending_prefix .. ':' .. me) == 1 then
    return '@pending'
end

-- Leave the queue first: the caller must never claim themselves, and a
-- duplicate entry for them must not survive this call.
redis.call('lrem', KEYS[1], 0, me)
redis.call('srem', KEYS[2], me)
redis.call('del', prefix .. ':' .. me)

while true do
    local candidate = redis.call('lpop', KEYS[1])

    if not candidate then
        -- Nobody to claim, so join the queue in this SAME atomic step.
        -- Enqueuing from a second command would reopen the race: another
        -- searcher could observe the queue while it is momentarily empty
        -- and give up too, leaving both of them waiting on each other.
        redis.call('rpush', KEYS[1], me)
        redis.call('sadd', KEYS[2], me)
        redis.call('set', prefix .. ':' .. me, 1, 'EX', ttl)
        return false
    end

    redis.call('srem', KEYS[2], candidate)

    if candidate ~= me then
        -- Only hand back entries whose owner is still actively searching.
        if redis.call('exists', prefix .. ':' .. candidate) == 1 then
            redis.call('del', prefix .. ':' .. candidate)
            -- Reserve the candidate until the caller's room INSERT commits,
            -- so the candidate's own next poll cannot requeue them and no
            -- third searcher can claim them into a second room.
            redis.call('set', pending_prefix .. ':' .. candidate, me,
                       'EX', pending_ttl)
            return candidate
        end
    end
end
"""

_claim_partner_script = redis_client.register_script(_CLAIM_PARTNER_LUA)


def claim_waiting_partner(user):
    """Atomically claim one other waiting user, or join the queue.

    Either the caller walks away with a partner, or the caller is left
    enqueued — never neither, and never both.

    Args:
        user: The User instance looking for a partner.

    Returns:
        The claimed partner's id as a string, CLAIM_PENDING when the caller
        has just been claimed by someone else (a room is being created for
        them right now — do not enqueue, do not claim), or None when nobody
        was available (in which case the caller is now queued).
    """
    claimed = _claim_partner_script(
        keys=[WAITING_QUEUE_KEY, WAITING_USERS_SET_KEY],
        args=[
            str(user.id),
            WAITING_ALIVE_PREFIX,
            WAITING_ALIVE_TTL_SECONDS,
            MATCH_PENDING_PREFIX,
            MATCH_PENDING_TTL_SECONDS,
        ],
    )

    if not claimed:
        return None

    if isinstance(claimed, bytes):
        claimed = claimed.decode("utf-8")

    return claimed


def get_waiting_user():
    """Pop and return the next waiting user from the queue.

    Uses a Lua script executed atomically on the Redis server to ensure that
    the LIST pop (lpop) and SET removal (srem) always happen together. This
    prevents a race condition where a server crash between the two operations
    would leave the user's ID in the SET but not in the LIST, permanently
    soft-locking them from the matchmaking queue.

    Returns:
        The next User instance from the queue, or None if the queue is empty
        or the user record no longer exists in the database.
    """
    # Lua script: lpop and srem are executed as a single atomic transaction
    # on the Redis engine, guaranteeing consistency between the LIST and SET.
    lua_script = """
    local user_id = redis.call('lpop', KEYS[1])
    if user_id then
        redis.call('srem', KEYS[2], user_id)
    end
    return user_id
    """
    user_id = redis_client.eval(
        lua_script,
        2,
        WAITING_QUEUE_KEY,
        WAITING_USERS_SET_KEY,
    )

    if not user_id:
        return None

    # redis-py may return bytes depending on client configuration.
    if isinstance(user_id, bytes):
        user_id = user_id.decode("utf-8")

    return User.objects.filter(id=user_id).first()


def get_active_chat_room(user):
    """Return the user's current active chat room, or None if they have none.

    Args:
        user: The User instance to look up.

    Returns:
        A PrivateChatRoom instance with status ACTIVE if found, otherwise None.
    """
    return (
        PrivateChatRoom.objects.filter(status=PrivateChatRoom.Status.ACTIVE)
        .filter(Q(user_one=user) | Q(user_two=user))
        .first()
    )


def remove_user_from_queue(user):
    """Remove a user from the waiting queue and membership set.

    Used to clean up a user who cancels their match search or goes offline.
    Both the LIST and SET are updated atomically via a pipeline.

    Args:
        user: The User instance to remove from the queue.
    """
    user_id = str(user.id)
    pipe = redis_client.pipeline()
    pipe.lrem(WAITING_QUEUE_KEY, 0, user_id)
    pipe.srem(WAITING_USERS_SET_KEY, user_id)
    pipe.delete(waiting_alive_key(user_id))
    pipe.execute()


def release_unjoined_room(user):
    """End a room the user was matched into but never actually opened.

    Leaving the queue is not enough on its own to make a cancel safe. A queued
    user is claimable right up to the instant their removal lands, and the
    claim creates the room immediately — but the queued side only ever learns
    about it from its *next* ``start/`` poll, which a user who just cancelled
    will never make. Their partner is then dropped into a room whose second
    seat nobody is coming to fill.

    A participant who is genuinely in a room holds the per-socket slot claimed
    in ``ChatConsumer.connect``. The absence of that key is what separates
    "matched a moment ago and walked away" from "chatting right now" — so a
    live conversation in another tab is never touched here.

    Args:
        user: The User instance leaving the queue.

    Returns:
        The room that was ended, or None when there was nothing to release.
    """
    room = get_active_chat_room(user)

    if room is None:
        return None

    if redis_client.exists(room_connection_key(room.id, user.id)):
        return None

    logger.info(
        "Releasing unjoined room=%s for cancelling user=%s",
        room.id,
        user.id,
    )
    return end_private_chat_room(room)


def release_expired_room(room):
    """End an ACTIVE room whose idle deadline passed with nobody left to enforce it.

    The idle watchdog in ``ChatConsumer`` ends a room once no real message has
    been sent for ``IDLE_TIMEOUT_SECONDS`` — but the watchdog lives inside the
    consumer process. When that process dies without running ``disconnect()``
    (deploy restart, worker crash), the room is orphaned: it stays ACTIVE
    forever, and both participants' connection keys keep refusing every
    reconnect for their whole TTL. ``start_chat`` then hands that dead room
    back on every attempt, trapping its participants in a loop no browser
    restart can break, because all of the stuck state is server-side.

    This applies the watchdog's exact expiry rule lazily, at the point of
    harm. A room with live consumers can never be caught by it: their watchdog
    ends the room at this same deadline, so an ACTIVE room past the deadline
    is by definition one nobody is enforcing.

    Args:
        room: An ACTIVE PrivateChatRoom to check.

    Returns:
        True when the room had expired and was cleaned up, False when it is
        still within its idle window and must be left alone.
    """
    last_activity = (
        room.messages.order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
        or room.created_at
    )

    if timezone.now() - last_activity < timedelta(seconds=IDLE_TIMEOUT_SECONDS):
        return False

    logger.info(
        "Reaping expired room=%s (users %s, %s; last_activity=%s)",
        room.id,
        room.user_one_id,
        room.user_two_id,
        last_activity,
    )
    end_private_chat_room(room)

    # The sockets that claimed these slots are gone; the leftover keys are
    # exactly what refuses each participant's next connection attempt.
    redis_client.delete(
        room_connection_key(room.id, room.user_one_id),
        room_connection_key(room.id, room.user_two_id),
    )

    # If any socket somehow survived past the deadline (e.g. only the
    # watchdog task crashed), it learns the room is over; with the usual
    # empty group this delivers to nobody.
    async_to_sync(get_channel_layer().group_send)(
        f"chat_{room.id}",
        {"type": "chat_ended"},
    )

    return True


def is_user_waiting(user):
    """Check whether a user is currently in the waiting queue.

    Uses SISMEMBER for an O(1) presence check against the membership SET,
    avoiding the need to scan the entire LIST.

    Args:
        user: The User instance to check.

    Returns:
        True if the user is in the waiting queue, False otherwise.
    """
    return redis_client.sismember(WAITING_USERS_SET_KEY, str(user.id))


def queue_size():
    """Return the current number of users in the waiting queue.

    Returns:
        An integer representing the number of users waiting for a match.
    """
    return redis_client.llen(WAITING_QUEUE_KEY)


def is_user_in_active_chat(user):
    """Check whether a user is already a participant in an active chat room.

    Args:
        user: The User instance to check.

    Returns:
        True if the user is in at least one ACTIVE chat room, False otherwise.
    """
    return (
        PrivateChatRoom.objects.filter(status=PrivateChatRoom.Status.ACTIVE)
        .filter(Q(user_one=user) | Q(user_two=user))
        .exists()
    )


def start_chat(user):
    """Run the matchmaking flow for a user attempting to start an anonymous chat.

    Acquires a per-user Redis distributed lock to prevent duplicate concurrent
    requests (e.g., from a double-click or a retried API call). Within the
    lock, the function checks in priority order:
      1. If the user is already in an active room, return that room.
      2. If the user is already waiting, confirm their waiting state.
      3. If no one is waiting, add the user to the queue and wait.
      4. If another user is waiting, pop them from the queue and create a room.

    The lock key is scoped to the individual user (matchmaking:{user.id}),
    meaning two different users can run this function concurrently without
    blocking each other.

    Args:
        user: The User instance initiating the chat.

    Returns:
        A dict with the following keys:
          - status (str): One of 'active', 'waiting', or 'matched'.
          - message (str): A human-readable description of the result.
          - room_id (str, optional): The UUID of the matched or active room.
              Only present when status is 'active' or 'matched'.
    """
    lock = redis_client.lock(
        f"matchmaking:{user.id}",
        timeout=5,
        blocking_timeout=2,
    )

    try:
        with lock:
            # Check if the user already has an active chat room. A room whose
            # idle deadline lapsed while no consumer was alive to end it is
            # expired stale state, not a conversation — reap it here instead
            # of handing the user a room no socket will ever be allowed into.
            # A loop, not a single check: a user can be carrying SEVERAL
            # expired rooms (every crash or failed join leaves one), and
            # reaping only the newest per poll left them semi-stuck — visible
            # as users who could never be matched until an admin deleted
            # their account, which cascaded the poison rooms away.
            active_room = get_active_chat_room(user)
            while active_room is not None and release_expired_room(active_room):
                active_room = get_active_chat_room(user)
            if active_room:
                return {
                    "status": "active",
                    "message": "You are already in an active chat.",
                    "room_id": str(active_room.id),
                }

            # Leave the queue and claim a partner in a single atomic step.
            # Doing both in one Lua script closes the window in which two
            # simultaneous searchers could each remove themselves, both see an
            # empty queue, and both requeue without matching.
            waiting_user = None

            while True:
                partner_id = claim_waiting_partner(user)

                if partner_id == CLAIM_PENDING:
                    # Someone claimed US mid-poll; our room is being created
                    # right now and the next poll will find it. Joining the
                    # queue or claiming a partner here would put this user in
                    # two rooms at once.
                    logger.info(
                        "Matchmaking: user=%s is pending a room, holding",
                        user.id,
                    )
                    return {
                        "status": "waiting",
                        "message": "Waiting for another user...",
                    }

                if partner_id is None:
                    break

                partner = User.objects.filter(id=partner_id).first()

                # The claimed id no longer resolves to a user — drop it and
                # keep looking. The reservation made for them by the claim
                # script is released so a real user behind a stale id is
                # never locked out of the queue for the marker's TTL.
                if partner is None:
                    redis_client.delete(match_pending_key(partner_id))
                    logger.info(
                        "Matchmaking: user=%s claimed unknown id %s, skipped",
                        user.id,
                        partner_id,
                    )
                    continue

                # Never pair someone who is already talking to somebody else;
                # their queue entry is stale. But "already talking" must mean
                # a LIVE conversation: a candidate whose only active rooms are
                # past the idle deadline is carrying crash leftovers, not a
                # chat. Reap those here and keep the candidate — discarding
                # them (the old behaviour) told the claimer "person is no
                # longer available" about someone who was sitting right there
                # searching, and it kept happening to the same person until
                # their stale rooms were gone.
                partner_room = get_active_chat_room(partner)
                while partner_room is not None and release_expired_room(
                    partner_room
                ):
                    partner_room = get_active_chat_room(partner)

                if partner_room is not None:
                    redis_client.delete(match_pending_key(partner_id))
                    logger.info(
                        "Matchmaking: user=%s claimed %s who is already "
                        "chatting, skipped",
                        user.id,
                        partner_id,
                    )
                    continue

                waiting_user = partner
                break

            # No suitable user found. The claim script has already put the
            # caller back in the queue as part of the same atomic step, so
            # there is deliberately no enqueue here.
            if waiting_user is None:
                return {
                    "status": "waiting",
                    "message": "Waiting for another user...",
                }

            # A valid match was found — create the chat room.
            try:
                room = create_private_chat_room(
                    user_one=waiting_user,
                    user_two=user,
                )
            finally:
                # The room is now visible to the partner's poll (or was never
                # created) — either way the reservation has done its job.
                redis_client.delete(match_pending_key(str(waiting_user.id)))

            logger.info(
                "Matchmaking: room=%s created for users %s and %s",
                room.id,
                waiting_user.id,
                user.id,
            )

            return {
                "status": "matched",
                "message": "Match found.",
                "room_id": str(room.id),
            }
    except LockError:
        # Another request from the same user is already in the matchmaking flow.
        # Treat as still waiting rather than returning a 500.
        return {
            "status": "waiting",
            "message": "Waiting for another user...",
        }
