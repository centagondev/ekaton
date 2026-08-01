import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useMatchmaking } from "@/features/chat/useMatchmaking";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/layout/PageTransition";
import { cn } from "@/lib/utils";
import { StackGame } from "./StackGame";
import { Hero } from "./Hero";
import { usePlatformPresence } from "./usePlatformPresence";

interface FloatingShape {
  className: string;
  rotate?: number;
  duration: number;
}

const SHAPES: readonly FloatingShape[] = [
  { className: "left-[8%] top-[18%] size-5 border-2 border-ink", rotate: 45, duration: 7 },
  { className: "right-[12%] top-[12%] size-3 border-2 border-ink bg-brand-yellow", duration: 5.5 },
  { className: "left-[16%] bottom-[22%] size-4 border-2 border-ink", duration: 6.5 },
  {
    className: "right-[9%] bottom-[30%] size-6 border-2 border-ink bg-brand-lavender",
    rotate: 12,
    duration: 8,
  },
  { className: "left-[38%] top-[8%] size-2.5 bg-ink", rotate: 45, duration: 6 },
  { className: "right-[34%] bottom-[10%] size-3 border-2 border-ink bg-brand-lime", duration: 7.5 },
];

function FloatingShapes() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {SHAPES.map((shape, index) => (
        <motion.span
          key={index}
          className={cn("absolute opacity-25", shape.className)}
          initial={{ rotate: shape.rotate ?? 0 }}
          animate={{
            y: [0, -18, 0],
            rotate: [
              (shape.rotate ?? 0) - 6,
              (shape.rotate ?? 0) + 6,
              (shape.rotate ?? 0) - 6,
            ],
          }}
          transition={{
            duration: shape.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.4,
          }}
        />
      ))}
    </div>
  );
}

function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return <span className="tabular-nums">{`${mm}:${ss}`}</span>;
}

/** Shown in place of the hero while matchmaking runs — same page, no route change. */
function Searching({ onCancel }: { onCancel: () => void }) {
  return (
    <motion.div
      key="searching"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="relative flex w-full max-w-5xl flex-col items-center px-4 text-center sm:px-6"
      role="status"
      aria-live="polite"
    >
      <FloatingShapes />

      <h1 className="text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
        Finding another student…
      </h1>
      <p className="mt-2 text-sm text-muted lg:text-base">
        Play while we find someone.
      </p>

      {/* The game is the hero of the wait. Mounted only while searching, so a
          match unmounts it and tears its loop down immediately.

          Height scales with the screen rather than sitting at a fixed 300/420/470:
          those numbers overflowed a 667px phone and, at lg, an 800px-tall laptop
          — the two most ordinary screens there are. The engine re-measures via a
          ResizeObserver, so a fluid box costs it nothing. */}
      <div className="mt-4 h-[clamp(180px,34dvh,300px)] w-full border-2 border-ink bg-canvas shadow-brutal-lg sm:mt-7 sm:h-[clamp(240px,42dvh,420px)] lg:h-[clamp(300px,46dvh,470px)]">
        <StackGame />
      </div>

      <div className="mt-5 w-72 max-w-full sm:mt-8 lg:w-96">
        <div className="relative h-2.5 overflow-hidden border-2 border-ink bg-surface">
          <motion.div
            className="absolute inset-y-0 w-1/3 bg-brand-lime"
            animate={{ x: ["-110%", "330%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted">
          <span>Searching</span>
          <Elapsed />
        </div>
      </div>

      <Button variant="secondary" className="mt-6 sm:mt-10" onClick={onCancel}>
        <X className="size-4" /> Cancel search
      </Button>
    </motion.div>
  );
}

/**
 * Single 100vh landing page: the hero starts matchmaking in place, so there is
 * no intermediate page between "Start chat" and being matched.
 */
export function HomePage() {
  const location = useLocation();
  const { searching, starting, start, cancel } = useMatchmaking();
  const onlineCount = usePlatformPresence();
  const autoStarted = useRef(false);

  // Returning from a skip / timeout / ended chat resumes the search at once.
  // The chat page hands over why it ended so the explanation arrives as a
  // toast over the already-running search, rather than delaying it.
  useEffect(() => {
    const state = location.state as { autostart?: boolean; notice?: string } | null;
    if (state?.autostart && !autoStarted.current) {
      autoStarted.current = true;
      window.history.replaceState({}, "");
      if (state.notice) toast(state.notice);
      void start(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    /* flex-1 rather than a 100dvh calc: the hero now has to share the screen
       with the mobile bottom bar as well as the navbar, and letting it fill
       whatever is left keeps it centred without a chain of magic offsets.

       The negative margins give back the shell's mobile gutters. AppLayout pads
       every page by pt-8 plus a bottom inset 2rem deeper than the nav bar, so
       that a scrolling page's last row clears the bar. This page never scrolls —
       it is one screen, centred — so on a short phone those 64px are the
       difference between fitting and not. Cancelled below md only; from there
       the bar is gone and the ordinary gutters apply. */
    <PageTransition className="-mb-8 -mt-8 flex flex-1 items-center justify-center md:mb-0 md:mt-0">
      <AnimatePresence mode="wait">
        {searching ? (
          <Searching key="searching" onCancel={cancel} />
        ) : (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <Hero
              onStart={() => void start()}
              loading={starting}
              onlineCount={onlineCount}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
