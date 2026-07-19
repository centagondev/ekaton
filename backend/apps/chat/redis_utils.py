from core.redis import redis_client

SKIP_KEY_PREFIX = "skip"

def get_skip_key(user):
    return f"{SKIP_KEY_PREFIX}:{user.id}"

def add_skip(user, skipped_user):
    redis_client.sadd(get_skip_key(user), str(skipped_user.id))
    redis_client.expire(get_skip_key(user), 300)

def has_recently_skipped(user, other_user):
    return redis_client.sismember(
        get_skip_key(user),
        str(other_user.id),
    )