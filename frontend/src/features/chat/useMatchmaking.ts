import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { chatApi } from "@/lib/api/chat";
import { parseApiError, retryAfterMs } from "@/lib/errors";
import { START_CHAT_JITTER_MS, START_CHAT_SPACING_MS } from "@/lib/config";

/**
 * Matchmaking against the backend as it exists:
 *
 *  - POST /chat/start/ either returns a room ("matched"/"active" + room_id)
 *    or queues the user ("waiting").
 *  - A queued user has NO channel the backend ever pushes to (the only chat
 *    socket requires a room_id, and room creation broadcasts nothing), so the
 *    ONLY way a waiting client can learn about its room is a later start/
 *    call. That re-check is therefore kept — on a fixed, throttle-safe rhythm.
 *
 * Guarantees enforced here:
 *  1. One user action -> one logical matchmaking attempt. `start()` is
 *     re-entrant-safe: while a search is live, further calls are no-ops.
 *  2. Strict single-flight: never more than one start/ request in the air.
 *  3. A hard spacing floor between ANY two start/ calls — including the
 *     first, including across browser tabs (localStorage clock) — of
 *     START_CHAT_SPACING_MS (2.5s = 24/min, under the 30/min throttle).
 *     A 429 is impossible from this client by construction.
 *  4. Cancel / unmount invalidates the session: in-flight responses and
 *     scheduled re-checks from a dead session are discarded.
 *  5. No event listeners that inject extra requests (the old visibilitychange
 *     "catch-up" poke is gone — it fired on every alt-tab while testing with
 *     two windows and was a main source of the 429 storm).
 */
const CROSS_TAB_KEY = "chat:last_start_call";

function lastCallGlobal(): number {
  return Number(localStorage.getItem(CROSS_TAB_KEY)) || 0;
}

/** Re-check delay, spread so two waiters cannot stay in lockstep. */
function nextDelay(): number {
  return START_CHAT_SPACING_MS + Math.random() * START_CHAT_JITTER_MS;
}

export function useMatchmaking() {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);

  const sessionRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const inFlightRef = useRef(false);
  const activeRef = useRef(false); // a search (or first call) is live

  const finishSession = useCallback(() => {
    sessionRef.current += 1;
    window.clearTimeout(timerRef.current);
    inFlightRef.current = false;
    activeRef.current = false;
  }, []);

  const request = useCallback(
    async (session: number, isFirst: boolean) => {
      if (session !== sessionRef.current || inFlightRef.current) return;

      // Hard spacing floor before EVERY call, first included. If another call
      // (this tab or any other tab of this account) happened too recently,
      // defer this same attempt — never duplicate it.
      const wait = lastCallGlobal() + START_CHAT_SPACING_MS - Date.now();
      if (wait > 0) {
        timerRef.current = window.setTimeout(
          () => void request(session, isFirst),
          wait + Math.random() * START_CHAT_JITTER_MS,
        );
        return;
      }

      inFlightRef.current = true;
      localStorage.setItem(CROSS_TAB_KEY, String(Date.now()));

      try {
        const result = await chatApi.start();
        if (session !== sessionRef.current) return;

        if ((result.status === "matched" || result.status === "active") && result.room_id) {
          finishSession();
          navigate(`/chat/room/${result.room_id}`);
          return;
        }

        // "waiting": queued server-side. The backend emits no event a queued
        // user can receive, so schedule the single quiet re-check that will
        // discover the room once a partner arrives.
        setSearching(true);
        timerRef.current = window.setTimeout(() => void request(session, false), nextDelay());
      } catch (error) {
        if (session !== sessionRef.current) return;
        const parsed = parseApiError(error);

        if (parsed.status === 429) {
          // Should be unreachable given the spacing floor; if the budget was
          // consumed elsewhere, wait exactly as long as the server says.
          timerRef.current = window.setTimeout(
            () => void request(session, false),
            retryAfterMs(parsed.message, START_CHAT_SPACING_MS * 4),
          );
        } else if (isFirst) {
          // The user's click failed outright — surface it and stop.
          finishSession();
          setSearching(false);
          setStarting(false);
          toast.error(parsed.message);
        } else {
          // Transient network blip mid-search — keep the search alive.
          timerRef.current = window.setTimeout(
            () => void request(session, false),
            START_CHAT_SPACING_MS * 2,
          );
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [finishSession, navigate],
  );

  const start = useCallback(
    async (silent = false) => {
      // One user action = one attempt. Ignore triggers while one is live
      // (double-click, autostart racing a click, remount echoes).
      if (activeRef.current) return;
      activeRef.current = true;

      sessionRef.current += 1;
      const session = sessionRef.current;
      if (silent) setSearching(true);
      else setStarting(true);

      await request(session, true);
      if (session === sessionRef.current) setStarting(false);
    },
    [request],
  );

  const cancel = useCallback(() => {
    finishSession();
    setSearching(false);
    // No leave-queue endpoint exists — be honest about what cancelling does.
    toast.info("Stopped searching. You may still be matched if someone connects.");
  }, [finishSession]);

  useEffect(() => {
    return () => {
      finishSession();
    };
  }, [finishSession]);

  return { searching, starting, start, cancel };
}
