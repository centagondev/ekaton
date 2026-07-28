export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

/** WS origin: explicit env var, or derived from the API origin (http -> ws). */
export const WS_URL: string =
  import.meta.env.VITE_WS_URL ?? new URL(API_URL).origin.replace(/^http/, "ws");

export const STORAGE_KEYS = {
  ACCESS_TOKEN: "access",
  REFRESH_TOKEN: "refresh",
  USER_PROFILE: "user_profile",
  MY_COMPLAINTS: "my_complaints",
  EVENT_IDENTITIES: "event_identities",
} as const;

/**
 * Minimum spacing between ANY two POST /chat/start/ calls, enforced both
 * per-tab and across tabs. The backend throttle is 30/min; a fixed 2.5s
 * rhythm is 24/min — mathematically incapable of producing a 429.
 */
export const START_CHAT_SPACING_MS = 2500;

/**
 * Random spread added to each re-check.
 *
 * Two clients that begin waiting at the same moment (both auto-researching
 * after a skip/timeout, or both queued in the same burst) would otherwise
 * re-check in permanent lockstep, and two simultaneous re-checks can pass
 * each other without matching. Spreading the interval breaks that alignment.
 * It never delays the happy path — the first call is immediate, and a match
 * is still discovered on the very next re-check.
 */
export const START_CHAT_JITTER_MS = 1200;
