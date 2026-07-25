
# Platform Presence Redis Keys
# =============================================================================

PLATFORM_PRESENCE_KEY = "presence:platform:users"
PLATFORM_CONNECTION_KEY = "presence:platform:connections:{user_id}"


# Platform Presence Group
# =============================================================================

PLATFORM_PRESENCE_GROUP = "platform_presence"


# Platform Seed Configuration
# =============================================================================

PLATFORM_SEED_KEY = "presence:platform:seed"

MIN_PLATFORM_SEED = 5
MAX_PLATFORM_SEED = 20

PLATFORM_SEED_THRESHOLD = 30

PLATFORM_SEED_REFRESH_INTERVAL = 30  # Minutes

PLATFORM_SEED_DRIFT_MIN = -3
PLATFORM_SEED_DRIFT_MAX = 2