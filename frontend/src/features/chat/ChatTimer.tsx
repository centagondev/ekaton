import { memo, useEffect, useState } from "react";
import { Timer } from "lucide-react";

/** mm:ss for the life of a normal chat, growing an hours digit only if one
 * actually runs that long. */
function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * How long the current chat has been live, ticking once a second.
 *
 * A component of its own, memoized, so the tick re-renders these few spans
 * and nothing else — held in page state it would re-run the whole room every
 * second. It renders nothing until `running` first becomes true (the room is
 * covered by the connecting overlay until then anyway), latches its start
 * time at that moment, and freezes at the final reading when `running` goes
 * false — a chat that ended stops counting. Mount it with `key={roomId}` so
 * a new room always starts a fresh clock.
 *
 * Elapsed time is recomputed from the start timestamp on every tick rather
 * than incremented: background tabs throttle intervals to once a minute, and
 * a counter would silently fall behind, while a timestamp is correct again
 * the moment the tab wakes.
 */
export const ChatTimer = memo(function ChatTimer({ running }: { running: boolean }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (running) setStartedAt((prev) => prev ?? Date.now());
  }, [running]);

  useEffect(() => {
    if (!running || startedAt === null) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [running, startedAt]);

  if (startedAt === null) return null;

  return (
    <>
      {/* Joins the existing `batch · status` line, so it costs no height. */}
      <span aria-hidden>·</span>
      {/* role="timer" is a live region that deliberately does not announce —
          a value changing every second must never be read out on each tick.
          tabular-nums keeps the digits from wobbling as they count. */}
      <span role="timer" className="inline-flex shrink-0 items-center gap-1 tabular-nums">
        <Timer aria-hidden className="size-3" />
        {formatElapsed(elapsed)}
      </span>
    </>
  );
});
