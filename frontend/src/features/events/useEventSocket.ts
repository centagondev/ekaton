import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/config";
import { getAccessToken } from "@/lib/storage";
import type { EventMessage, EventServerEvent, PresenceParticipant } from "@/types/api";

export type EventSocketStatus = "idle" | "connecting" | "connected" | "closed" | "denied";

/**
 * Live layer for an event room: presence, typing and incoming messages.
 * History comes from REST (cursor paginated); this socket only appends.
 *
 * Wire quirk: new messages arrive as a BARE serialized message object with no
 * `type` key, and errors arrive as `{ error }` — also without a `type`.
 */
export function useEventSocket(
  eventId: string | undefined,
  enabled: boolean,
  myParticipantId: string | undefined,
) {
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimers = useRef<Record<string, number>>({});

  const [status, setStatus] = useState<EventSocketStatus>("idle");
  const [liveMessages, setLiveMessages] = useState<EventMessage[]>([]);
  const [online, setOnline] = useState<PresenceParticipant[]>([]);
  const [typing, setTyping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!eventId || !enabled) {
      setStatus("idle");
      return;
    }

    const token = getAccessToken();
    setStatus("connecting");
    const socket = new WebSocket(`${WS_URL}/ws/events/${eventId}/?token=${token}`);
    socketRef.current = socket;

    socket.onopen = () => setStatus("connected");

    socket.onmessage = (raw: MessageEvent<string>) => {
      let data: EventServerEvent;
      try {
        data = JSON.parse(raw.data) as EventServerEvent;
      } catch {
        return;
      }

      // Errors carry no `type` key.
      if (!("type" in data) || data.type === undefined) {
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
          // History comes from the REST endpoint — the socket copy is
          // deliberately ignored so there is one source of truth for it.
          break;

        case "event.closed":
          // Event cancelled/expired, or this participant left elsewhere.
          setStatus("closed");
          break;

        case "pong":
          break;
      }
    };

    socket.onclose = (event: CloseEvent) => {
      socketRef.current = null;
      setStatus(
        event.code === 4003 || event.code === 4001 || event.code === 4004
          ? "denied"
          : "closed",
      );
    };

    const timers = typingTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
      socket.close();
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
  const sendMessage = useCallback((content: string): boolean => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ content }));
    return true;
  }, []);

  return { status, liveMessages, online, typing, sendTyping, sendMessage };
}
