import { useCallback, useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/config";
import { getSessionToken, type SpeakingMessage } from "./api";

type Status = "connecting" | "connected" | "closed";

interface Options {
  /** Only opens once the browser holds an identity. */
  enabled: boolean;
  onMessage: (message: SpeakingMessage) => void;
  onUpvote: (messageId: string, count: number, mine?: boolean) => void;
  /** Server confirmed this participant has spent their one response. */
  onPosted: (messageId: string | undefined) => void;
  onError: (message: string, hasPosted: boolean) => void;
  /** A vote was rejected — payload is the database's actual state. */
  onVoteError: (
    messageId: string,
    count: number,
    hasUpvoted: boolean,
    message: string,
  ) => void;
}

/**
 * Live socket for the discussion.
 *
 * Same shape as features/events/useEventSocket: one socket, a heartbeat, and
 * typed frames. Auth differs — the query parameter carries the anonymous
 * session token rather than a JWT, because demo visitors have no account.
 */
export function useSpeakingSocket({
  enabled,
  onMessage,
  onUpvote,
  onPosted,
  onError,
  onVoteError,
}: Options) {
  const [status, setStatus] = useState<Status>("connecting");
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // Callbacks live in refs so a re-render in the page never tears the socket
  // down and reconnects it mid-conversation.
  const handlers = useRef({ onMessage, onUpvote, onPosted, onError, onVoteError });
  handlers.current = { onMessage, onUpvote, onPosted, onError, onVoteError };

  useEffect(() => {
    if (!enabled) return;

    // Torn down by the cleanup below; a reconnect scheduled just before that
    // must not fire against an unmounted component.
    let disposed = false;
    let heartbeat = 0;
    let retry = 0;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;

      // Identity may live only in the HttpOnly cookie, which the browser
      // attaches to the handshake automatically. Gating the socket on a stored
      // token would leave such a browser silently disconnected.
      const token = getSessionToken();
      const socket = new WebSocket(
        token
          ? `${WS_URL}/ws/public-speaking/?session=${encodeURIComponent(token)}`
          : `${WS_URL}/ws/public-speaking/`,
      );
      socketRef.current = socket;

      // Some proxies drop an idle socket; the consumer answers "ping" with
      // "pong" purely to keep it warm.
      heartbeat = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25_000);

      socket.onopen = () => {
        attempt = 0;
        setStatus("connected");
      };

      socket.onmessage = (raw) => {
        const data = JSON.parse(raw.data as string);

        switch (data.type) {
          case "message":
            handlers.current.onMessage(data.message as SpeakingMessage);
            break;
          case "upvote":
            handlers.current.onUpvote(data.message_id, data.upvote_count);
            break;
          case "upvote_ack":
            handlers.current.onUpvote(data.message_id, data.upvote_count, data.has_upvoted);
            break;
          case "posted":
            handlers.current.onPosted(data.message_id);
            break;
          case "upvote_error":
            handlers.current.onVoteError(
              data.message_id,
              data.upvote_count,
              data.has_upvoted,
              data.message,
            );
            break;
          case "error":
            handlers.current.onError(data.message, Boolean(data.has_posted));
            break;
          case "typing":
            setTypingNames((current) => {
              const others = current.filter((name) => name !== data.display_name);
              return data.is_typing ? [...others, data.display_name] : others;
            });
            break;
          default:
            break;
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        window.clearInterval(heartbeat);
        // A dropped socket used to be permanent: posting and voting stayed
        // dead until the visitor thought to refresh. During a live talk that
        // is the whole room going silent, so reconnect with a capped backoff.
        setTypingNames([]);
        if (disposed) return;
        setStatus("connecting");
        attempt += 1;
        retry = window.setTimeout(connect, Math.min(1000 * 2 ** (attempt - 1), 10_000));
      };
    };

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(retry);
      window.clearInterval(heartbeat);
      // onclose fires during teardown; `disposed` stops it rescheduling.
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled]);

  const send = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }, []);

  return {
    status,
    typingNames,
    sendMessage: useCallback(
      (content: string) => send({ type: "message", content }),
      [send],
    ),
    sendUpvote: useCallback(
      (messageId: string) => send({ type: "upvote", message_id: messageId }),
      [send],
    ),
    sendTyping: useCallback(
      (isTyping: boolean) => send({ type: "typing", is_typing: isTyping }),
      [send],
    ),
  };
}
