import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { DURATION, EASE_OUT_EXPO, PARTICLES, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Petal } from "./Pookalam";

/**
 * The confirmation moment.
 *
 * Posting used to be entirely silent: the draft cleared, the composer was
 * swapped for a notice bar, and that was the whole acknowledgement for the one
 * irreversible thing a participant gets to do here. This is that moment given
 * its due.
 *
 * The focus trap, Escape handling, scroll lock and focus-return all come from
 * the shared Modal — this only supplies the panel's contents, with the chrome
 * turned off so the checkmark can lead. The dialog keeps its accessible name
 * from Modal's `aria-label`, so hiding the header bar costs nothing.
 */

const AUTO_CLOSE_MS = 5000;
const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/* ------------------------------- celebration ------------------------------ */

/**
 * Golden sparkles and a short marigold fall. Twenty-four elements, fixed
 * positions, ~1.2s, then rest — the brief's word was "elegant, not carnival",
 * and a particle system that never settles is a carnival.
 */
const CELEBRATION = [
  { x: -46, y: -30, delay: 0, scale: 0.8, petal: true, tone: "gold" },
  { x: 44, y: -36, delay: 0.06, scale: 0.7, petal: true, tone: "amber" },
  { x: -68, y: 8, delay: 0.12, scale: 0.55, petal: false, tone: "gold" },
  { x: 70, y: 2, delay: 0.04, scale: 0.6, petal: false, tone: "gold" },
  { x: -28, y: -52, delay: 0.18, scale: 0.65, petal: true, tone: "cream" },
  { x: 26, y: -56, delay: 0.1, scale: 0.75, petal: true, tone: "gold" },
  { x: -84, y: -14, delay: 0.22, scale: 0.5, petal: false, tone: "amber" },
  { x: 88, y: -20, delay: 0.16, scale: 0.52, petal: false, tone: "gold" },
  { x: -12, y: -66, delay: 0.26, scale: 0.6, petal: true, tone: "leaf" },
  { x: 14, y: -70, delay: 0.2, scale: 0.68, petal: true, tone: "gold" },
  { x: -56, y: 30, delay: 0.3, scale: 0.48, petal: false, tone: "cream" },
  { x: 58, y: 26, delay: 0.24, scale: 0.5, petal: false, tone: "amber" },
  { x: -96, y: 16, delay: 0.34, scale: 0.44, petal: true, tone: "gold" },
  { x: 98, y: 12, delay: 0.28, scale: 0.46, petal: true, tone: "gold" },
  { x: -38, y: 48, delay: 0.38, scale: 0.42, petal: false, tone: "gold" },
  { x: 40, y: 44, delay: 0.32, scale: 0.44, petal: false, tone: "cream" },
  { x: -76, y: -44, delay: 0.14, scale: 0.58, petal: true, tone: "amber" },
  { x: 78, y: -48, delay: 0.36, scale: 0.54, petal: true, tone: "cream" },
  { x: 0, y: -80, delay: 0.4, scale: 0.5, petal: false, tone: "gold" },
  { x: -110, y: -6, delay: 0.42, scale: 0.38, petal: false, tone: "gold" },
  { x: 112, y: -2, delay: 0.44, scale: 0.4, petal: false, tone: "amber" },
  { x: -20, y: 62, delay: 0.46, scale: 0.4, petal: true, tone: "gold" },
  { x: 22, y: 58, delay: 0.48, scale: 0.38, petal: true, tone: "leaf" },
  { x: 0, y: 74, delay: 0.5, scale: 0.36, petal: false, tone: "cream" },
].slice(0, PARTICLES.celebration) as ReadonlyArray<{
  x: number;
  y: number;
  delay: number;
  scale: number;
  petal: boolean;
  tone: "gold" | "amber" | "cream" | "leaf";
}>;

function Celebration() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[86px] z-0 block size-0"
    >
      {CELEBRATION.map((particle, index) => (
        <motion.span
          key={index}
          className="absolute block"
          style={{
            width: particle.petal ? 11 : 6,
            height: particle.petal ? 16 : 6,
            marginLeft: particle.petal ? -5 : -3,
            marginTop: particle.petal ? -8 : -3,
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: particle.x,
            y: particle.y,
            scale: particle.scale,
            opacity: 0,
            rotate: particle.petal ? 220 : 0,
          }}
          transition={{ duration: 1.2, delay: particle.delay, ease: EASE_OUT_EXPO }}
        >
          {particle.petal ? (
            <Petal tone={particle.tone} className="size-full" />
          ) : (
            <span className="block size-full rotate-45 rounded-[1px] bg-festival-gold" />
          )}
        </motion.span>
      ))}
    </span>
  );
}

/* --------------------------------- dialog --------------------------------- */

