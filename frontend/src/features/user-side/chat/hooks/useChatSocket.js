/**
 * useChatSocket.js
 *
 * Custom hook that manages the WebSocket connection for an active private chat.
 *
 * WebSocket URL: ws://localhost:8000/ws/chat/<room_id>/
 * Auth: JWT access token passed as a query param (?token=<access>)
 *
 * Incoming events handled:
 *   chat_message         → appends message to store
 *   typing               → sets partnerTyping in store
 *   reveal_request_sent  → sets revealState = "sent"
 *   reveal_request_received → sets revealState = "received"
 *   reveal_success       → sets revealState = "accepted" + partnerRevealed
 *   reveal_rejected      → sets revealState = "rejected"
 *   chat_skipped         → calls onSkip callback
 *   chat_ended           → calls onEnded callback
 *   error                → calls onError callback
 *
 * Outgoing event senders (returned from hook):
 *   sendMessage(text)
 *   sendTyping(isTyping)
 *   sendRevealRequest()
 *   sendRevealResponse(status) — "accepted" | "rejected"
 *   sendSkip()
 */

import { useCallback, useEffect, useRef } from "react";
import { storage } from "@/services/storage";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { useChatStore } from "../store/chat.store";
import { useAuthStore } from "@/features/auth/store/auth.store";

const WS_BASE = "ws://localhost:8000/ws/chat";

/**
 * @param {string|null} roomId  - UUID of the active chat room
 * @param {object}      callbacks
 * @param {()=>void}    callbacks.onSkip    - called when chat_skipped received
 * @param {()=>void}    callbacks.onEnded   - called when chat_ended received
 * @param {(msg:string)=>void} callbacks.onError - called on error events
 */
export function useChatSocket(roomId, { onSkip, onEnded, onError } = {}) {
  const wsRef = useRef(null);
  const pingIntervalRef = useRef(null);

  const {
    addMessage,
    setPartnerTyping,
    setRevealState,
    setPartnerRevealed,
  } = useChatStore.getState();

  const userEmail = useAuthStore.getState().user?.email;

  // ── Connect / disconnect on roomId change ─────────────────────────────
  useEffect(() => {
    if (!roomId) return;

    const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    const url = `${WS_BASE}/${roomId}/?token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected to room:", roomId);
      // Keep-alive ping every 25 s
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000);
    };

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        console.warn("[WS] Non-JSON message received:", event.data);
        return;
      }

      handleIncoming(data);
    };

    ws.onerror = (err) => {
      console.error("[WS] WebSocket error:", err);
      onError?.("Connection error. Please try again.");
    };

    ws.onclose = (event) => {
      console.log("[WS] Disconnected. Code:", event.code);
      clearInterval(pingIntervalRef.current);
    };

    return () => {
      clearInterval(pingIntervalRef.current);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── Incoming event handler ────────────────────────────────────────────
  const handleIncoming = useCallback(
    (data) => {
      switch (data.type) {
        case "chat_message": {
          const isMine = data.sender === userEmail;
          addMessage({
            id: data.id,
            sender: isMine ? "me" : "other",
            text: data.message,
            time: formatTime(data.created_at),
            isMine,
          });
          break;
        }

        case "typing": {
          // Ignore our own typing echo
          if (data.sender !== userEmail) {
            setPartnerTyping(data.is_typing);
          }
          break;
        }

        case "reveal_request_sent": {
          setRevealState("sent");
          break;
        }

        case "reveal_request_received": {
          setRevealState("received");
          break;
        }

        case "reveal_success": {
          setRevealState("accepted");
          if (data.user) {
            setPartnerRevealed(data.user);
          }
          break;
        }

        case "reveal_rejected": {
          setRevealState("rejected");
          break;
        }

        case "chat_skipped": {
          onSkip?.();
          break;
        }

        case "chat_ended": {
          onEnded?.();
          break;
        }

        case "error": {
          console.warn("[WS] Server error:", data.message);
          onError?.(data.message);
          break;
        }

        // Silently ignore pong / unknown events
        default:
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userEmail],
  );

  // ── Outgoing event senders ────────────────────────────────────────────
  const send = useCallback((payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Tried to send while socket not open:", payload);
      return;
    }
    ws.send(JSON.stringify(payload));
  }, []);

  const sendMessage = useCallback(
    (text) => send({ type: "chat_message", message: text }),
    [send],
  );

  const sendTyping = useCallback(
    (isTyping) => send({ type: "typing", is_typing: isTyping }),
    [send],
  );

  const sendRevealRequest = useCallback(
    () => send({ type: "reveal_request" }),
    [send],
  );

  const sendRevealResponse = useCallback(
    (status) => send({ type: "reveal_response", status }),
    [send],
  );

  const sendSkip = useCallback(
    () => send({ type: "skip_chat" }),
    [send],
  );

  return {
    sendMessage,
    sendTyping,
    sendRevealRequest,
    sendRevealResponse,
    sendSkip,
    /** direct ws ref for advanced use (e.g. force close) */
    wsRef,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}
