#!/usr/bin/env bash
# Live view of the matchmaking waiting queue.
# Run in its own terminal while testing: ./watch-queue.sh
prev=""
echo "watching waiting_users  (Ctrl-C to stop)"
while true; do
  now=$(redis-cli -h 127.0.0.1 -p 6379 lrange waiting_users 0 -1 | tr '\n' ' ' | xargs)
  if [ "$now" != "$prev" ]; then
    if [ -z "$now" ]; then
      printf '%s  QUEUE EMPTY\n' "$(date +%H:%M:%S)"
    else
      printf '%s  QUEUE: %s\n' "$(date +%H:%M:%S)" "$now"
    fi
    prev="$now"
  fi
  sleep 0.3
done
