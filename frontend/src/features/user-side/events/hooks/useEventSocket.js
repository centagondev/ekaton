/**
 * useEventSocket.js
 *
 * WebSocket hook for real-time event group chat.
 *
 * URL: ws://localhost:8000/ws/events/<event_id>/
 * Auth: JWT access token as query param (?token=<access>)
 *
 * Incoming events handled:
 *   history              → loads initial message history
 *   event.message        → appends a new live message
 *   typing.started       → marks a participant as typing
 *   typing.stopped       → unmarks a participant as typing
 *   presence.joined      → participant joined
 *   presence.left        → participant left
 *   presence.online_users → initial list of online users
 *
 * Outgoing senders returned:
 *   sendMessage(text)
 *   sendTypingStart()
 *   sendTypingStop()
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "@/services/storage";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";

const WS_BASE = "ws://localhost:8000/ws/events";

/**
 * @param {string|null} eventId   - UUID of the event to connect to
 * @param {object}      callbacks
 * @param {()=>void}    callbacks.onError  - called on connection errors
 * @param {()=>void}    callbacks.onClose  - called when socket closes (code 4003 = not a participant)
 */
export function useEventSocket(eventId, { onError, onClose } = {}) {
  const wsRef = useRef(null);
  const pingRef = useRef(null);

  const [messages, setMessages] = useState([]);       // { id, sender_name, content, created_at }
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]); // participant ids

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // ── Connect / disconnect when eventId changes ─────────────────────────
  useEffect(() => {
    if (!eventId) return;

    const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    const url = `${WS_BASE}/${eventId}/?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[EventWS] Connected to event:", eventId);
      // Keep-alive ping every 25 s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000);
    };

    ws.onmessage = (evt) => {
      let data;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      handleIncoming(data);
    };

    ws.onerror = (err) => {
      console.error("[EventWS] Error:", err);
      onError?.("Connection error. Please try again.");
    };

    ws.onclose = (evt) => {
      console.log("[EventWS] Closed. Code:", evt.code);
      clearInterval(pingRef.current);
      onClose?.(evt.code);
    };

    return () => {
      clearInterval(pingRef.current);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // ── Incoming handler ─────────────────────────────────────────────────
  const handleIncoming = useCallback((data) => {
    switch (data.type) {
      case "history": {
        // Backend sends history as oldest-first array
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        break;
      }
      case "event.message": {
        // data itself is the message object (no wrapper key)
        const msg = data.message ?? data;
        appendMessage(msg);
        break;
      }
      case "presence.online_users": {
        setOnlineCount(data.count ?? 0);
        break;
      }
      case "presence.joined": {
        setOnlineCount((c) => c + 1);
        break;
      }
      case "presence.left": {
        setOnlineCount((c) => Math.max(0, c - 1));
        break;
      }
      case "typing.started": {
        const id = data.participant?.id;
        if (id) setTypingUsers((prev) => (prev.includes(id) ? prev : [...prev, id]));
        break;
      }
      case "typing.stopped": {
        const id = data.participant?.id;
        if (id) setTypingUsers((prev) => prev.filter((x) => x !== id));
        break;
      }
      default:
        break;
    }
  }, [appendMessage]);

  // ── Outgoing senders ─────────────────────────────────────────────────
  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  const sendMessage = useCallback(
    (text) => send({ type: "chat_message", content: text }),
    [send]
  );

  const sendTypingStart = useCallback(() => send({ type: "typing.start" }), [send]);
  const sendTypingStop = useCallback(() => send({ type: "typing.stop" }), [send]);

  return {
    messages,
    onlineCount,
    typingUsers,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    wsRef,
  };
}
