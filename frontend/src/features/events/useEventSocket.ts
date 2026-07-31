import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/config";
import { getAccessToken } from "@/lib/storage";
import type { EventMessage, EventServerEvent, PresenceParticipant } from "@/types/api";

export type EventSocketStatus = "idle" | "connecting" | "connected" | "closed" | "denied";

/**
 * How often to poke the server so the connection is never idle.
 *
 * Proxies in front of the app close a WebSocket that has said nothing for a
 * while (60s is the usual default), and a quiet chat room says nothing for
 * minutes at a time. Without this the socket dies on its own, the room reads
 * "Offline", the online list empties and nothing arrives again until the page
 * is reloaded. The consumer answers `ping` with `pong`.
 */
const HEARTBEAT_MS = 25_000;

/** Reconnect backoff: doubles from here, capped below. */
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 15_000;

/** Close codes the server uses to refuse a connection, or to end the room. */
const DENIED_CODES = new Set([4001, 4003]);
const EVENT_CLOSED_CODE = 4004;

/**
 * Live layer for an event room: presence, typing and incoming messages.
 * History comes from REST (cursor paginated); this socket only appends.
 *
 * The connection heals itself: it heartbeats so nothing in the middle can
 * time it out, and reconnects with backoff if it drops anyway. A refusal
 * (not signed in / not a participant) and a closed event are terminal — they
 * would fail identically every time, so those are not retried.
 *
 * Wire quirk: new messages arrive as a BARE serialized message object with no
 * `type` key, and errors arrive as `{ error }` — also without a `type`.
 */
