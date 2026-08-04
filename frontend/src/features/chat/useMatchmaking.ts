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
 *  4. Cancel / background / unmount invalidates the session: in-flight
 *     responses and scheduled re-checks from a dead session are discarded, and
 *     the server-side queue slot is released. A dead session's response is not
 *     merely dropped — if it came back holding a room, that room is ended, or
 *     the partner walks into it alone.
 *  5. No event listener ever ADDS a start/ request. The old visibilitychange
 *     "catch-up" poke did, fired on every alt-tab while testing with two
 *     windows, and was a main source of the 429 storm; it stays gone. The
 *     visibility listener below only ever subtracts — it stops a search.
 */
const CROSS_TAB_KEY = "chat:last_start_call";

function lastCallGlobal(): number {
  const stored = Number(localStorage.getItem(CROSS_TAB_KEY)) || 0;
  // Never trust a stored instant that is ahead of this device's clock. It
  // happens: a clock correction between sessions, or a manually-set clock —
  // and the value persists in localStorage forever. Unclamped, the spacing
  // floor defers every start/ call by that whole gap, which looks like a
  // search that never finds anyone, for that one device only.
  return Math.min(stored, Date.now());
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
  /** The start/ call currently in the air, if any. See releaseQueueSlot. */
  const pendingStartRef = useRef<Promise<unknown> | null>(null);
  /** A background stop happened; explain it when the user comes back. */
  const backgroundNoticeRef = useRef(false);

  const finishSession = useCallback(() => {
    sessionRef.current += 1;
    window.clearTimeout(timerRef.current);
    inFlightRef.current = false;
    activeRef.current = false;
  }, []);

  /**
   * Give up the server-side queue entry.
   *
   * Stopping the client-side polling is not enough on its own: the backend
   * queues the user inside start/ and keeps them claimable, so a partner can
   * be matched into a room the absent user never sees.
   *
   * The second leave is not paranoia. A start/ that was already in the air
   * re-queues the user as part of its own atomic claim-or-enqueue script, so it
   * can land *after* our leave and undo it. Repeating the leave once that
   * request settles makes "not waiting" the last word. Leaving is idempotent,
   * so the common no-op case costs nothing.
   */
  const releaseQueueSlot = useCallback((pending: Promise<unknown> | null) => {
    chatApi.leaveQueue();
    if (pending) void pending.then(() => chatApi.leaveQueue()).catch(() => {});
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
        // Held in a ref so a stop can wait for this exact call to settle
        // before re-asserting the leave (see releaseQueueSlot).
        const pending = chatApi.start();
        pendingStartRef.current = pending;

        const result = await pending;

        if (session !== sessionRef.current) {
          // The search was cancelled (or backgrounded, or navigated away from)
          // while this call was in the air — and it came back holding a room
          // the server had just created for it. Dropping the response on the
          // floor leaves that room standing with one seat filled: the partner
          // walks in and waits for someone who is never coming. Hand it back.
          //
          // Only "matched" — a room this very call brought into existence.
          // "active" may be a conversation already open in another tab, which
          // is not ours to end.
          if (result.status === "matched" && result.room_id) {
            void chatApi.end(result.room_id).catch(() => {});
          }
          return;
        }

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
        pendingStartRef.current = null;
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

  /** Tear the search down completely: no more polling, and out of the queue. */
  const stopSearch = useCallback(() => {
    const pending = pendingStartRef.current;
    const wasActive = activeRef.current;

    finishSession();
    setSearching(false);
    setStarting(false);

    if (wasActive) releaseQueueSlot(pending);
  }, [finishSession, releaseQueueSlot]);

  const cancel = useCallback(() => {
    stopSearch();
    toast.info("Stopped searching.");
  }, [stopSearch]);

  /**
   * A search only survives while the app is actually in front of the user.
   *
   * Matching someone who has switched away produces the worst outcome the flow
   * has: their partner arrives in a room, starts talking, and gets silence.
   * Dropping out of the queue the moment the app stops being used costs that
   * user nothing — they are not looking at the search either way.
   *
   * TWO signals are needed, because neither one covers the requirement alone:
   *
   *  - `visibilitychange` catches the cases where the document stops being
   *    rendered: another tab, a minimised window, screen lock, and the browser
   *    being backgrounded on mobile (home button / app switcher).
   *
   *  - `blur` catches switching to ANOTHER APPLICATION on a desktop, which
   *    visibilitychange does not fire for at all. `visibilityState` describes
   *    whether the document is *visible*, not whether it is *focused* — alt-tab
   *    to another app and the browser window is usually still on screen, so the
   *    page stays "visible" and only the focus is lost. Leaving this out is
   *    what made the feature look like it did nothing: the user switched apps,
   *    no event fired, and the search kept running.
   *
   *  - `pagehide` backs both up for outright teardown (closing the tab,
   *    navigating away, entering the bfcache).
   *
   * The `document.hasFocus()` guard on blur keeps focus moving to an in-page
   * target (an iframe, a native picker) from reading as "left the app". The app
   * has no iframes today; the guard is there so adding one cannot silently
   * start cancelling searches.
   *
   * Note the deliberate trade-off: focusing devtools also blurs the window and
   * will stop a search. That is the same signal as switching to any other
   * window, and the requirement is that leaving the app stops the search — so
   * it is honoured rather than special-cased.
   */
  useEffect(() => {
    const stopForBackground = () => {
      if (!activeRef.current) return;
      stopSearch();
      backgroundNoticeRef.current = true;
    };

    /** Came back to the app. The search is NOT resumed — only explained. */
    const noticeOnReturn = () => {
      if (!backgroundNoticeRef.current) return;
      backgroundNoticeRef.current = false;
      toast.info("Search stopped while you were away. Tap Start chat to look again.");
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopForBackground();
      else noticeOnReturn();
    };

    const onBlur = () => {
      // Focus went somewhere inside this page rather than out of it.
      if (document.hasFocus()) return;
      stopForBackground();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", noticeOnReturn);
    window.addEventListener("pagehide", stopForBackground);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", noticeOnReturn);
      window.removeEventListener("pagehide", stopForBackground);
    };
  }, [stopSearch]);

  useEffect(() => {
    return () => {
      // Navigating away mid-search is the same problem in a smaller frame: the
      // re-check that discovers the room dies with this component, so the queue
      // entry has to die with it too. A match unmounts this as well, but it
      // calls finishSession() before navigating, so activeRef is already false
      // and the new room is never disturbed.
      const pending = pendingStartRef.current;
      const wasActive = activeRef.current;

      finishSession();

      if (wasActive) releaseQueueSlot(pending);
    };
  }, [finishSession, releaseQueueSlot]);

  return { searching, starting, start, cancel };
}
