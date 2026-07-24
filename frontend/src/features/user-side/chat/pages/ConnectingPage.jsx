import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { X } from "lucide-react";

import { useChatStore } from "../store/chat.store";

// Poll every 10s — backend throttle is 5/min, so max safe rate is ~1 per 12s.
const POLL_INTERVAL_MS = 10_000;
// When rate-limited (429), back off for 15s before retrying
const RATE_LIMIT_BACKOFF_MS = 15_000;

const ConnectingPage = () => {
  const navigate = useNavigate();

  const startChat = useChatStore((s) => s.startChat);
  const setRoomId = useChatStore((s) => s.setRoomId);
  const resetChat = useChatStore((s) => s.resetChat);

  const [statusText, setStatusText] = useState("Initializing connection...");
  const [dotCount, setDotCount] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  // Progress bar width: cycles 0→100 while searching
  const [progress, setProgress] = useState(8);

  const pollTimerRef = useRef(null);
  const cancelledRef = useRef(false);
  const progressTimerRef = useRef(null);

  // ── Animated dots ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setDotCount((d) => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);

  // ── Animated progress bar (loops while searching) ──────────────────────
  useEffect(() => {
    if (!isSearching) return;
    // Reset and animate forward over ~4s, then restart
    setProgress(8);
    const cycle = () => {
      setProgress(0);
      // Ramp up to ~90% quickly, then hang
      let current = 0;
      const step = () => {
        current += Math.random() * 6 + 2;
        if (current > 90) current = 90;
        setProgress(current);
        if (current < 90) {
          progressTimerRef.current = setTimeout(step, 120);
        } else {
          // Hold at 90 then restart
          progressTimerRef.current = setTimeout(() => {
            setProgress(0);
            progressTimerRef.current = setTimeout(cycle, 300);
          }, 2000);
        }
      };
      progressTimerRef.current = setTimeout(step, 100);
    };
    cycle();
    return () => clearTimeout(progressTimerRef.current);
  }, [isSearching]);

  // ── One attempt at matchmaking ─────────────────────────────────────────
  const attemptMatch = useCallback(async () => {
    if (cancelledRef.current) return;

    try {
      const data = await startChat();

      if (cancelledRef.current) return;

      if (data.status === "matched" || data.status === "active") {
        clearTimeout(pollTimerRef.current);
        clearTimeout(progressTimerRef.current);
        setRoomId(data.room_id);
        setStatusText("Match found! Starting chat...");
        setIsSearching(false);
        setProgress(100);
        setTimeout(() => {
          if (!cancelledRef.current) navigate("/chat");
        }, 600);
        return;
      }

      if (data.status === "waiting") {
        setStatusText(data.message || "Waiting for another student...");
        setIsSearching(true);
        pollTimerRef.current = setTimeout(attemptMatch, POLL_INTERVAL_MS);
      }
    } catch (err) {
      if (cancelledRef.current) return;

      const status = err?.response?.status;

      if (status === 429) {
        setStatusText("Still searching... please wait.");
        pollTimerRef.current = setTimeout(attemptMatch, RATE_LIMIT_BACKOFF_MS);
        return;
      }

      const msg = err?.response?.data?.message || "Failed to connect. Retrying...";
      toast.error(msg);
      setStatusText("Retrying...");
      pollTimerRef.current = setTimeout(attemptMatch, POLL_INTERVAL_MS * 2);
    }
  }, [startChat, setRoomId, navigate]);

  // ── Start matchmaking on mount ─────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;
    resetChat();
    setStatusText("Initializing connection...");
    setIsSearching(true);
    attemptMatch();

    return () => {
      cancelledRef.current = true;
      clearTimeout(pollTimerRef.current);
      clearTimeout(progressTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cancel ─────────────────────────────────────────────────────────────
  const handleCancel = () => {
    cancelledRef.current = true;
    clearTimeout(pollTimerRef.current);
    clearTimeout(progressTimerRef.current);
    resetChat();
    navigate("/");
  };

  const dots = ".".repeat(dotCount);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F3EF] px-4">
      <div className="flex w-full max-w-lg flex-col items-center">

        {/* ── Logo ── */}
        <div className="mb-10 flex flex-col items-center gap-2">
          <h1 className="text-sm font-black uppercase tracking-[0.3em] text-black">
            CAMPUS CONNECT
          </h1>
          <div className="h-[2px] w-10 bg-black" />
        </div>

        {/* ── Graphic — concentric circles + diamond ── */}
        <div className="relative flex items-center justify-center">
          {/* Outer rotating ring */}
          <div
            className="absolute h-[220px] w-[220px] rounded-full border-[1.5px] border-black"
            style={{
              animation: isSearching
                ? "spin 10s linear infinite"
                : "none",
            }}
          />

          {/* Middle ring (static) */}
          <div className="h-[180px] w-[180px] rounded-full border-[1.5px] border-black flex items-center justify-center bg-transparent">
            {/* Inner circle (static) */}
            <div className="h-[130px] w-[130px] rounded-full border-[1.5px] border-black flex items-center justify-center bg-transparent">
              {/* Diamond */}
              <div
                className="h-[62px] w-[62px] rotate-45 border-[1.5px] border-black bg-transparent"
              />
            </div>
          </div>

          {/* SEARCHING badge — top-right of outer ring */}
          <div
            className="absolute -top-1 right-[-30px] border-2 border-black bg-[#FFDE00] px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-[3px_3px_0px_black]"
          >
            {isSearching ? `Searching${dots}` : "Matched!"}
          </div>
        </div>

        {/* ── Title + subtitle ── */}
        <h2 className="mt-10 text-center text-[2rem] font-black leading-tight text-black">
          {isSearching ? "Finding another student..." : "Student Found!"}
        </h2>
        <p className="mt-3 max-w-xs text-center text-sm font-medium leading-relaxed text-gray-500">
          {isSearching
            ? "Matching you with someone based on shared campus interests and academic goals."
            : "Starting your anonymous chat session now."}
        </p>

        {/* ── Progress bar ── */}
        <div className="mt-8 w-full max-w-xs">
          {/* Bar */}
          <div className="h-[6px] w-full border border-black bg-white overflow-hidden">
            <div
              className="h-full bg-[#CCFF00] transition-[width] duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Labels */}
          <div className="mt-1.5 flex justify-between text-[9px] font-bold uppercase tracking-widest text-gray-500">
            <span>STATUS</span>
            <span>{isSearching ? statusText.toUpperCase() : "CONNECTED"}</span>
          </div>
        </div>

        {/* ── Cancel button ── */}
        {isSearching && (
          <button
            id="cancel-search-btn"
            onClick={handleCancel}
            className="mt-12 flex items-center gap-2.5 border-2 border-black bg-white px-10 py-4 text-xs font-extrabold uppercase tracking-[0.2em] text-black shadow-[4px_4px_0px_black] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            <X className="size-3.5" />
            Cancel Search
          </button>
        )}
      </div>

      {/* Inline keyframes for the outer ring spin */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
};

export default ConnectingPage;
