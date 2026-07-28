import { useEffect, useRef, useState } from "react";
import { WS_URL } from "@/lib/config";
import { getAccessToken } from "@/lib/storage";

/**
 * Live count of students online, straight from the existing platform presence
 * consumer (`ws/platform-presence/`).
 *
 * The server pushes `platform.online_count` on connect and again whenever the
 * number moves, and keeps the presence lease alive on its own — so this side
 * only has to listen. It sends nothing; that channel ignores client frames.
 *
 * Returns null until the first count arrives, which is the signal for callers
 * to render nothing rather than a placeholder number.
 */
export function usePlatformPresence(): number | null {
  const [count, setCount] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    let closed = false;

    const connect = () => {
      const socket = new WebSocket(`${WS_URL}/ws/platform-presence/?token=${token}`);
      socketRef.current = socket;

      socket.onmessage = (raw: MessageEvent<string>) => {
        try {
          const data = JSON.parse(raw.data) as { type?: string; count?: number };
          if (data.type === "platform.online_count" && typeof data.count === "number") {
            setCount(data.count);
          }
        } catch {
          // A malformed frame is not worth tearing the indicator down for.
        }
      };

      // Presence is long-lived; a dropped socket would otherwise freeze the
      // number at whatever it last saw.
      socket.onclose = () => {
        socketRef.current = null;
        if (!closed) retryRef.current = window.setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      closed = true;
      window.clearTimeout(retryRef.current);
      socketRef.current?.close();
    };
  }, []);

  return count;
}
