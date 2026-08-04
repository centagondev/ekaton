# Event Presence Redis Keys
# =============================================================================
#
# One set of online user ids per event, plus one set of open channel names per
# user in that event. The per-user set is what lets a student keep two tabs
# open on the same event: they only drop out of the online set when their last
# socket closes.
#
# Both keys carry a TTL as a backstop, refreshed on every connect, so a worker
# that dies without a clean disconnect cannot leave someone online forever.
# Normal cleanup is explicit: apps.events.services.close_event_connections
# clears an event's presence when it is cancelled or expires.

EVENT_PRESENCE_KEY = "presence:event:{event_id}:users"
EVENT_CONNECTION_KEY = "presence:event:{event_id}:connections:{user_id}"

# Seconds; must stay an integer because it is passed straight to Redis EXPIRE.
EVENT_PRESENCE_TTL = 60 * 60 * 24


# Platform Presence Redis Keys
# =============================================================================
#
# The ':v2' suffix marks the migration from a plain Redis Set to an
# expiry-aware sorted set. The two layouts are incompatible, so the suffix
# stops a rolling deploy from reading v1 data with v2 semantics. Bump it again
# only if the stored structure changes.

PLATFORM_PRESENCE_KEY = "presence:platform:users:v2"
PLATFORM_CONNECTION_KEY = "presence:platform:connections:v2:{user_id}"
# Seconds; refreshed by the server-side keepalive. Must stay an integer:
# it is passed straight to Redis EXPIRE, which rejects fractional values.
#
# The TTL is only a crash backstop — every ordinary disconnect removes the
# lease explicitly and updates the count at once. A longer lease therefore
# changes nothing a user can see except how long a worker that died without
# running disconnect() can leave ghosts in the count (now up to 5 minutes).
# In exchange each open socket renews every 100s instead of every 30s — 70%
# fewer Redis round trips from the single most frequent recurring write in
# the app.
PLATFORM_CONNECTION_TTL = 300

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
