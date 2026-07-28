import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/config";
import { getAccessToken } from "@/lib/storage";
import type { ChatClientEvent, ChatServerEvent, RevealedUser } from "@/types/api";

export interface ChatMessage {
  id: string;
  text: string;
  isOwn: boolean;
  createdAt: string;
}

export type ChatStatus = "connecting" | "connected" | "ended" | "error";
export type RevealPhase = "idle" | "outgoing" | "incoming" | "accepted" | "rejected";

export interface RevealState {
  phase: RevealPhase;
  /** Only populated once the other party accepts. */
  user: RevealedUser | null;
  /** Set once the celebration modal has been dismissed. */
  seen: boolean;
}

export interface EndInfo {
  kind: "ended" | "skipped" | "timeout";
  message: string;
}

/**
 * Private-chat socket. Protocol per docs/BACKEND-CONTRACT.md §3.
 *
 * Important backend behaviour: ANY disconnect permanently ends the room, so
 * there is deliberately no reconnect logic here — reconnecting would be a lie.
 */
export function useChatSocket(roomId: string | undefined, myEmail: string | undefined) {
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);

  const [status, setStatus] = useState<ChatStatus>("connecting");
  const [endInfo, setEndInfo] = useState<EndInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  /**
   * True once we have proof the other side is in the room. The backend has no
   * join/presence broadcast, so this is established by a handshake over the
   * `typing` event, which the server fans out to the whole room group.
   */
  const [partnerPresent, setPartnerPresent] = useState(false);
  const handshakeSentRef = useRef(false);
  const [reveal, setReveal] = useState<RevealState>({
    phase: "idle",
    user: null,
    seen: false,
  });
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const token = getAccessToken();
    const socket = new WebSocket(`${WS_URL}/ws/chat/${roomId}/?token=${token}`);
    socketRef.current = socket;
    let closedByServer = false;

    // A new room starts with no knowledge of the other side.
    setPartnerPresent(false);
    handshakeSentRef.current = false;

    /** Side-effect-free beacon: is_typing:false renders nothing for anyone. */
    const beacon = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "typing", is_typing: false }));
      }
    };

    /**
     * Any frame that originated from the partner proves they are here.
     * Answer exactly once so whoever arrived first also learns about us —
     * that reply is what makes both sides open at the same instant.
     */
    const notePartnerPresent = () => {
      setPartnerPresent(true);
      if (!handshakeSentRef.current) {
        handshakeSentRef.current = true;
        beacon();
      }
    };

    socket.onopen = () => {
      setStatus("connected");
      beacon(); // announce arrival
    };

    socket.onmessage = (raw: MessageEvent<string>) => {
      let data: ChatServerEvent;
      try {
        data = JSON.parse(raw.data) as ChatServerEvent;
      } catch {
        return;
      }

      switch (data.type) {
        case "chat_message":
          if (data.sender !== myEmail) notePartnerPresent();
          setPartnerTyping(false);
          setMessages((prev) =>
            prev.some((message) => message.id === data.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: data.id,
                    text: data.message,
                    isOwn: data.sender === myEmail,
                    createdAt: data.created_at,
                  },
                ],
          );
          break;

        case "typing":
          // The server echoes typing back to the sender — ignore our own.
          if (data.sender !== myEmail) {
            notePartnerPresent();
            setPartnerTyping(data.is_typing);
            window.clearTimeout(typingTimer.current);
            if (data.is_typing) {
              typingTimer.current = window.setTimeout(() => setPartnerTyping(false), 5000);
            }
          }
          break;

        case "reveal_request_sent":
          setReveal((prev) => ({ ...prev, phase: "outgoing" }));
          break;

        case "reveal_request_received":
          setReveal((prev) => ({ ...prev, phase: "incoming" }));
          break;

        case "reveal_success":
          setReveal({ phase: "accepted", user: data.user, seen: false });
          break;

        case "reveal_rejected":
          setReveal((prev) => ({ ...prev, phase: "rejected" }));
          break;

        // The first end event wins: skip/timeout closes trigger a trailing
        // chat_ended broadcast from disconnect(), which must not overwrite
        // the original reason.
        case "chat_skipped":
          closedByServer = true;
          setEndInfo((prev) => prev ?? { kind: "skipped", message: data.message });
          setStatus("ended");
          break;

        case "chat_timeout":
          closedByServer = true;
          setEndInfo((prev) => prev ?? { kind: "timeout", message: data.message });
          setStatus("ended");
          break;

        case "chat_ended":
          closedByServer = true;
          setEndInfo((prev) => prev ?? { kind: "ended", message: data.message });
          setStatus("ended");
          break;

        case "error":
          setLastError(data.message);
          break;
      }
    };

    socket.onclose = (event: CloseEvent) => {
      socketRef.current = null;
      if (closedByServer) return;

      if (event.code === 4004) {
        setStatus("error");
        setLastError("Chat room not found — it may have already ended.");
      } else if (event.code === 4001) {
        setStatus("error");
        setLastError("Could not join this chat. It may have ended, or your session expired.");
      } else if (event.code === 4008) {
        // The server allows one socket per person per room; this tab lost the race.
        setStatus("error");
        setLastError("This chat is already open in another tab.");
      } else {
        setStatus("ended");
        setEndInfo((prev) => prev ?? { kind: "ended", message: "Connection closed." });
      }
    };

    return () => {
      window.clearTimeout(typingTimer.current);
      // Closing ends the room server-side — intentional on unmount.
      socket.close();
    };
  }, [roomId, myEmail]);

  const send = useCallback((payload: ChatClientEvent) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  const sendMessage = useCallback(
    (message: string) => send({ type: "chat_message", message }),
    [send],
  );
  const sendTyping = useCallback(
    (isTyping: boolean) => send({ type: "typing", is_typing: isTyping }),
    [send],
  );
  const requestReveal = useCallback(() => send({ type: "reveal_request" }), [send]);
  const respondReveal = useCallback(
    (accepted: boolean) =>
      send({ type: "reveal_response", status: accepted ? "accepted" : "rejected" }),
    [send],
  );
  const skipChat = useCallback(() => send({ type: "skip_chat" }), [send]);

  const clearError = useCallback(() => setLastError(null), []);
  const dismissReveal = useCallback(
    () =>
      setReveal((prev) =>
        prev.user ? { ...prev, seen: true } : { phase: "idle", user: null, seen: false },
      ),
    [],
  );

  return {
    status,
    endInfo,
    messages,
    partnerTyping,
    partnerPresent,
    reveal,
    lastError,
    clearError,
    dismissReveal,
    sendMessage,
    sendTyping,
    requestReveal,
    respondReveal,
    skipChat,
  };
}
