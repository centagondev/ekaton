import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { DURATION, EASE_OUT_EXPO, PARTICLES, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { SpeakingMessage } from "../api";

/**
 * The heart. This page's emotional core, and the one interaction people repeat.
 *
 * Behaviour is unchanged from the version this replaces: the same
 * `onUpvote(id)` handler, the same optimistic paint by the parent, the same
 * reconcile-by-ack and rollback-by-error, the same refusal to let anyone vote
 * for their own response. What changed is that a vote now *feels* like
 * something: gold rises through the heart like liquid, a handful of small
 * hearts float up and away, the count rolls, and a ring pulses away from the
 * button.
 *
 * Un-voting deliberately plays none of the celebration — the gold drains back
 * down and the count rolls the other way. Taking a vote back should feel calm,
 * not punished.
 */

/** Classic solid heart on a 24-unit grid; used as fill, outline and clip. */
const HEART =
  "M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z";

/* -------------------------------- odometer -------------------------------- */

/**
 * One digit in an overflow-hidden slot. The outgoing digit slides away in the
 * direction the number moved and the incoming one arrives from the other side,
 * so 7 → 8 reads as a wheel turning rather than as text being replaced.
 */
function DigitSlot({ digit, up, instant }: { digit: string; up: boolean; instant: boolean }) {
  return (
    <span className="relative block h-4 w-[0.62em] overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={digit}
          initial={instant ? { opacity: 0 } : { y: up ? 16 : -16, opacity: 0 }}
          animate={instant ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={instant ? { opacity: 0 } : { y: up ? -16 : 16, opacity: 0 }}
          transition={{ duration: DURATION.micro, ease: EASE_OUT_EXPO }}
          className="absolute inset-0 block text-center leading-4"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Odometer({ value, instant }: { value: number; instant: boolean }) {
  const previous = useRef(value);
  const up = value >= previous.current;
  useEffect(() => {
    previous.current = value;
  }, [value]);

  const digits = String(value).split("");

  return (
    <span className="flex font-mono text-[11px] font-black tabular-nums">
      {digits.map((digit, index) => (
        // Keyed by length as well as position so 9 → 10 opens a new slot
        // instead of re-labelling the existing one.
        <DigitSlot key={`${digits.length}-${index}`} digit={digit} up={up} instant={instant} />
      ))}
    </span>
  );
}

/* --------------------------------- burst ---------------------------------- */

/**
 * Four designed flights, not four random ones — fixed vectors read as one
 * gesture, where `Math.random()` reliably clumps two hearts together.
 * Consecutive votes are varied by mirroring the drift with the seed, which
 * costs nothing and never clumps.
 *
 * All four rise: hearts that fall read as failure. Sizes mixed 10–16px,
 * starts staggered 60ms apart, each gone inside ~750ms.
 */
const FLIGHTS = [
  { drift: 10, rise: 46, size: 15, tilt: 18, delay: 0 },
  { drift: -11, rise: 38, size: 11, tilt: -22, delay: 0.06 },
  { drift: 4, rise: 50, size: 13, tilt: 10, delay: 0.12 },
  { drift: -5, rise: 32, size: 10, tilt: -14, delay: 0.18 },
].slice(0, PARTICLES.voteBurst);

/** Gold-led with a single vermilion note — the warm mix that suits the theme. */
const HEART_TONES = [
  "var(--color-festival-gold)",
  "var(--color-vermilion)",
  "var(--color-amber-deep)",
  "var(--color-festival-gold)",
] as const;

function HeartBurst({ seed }: { seed: number }) {
  // Mirror alternate bursts so the 2nd tap isn't a replay of the 1st.
  const flip = seed % 2 === 0 ? -1 : 1;

  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10">
      {FLIGHTS.map((flight, index) => (
        <motion.span
          key={index}
          className="absolute block"
          style={{
            width: flight.size,
            height: flight.size,
            marginLeft: -flight.size / 2,
            marginTop: -flight.size / 2,
            color: HEART_TONES[index % HEART_TONES.length],
          }}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0.95, rotate: 0 }}
          animate={{
            x: flight.drift * flip,
            y: -flight.rise,
            scale: [0.4, 1.08, 1],
            opacity: 0,
            rotate: flight.tilt * flip,
          }}
          transition={{
            duration: 0.72,
            delay: flight.delay,
            ease: EASE_OUT_EXPO,
            scale: { duration: 0.3, delay: flight.delay, ease: EASE_OUT_EXPO },
          }}
        >
          <svg viewBox="0 0 24 24" className="size-full">
            <path d={HEART} fill="currentColor" />
          </svg>
        </motion.span>
      ))}
    </span>
  );
}

/* --------------------------------- button --------------------------------- */

export function VoteButton({
  message,
  onUpvote,
  pending = false,
  rejectedNonce = 0,
  className,
}: {
  message: SpeakingMessage;
  onUpvote: (id: string) => void;
  /** A vote is in flight for this message — blocks double-fires. */
  pending?: boolean;
  /** Bumped by the page when the server rejects a vote, to trigger the shake. */
  rejectedNonce?: number;
  className?: string;
}) {
  const { reduced, snappy } = useMotionPrefs();
  // Stripped to plain ident characters: React's generated ids carry delimiters
  // that are not safe to drop into a `url(#…)` reference across every engine.
  const clipId = `pk-heart-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [burst, setBurst] = useState(0);
  const [pulse, setPulse] = useState(0);
  const shakeControls = useAnimationControls();

  const inert = message.is_own;
  const voted = message.has_upvoted;

  // The parent rolls the count back on rejection; the shake is how the button
  // admits that the number it just showed was a guess that did not hold.
  //
  // Driven by imperative controls rather than by re-keying the element: a key
  // change would remount the button, wiping the burst and pulse counters
  // below and re-running this effect against a reset ref.
  const seenRejection = useRef(rejectedNonce);
  useEffect(() => {
    if (rejectedNonce === seenRejection.current) return;
    seenRejection.current = rejectedNonce;
    if (reduced) return;
    void shakeControls.start({
      x: [0, -4, 4, -3, 0],
      transition: { duration: 0.32, ease: "easeInOut" },
    });
  }, [rejectedNonce, reduced, shakeControls]);

  const handleClick = (event: React.MouseEvent) => {
    // Ranked cards are expandable; voting must never trigger that.
    event.stopPropagation();
    if (inert || pending) return;
    if (!voted && !reduced) {
      setBurst((n) => n + 1);
      setPulse((n) => n + 1);
    }
    onUpvote(message.id);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={inert || pending ? undefined : { scale: 0.94 }}
      transition={snappy}
      animate={shakeControls}
      aria-pressed={voted}
      aria-disabled={inert || pending || undefined}
      title={inert ? "You can't vote for your own response." : undefined}
      aria-label={
        inert
          ? `Your response, ${message.upvote_count} ${message.upvote_count === 1 ? "vote" : "votes"}`
          : voted
            ? `Remove your vote. ${message.upvote_count} ${message.upvote_count === 1 ? "vote" : "votes"}`
            : `Vote for this response. ${message.upvote_count} ${message.upvote_count === 1 ? "vote" : "votes"}`
      }
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5",
        // min-h keeps the tap target at 44px on touch without inflating it on
        // desktop, where the pill would look chunky.
        "min-h-11 sm:min-h-0",
        "transition-colors duration-200",
        inert
          ? "cursor-not-allowed border-ink-warm/10 bg-ink-warm/[0.04] text-ink-soft"
          : voted
            ? "border-amber-deep bg-festival-gold text-ink-warm"
            : "border-ink-warm/15 bg-kasavu text-ink-warm hover:border-amber-deep",
        pending && "cursor-progress",
        className,
      )}
    >
      {/* Voted-state inner glow, pre-rendered and crossfaded — never a
          box-shadow transition. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300",
          voted ? "opacity-100" : "opacity-0",
        )}
        style={{ boxShadow: "inset 0 1px 6px rgba(169,122,6,0.35)" }}
      />

      {/* One ring, expanding away from the button as the vote lands. */}
      <AnimatePresence>
        {pulse > 0 && (
          <motion.span
            key={pulse}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full border border-festival-gold"
            initial={{ scale: 0.85, opacity: 0.9 }}
            animate={{ scale: 1.65, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{burst > 0 && <HeartBurst key={burst} seed={burst} />}</AnimatePresence>

      {/* The heart. Outline always; the gold is a rectangle rising inside a
          heart-shaped clip, which is what gives it the liquid read. */}
      <motion.span
        className="relative block size-4"
        animate={voted && !reduced ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={{ duration: 0.34, ease: EASE_OUT_EXPO }}
      >
        <svg viewBox="0 0 24 24" className="size-full overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <path d={HEART} />
            </clipPath>
          </defs>
          <path
            d={HEART}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
            opacity={inert ? 0.55 : 0.9}
          />
          <g clipPath={`url(#${clipId})`}>
            <motion.rect
              x="0"
              width="24"
              height="24"
              fill="currentColor"
              initial={false}
              // y: 24 is empty, y: 0 is full. Filling raises the surface from
              // the bottom; un-voting lets it fall away from the top.
              animate={{ y: voted ? 0 : 24 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: voted ? 0.35 : 0.28, ease: EASE_OUT_EXPO }
              }
            />
          </g>
        </svg>
      </motion.span>

      <Odometer value={message.upvote_count} instant={reduced} />
    </motion.button>
  );
}
