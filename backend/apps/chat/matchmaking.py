from apps.chat.models import PrivateChatRoom
from apps.chat.services import create_private_chat_room
from apps.users.models import User
from core.redis import redis_client
from django.db.models import Q

# Redis key for the FIFO queue (LIST) maintaining insertion order.
WAITING_QUEUE_KEY = "waiting_users"

# Redis key for the membership SET enabling O(1) presence checks.
WAITING_USERS_SET_KEY = "waiting_users_set"


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
    pipe.execute()


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
    pipe.execute()


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

    with lock:
        # Check if the user already has an active chat room.
        active_room = get_active_chat_room(user)
        if active_room:
            return {
                "status": "active",
                "message": "You are already in an active chat.",
                "room_id": str(active_room.id),
            }

        # Check if the user is already waiting in the queue.
        if is_user_waiting(user):
            return {
                "status": "waiting",
                "message": "You are already waiting for a match.",
            }

        # Attempt to pop the next waiting user from the queue atomically.
        waiting_user = get_waiting_user()

        if waiting_user is None:
            # Queue is empty — add the current user and wait.
            add_user_to_queue(user)
            return {
                "status": "waiting",
                "message": "Waiting for another user...",
            }

        if waiting_user.id == user.id:
            # Edge case: the user's own ID was at the front of the queue.
            # Re-enqueue them and continue waiting.
            add_user_to_queue(user)
            return {
                "status": "waiting",
                "message": "Waiting for another user...",
            }

        # A valid match was found — create the chat room.
        room = create_private_chat_room(
            user_one=waiting_user,
            user_two=user,
        )

        return {
            "status": "matched",
            "message": "Match found.",
            "room_id": str(room.id),
        }
