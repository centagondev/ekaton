import redis
from django.conf import settings

# Shared Redis client instance used across the application.
# decode_responses=True ensures all values are returned as Python strings
# rather than bytes, eliminating the need for manual decoding at call sites.
redis_client = redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
)