export function SubmittedDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { reduced, spring } = useMotionPrefs();
  const ringRef = useRef<SVGCircleElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  /**
   * Auto-close, with the ring draining as its clock.
   *
   * Driven straight off requestAnimationFrame into an attribute rather than
   * through React state — a 5-second countdown has no business re-rendering a
   * dialog sixty times a second.
   *
   * Two deliberate escapes from the brief: it pauses on focus as well as
   * hover, and it does not run at all under reduced motion. A timer someone
   * cannot see draining is a time limit, and a success message is exactly the
   * kind of thing a screen-reader user may still be reading at second five.
   */
  useEffect(() => {
    if (!open || reduced) return;

    let frame = 0;
    let last = performance.now();
    let elapsed = 0;

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      if (!pausedRef.current) elapsed += delta;

      const progress = Math.min(1, elapsed / AUTO_CLOSE_MS);
      ringRef.current?.setAttribute(
        "stroke-dashoffset",
        String(RING_CIRCUMFERENCE * progress),
      );

      if (progress >= 1) {
        onClose();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, reduced, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Response submitted successfully"
      variant="soft"
      chrome={false}
      className="max-w-md"
    >
      {/* The clip belongs here, not on the panel: Modal's panel owns
          `overflow-y-auto` so a tall dialog still scrolls on a short phone,
          and putting `overflow-hidden` up there would have quietly taken that
          away. Here it only stops the celebration particles from pushing the
          panel's scroll extent around. */}
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        className="relative overflow-hidden px-6 pb-6 pt-8 text-center sm:px-8 sm:pb-8"
      >
        {/* The panel used to float on an infinite loop while open. Cut — the
            dialog already arrives on a spring, and a permanent animation for
            5px of drift is not a trade worth making. */}
        <div>
          {!reduced && <Celebration />}

          {/* Checkmark — circle and tick drawn rather than faded in. */}
          <div className="relative mx-auto mb-6 size-[86px]">
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-leaf/10"
              initial={reduced ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 1.12, 1], opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.45, ease: EASE_OUT_EXPO }}
            />
            <svg viewBox="0 0 100 100" className="relative size-full" aria-hidden="true">
              <motion.circle
                cx="50"
                cy="50"
                r="34"
                fill="none"
                stroke="var(--color-leaf)"
                strokeWidth="4"
                strokeLinecap="round"
                initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
                style={{ rotate: -90, transformOrigin: "50px 50px" }}
              />
              <motion.path
                d="M34 51.5 45.5 63 67 40"
                fill="none"
                stroke="var(--color-leaf-deep)"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.34, delay: 0.42, ease: EASE_OUT_EXPO }}
              />
            </svg>
          </div>

          <motion.h2
            className="font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.025em] text-ink-warm"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.entrance, delay: 0.3, ease: EASE_OUT_EXPO }}
          >
            Response submitted successfully
          </motion.h2>

          <motion.p
            className="mx-auto mt-2.5 max-w-[19rem] text-[15px] leading-[1.55] text-ink-soft"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.entrance, delay: 0.38, ease: EASE_OUT_EXPO }}
          >
            Thank you for celebrating Onam with Ekaton. You can now vote for the responses
            you relate to.
          </motion.p>

          <motion.div
            className="mt-7 flex flex-col-reverse items-stretch gap-2.5 sm:flex-row sm:justify-center"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.46 }}
          >
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "rounded-full border border-transparent px-5 py-3 text-sm font-bold text-ink-soft",
                "transition-colors hover:border-ink-warm/12 hover:bg-kasavu hover:text-ink-warm",
              )}
            >
              Close
            </button>

            <button
              type="button"
              onClick={onClose}
              className={cn(
                "group relative flex items-center justify-center gap-2.5 rounded-full",
                "border border-amber-deep bg-festival-gold px-6 py-3",
                "text-sm font-bold text-ink-warm shadow-rest",
                "transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0",
              )}
            >
              {/* Pre-rendered glow, crossfaded on hover. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-glow transition-opacity duration-200 group-hover:opacity-100"
              />
              <span className="relative">Continue exploring</span>

              {/* The auto-close clock, drawn as a draining ring inside the
                  button. Absent under reduced motion, where nothing closes on
                  its own. */}
              {!reduced && (
                <svg viewBox="0 0 36 36" className="relative size-4" aria-hidden="true">
                  <circle
                    cx="18"
                    cy="18"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    opacity="0.2"
                  />
                  <circle
                    ref={ringRef}
                    cx="18"
                    cy="18"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={0}
                    transform="rotate(-90 18 18)"
                  />
                </svg>
              )}
            </button>
          </motion.div>

          {!reduced && (
            <p className="mt-3.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
              {paused ? "Paused" : "Closes automatically"}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
