# Platform Presence Redis Keys
# =============================================================================
#
# The ':v2' suffix marks the migration from a plain Redis Set to an
# expiry-aware sorted set. The two layouts are incompatible, so the suffix
# stops a rolling deploy from reading v1 data with v2 semantics. Bump it again
# only if the stored structure changes; PLATFORM_SEED_KEY is deliberately
# unversioned because its format (a plain integer) has never changed.

PLATFORM_PRESENCE_KEY = "presence:platform:users:v2"
PLATFORM_CONNECTION_KEY = "presence:platform:connections:v2:{user_id}"
# Seconds; refreshed by the server-side keepalive. Must stay an integer:
# it is passed straight to Redis EXPIRE, which rejects fractional values.
PLATFORM_CONNECTION_TTL = 90

# Seconds between server-side presence lease renewals. Set to a third of the
# TTL so two consecutive failed renewals still leave the lease active.
PLATFORM_KEEPALIVE_INTERVAL = PLATFORM_CONNECTION_TTL // 3


# Platform Presence Group
# =============================================================================

PLATFORM_PRESENCE_GROUP = "platform_presence"


# Platform Broadcast Throttling
# =============================================================================
#
# Every connect and disconnect wants to tell the whole group the new count, and
# a group_send costs one channel-layer write per member. At event start, when
# a few hundred students connect at once, that is quadratic. These keys collapse
# a burst into roughly one broadcast per debounce window.

PLATFORM_BROADCAST_DEBOUNCE_KEY = "presence:platform:broadcast:debounce"
PLATFORM_BROADCAST_DEBOUNCE_SECONDS = 2

# The last count actually broadcast. The periodic reconciler compares against
# this so it only re-sends when the number has genuinely moved. The TTL just
# stops the key outliving a dead deployment; expiry only costs one extra
# broadcast.
PLATFORM_LAST_BROADCAST_KEY = "presence:platform:broadcast:last"
PLATFORM_LAST_BROADCAST_TTL = 300


# Platform Seed Configuration
# =============================================================================

PLATFORM_SEED_KEY = "presence:platform:seed"

MIN_PLATFORM_SEED = 5
MAX_PLATFORM_SEED = 20

PLATFORM_SEED_THRESHOLD = 30

# How often the seed drifts is deployment config, not module config: it lives
# in CELERY_BEAT_SCHEDULE['refresh-platform-seed'] (currently every 30 min).
# Nothing here should duplicate it. The drift settings below are tuned for
# that cadence, so revisit them if the schedule changes materially.

# Random step applied on every refresh. Keep this symmetric: a biased range
# turns the refresh into a one-way walk that parks the seed on whichever
# clamp bound it drifts toward, making the opposite bound unreachable.
PLATFORM_SEED_DRIFT_MIN = -3
PLATFORM_SEED_DRIFT_MAX = 3

# How strongly the seed is pulled back toward the middle of its range on each
# refresh; the correction is (target - current) / STRENGTH. Larger values pull
# more gently. This is what keeps the seed centred, rather than a biased drift.
PLATFORM_SEED_REVERSION_STRENGTH = 4