export function useEventSocket(
  eventId: string | undefined,
  enabled: boolean,
  myParticipantId: string | undefined,
  onServerError?: (message: string) => void,
) {
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimers = useRef<Record<string, number>>({});

  // Held in a ref so a caller passing an inline handler cannot retrigger the
  // effect below and drop the socket on every render.
  const errorHandler = useRef(onServerError);
  errorHandler.current = onServerError;

  const [status, setStatus] = useState<EventSocketStatus>("idle");
  const [liveMessages, setLiveMessages] = useState<EventMessage[]>([]);
  const [online, setOnline] = useState<PresenceParticipant[]>([]);
  const [typing, setTyping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!eventId || !enabled) {
      setStatus("idle");
      return;
    }

    // Owned by this effect run, so a teardown mid-backoff cannot resurrect a
    // socket for an event the user has already left.
    let disposed = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    let heartbeat: number | undefined;
    // The server replays recent history on every connect. It is ignored the
    // first time (REST owns the transcript) but taken on a reconnect, where
    // it is the only thing that fills in whatever was said while the socket
    // was down. Deduped by id downstream.
    let reconnected = false;

    const stopHeartbeat = () => {
      window.clearInterval(heartbeat);
      heartbeat = undefined;
    };

    const mergeMessages = (incoming: EventMessage[]) => {
      setLiveMessages((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const fresh = incoming.filter((item) => item?.id && !seen.has(item.id));
        return fresh.length === 0 ? prev : [...prev, ...fresh];
      });
    };

    const connect = () => {
      if (disposed) return;

      const token = getAccessToken();
      setStatus("connecting");
      const socket = new WebSocket(`${WS_URL}/ws/events/${eventId}/?token=${token}`);
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setStatus("connected");
        stopHeartbeat();
        heartbeat = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, HEARTBEAT_MS);
      };

      socket.onmessage = (raw: MessageEvent<string>) => {
        let data: EventServerEvent;
        try {
          data = JSON.parse(raw.data) as EventServerEvent;
        } catch {
          return;
        }

        // Errors carry no `type` key. A rejected send only ever reports itself
        // here, so swallowing this frame would make failures invisible.
        if (!("type" in data) || data.type === undefined) {
          if ("error" in data && data.error) errorHandler.current?.(data.error);
          return;
        }

        switch (data.type) {
          // Live chat message. The server nests the payload under `message`;
          // appended here and deduped against REST history by id downstream.
          case "message": {
            const message = data.message;
            if (message?.id) {
              setLiveMessages((prev) =>
                prev.some((item) => item.id === message.id) ? prev : [...prev, message],
              );
            }
            break;
          }

          case "presence.online_users":
            setOnline(data.participants ?? []);
            break;

          case "presence.joined":
            setOnline((prev) =>
              prev.some((item) => item.id === data.participant.id)
                ? prev
                : [...prev, data.participant],
            );
            break;

          case "presence.left":
            setOnline((prev) => prev.filter((item) => item.id !== data.participant.id));
            setTyping((prev) => {
              const next = { ...prev };
              delete next[data.participant.id];
              return next;
            });
            break;

          case "typing.started": {
            const { id, anonymous_name } = data.participant;
            if (id === myParticipantId) break;
            // Prefer the resolved display_name when the payload carries it;
            // "Someone" only appears when the server sends no name at all.
            setTyping((prev) => ({
              ...prev,
              [id]: data.participant.display_name ?? anonymous_name ?? "Someone",
            }));
            window.clearTimeout(typingTimers.current[id]);
            typingTimers.current[id] = window.setTimeout(() => {
              setTyping((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
              });
            }, 6000);
            break;
          }

          case "typing.stopped": {
            const { id } = data.participant;
            window.clearTimeout(typingTimers.current[id]);
            setTyping((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
            break;
          }

          case "history":
            // On the first connect REST owns the transcript, so this copy is
            // ignored. After a drop it is the only record of what was said
            // while the socket was gone, so then it is merged in.
            if (reconnected) mergeMessages(data.messages ?? []);
            break;

          case "event.closed":
            // Event cancelled/expired, or this participant left elsewhere.
            // Terminal: the close that follows must not start a retry loop.
            disposed = true;
            stopHeartbeat();
            window.clearTimeout(retryTimer);
            setStatus("closed");
            break;

          case "pong":
            break;
        }
      };

      socket.onclose = (closeEvent: CloseEvent) => {
        // Only ever clear our own socket: a late close from a superseded
        // attempt must not unhook the one that replaced it.
        if (socketRef.current === socket) socketRef.current = null;
        stopHeartbeat();

        // Presence belongs to a live connection. Leaving the last list on
        // screen would show people as online through an outage.
        setOnline([]);
        setTyping({});

        if (disposed) return;

        if (DENIED_CODES.has(closeEvent.code)) {
          setStatus("denied");
          return;
        }

        if (closeEvent.code === EVENT_CLOSED_CODE) {
          setStatus("closed");
          return;
        }

        // Anything else is a transport failure, so try again. "connecting"
        // rather than "closed": the room is coming back, and saying
        // "Offline" for the whole backoff reads as a dead chat.
        setStatus("connecting");
        reconnected = true;
        const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
        attempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    /**
     * Come back immediately once the tab or the network does.
     *
     * A phone suspends its sockets in the background, so returning to the app
     * would otherwise sit through the rest of the backoff before retrying.
     */
    const resume = () => {
      if (disposed || document.visibilityState !== "visible") return;
      const socket = socketRef.current;
      if (socket && socket.readyState !== WebSocket.CLOSED) return;
      window.clearTimeout(retryTimer);
      attempt = 0;
      connect();
    };

    connect();
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);

    const timers = typingTimers.current;
    return () => {
      disposed = true;
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      window.clearTimeout(retryTimer);
      stopHeartbeat();
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
      socketRef.current?.close();
      socketRef.current = null;
      setLiveMessages([]);
      setOnline([]);
      setTyping({});
    };
  }, [eventId, enabled, myParticipantId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: isTyping ? "typing.start" : "typing.stop" }));
    }
  }, []);

  /**
   * Send over the already-open socket rather than REST.
   *
   * The consumer holds the participant in memory, so this path skips the
   * HTTP request plus the auth/event/participant lookups a REST POST repeats
   * every time — measured ~2x faster end-to-end against the remote database.
   * Returns false when the socket isn't open so the caller can fall back.
   */
  const sendMessage = useCallback(
    (content: string, replyTo?: string | null): boolean => {
      const socket = socketRef.current;
      if (socket?.readyState !== WebSocket.OPEN) return false;
      // A chat frame carries no `type`; reply_to rides along as an extra key.
      socket.send(JSON.stringify({ content, reply_to: replyTo ?? null }));
      return true;
    },
    [],
  );

  return { status, liveMessages, online, typing, sendTyping, sendMessage };
}
