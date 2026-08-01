import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogoMark } from "@/components/Logo";
import { DURATION, EASE_OUT_EXPO, SPRING_GENTLE, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Nilavilakku, PookalamAssemble, PookalamMandala } from "./Pookalam";

/**
 * "The Pookalam Assembles" — the loading story.
 *
 * A pookalam is laid one ring of petals at a time, from the centre outward, and
 * that is exactly what a loading state is: something being built while you
 * wait. So the wait *is* the flower being laid, and at the end the petals fold
 * inward and the Ekaton mark emerges from the middle of them.
 *
 *   Beat 1  a gold seed blooms at the centre
 *   Beat 2  rings are laid outward until the mandala is whole
 *   Beat 3  it converges and the logo comes out of it
 *
 * Only on the first visit of a session. After that it collapses to a ~600ms
 * settle, because a two-second story is charming once and an obstacle the
 * fourth time. The page decides when to unmount this; the story never holds
 * content that is already loaded for longer than its own last beat.
 */

const SEEN_KEY = "ekaton:onam-loader";

function seenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Storage can be blocked outright (Safari private mode, locked-down
    // enterprise profiles). Falling back to "not seen" costs one extra
    // animation, which is the harmless direction to fail in.
    return false;
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* nothing to do — see above. */
  }
}

/**
 * The loader owns no clock.
 *
 * The page unmounts it the instant the discussion query resolves, so this
 * component's only job is to look like something is happening for however long
 * that takes. It deliberately has no `onFinished`, no minimum duration and no
 * dead-man timer: every one of those was a way for an animation to hold back
 * content that had already arrived.
 *
 * On a repeat visit within the session it skips straight to the assembled
 * flower rather than laying it ring by ring, because by then the story has
 * been told.
 */
export function PookalamLoader() {
  const { reduced } = useMotionPrefs();
  const [short] = useState(seenThisSession);
  const [laid, setLaid] = useState(false);
  const [morphing, setMorphing] = useState(false);

  useEffect(() => {
    markSeen();
  }, []);

  /**
   * A held beat between the last petal landing and the converge.
   *
   * A pookalam finished on Thiruvonam is looked at, not swept away — and
   * mechanically, converging on the same frame the final petal lands made the
   * completion invisible. A third of a second of the whole flower turning is
   * the difference between "it finished" and "it vanished".
   */
  useEffect(() => {
    if (!laid) return;
    const timer = window.setTimeout(() => setMorphing(true), 350);
    return () => window.clearTimeout(timer);
  }, [laid]);

  const full = !short && !reduced;

  return (
    <div
      className="theme-pookalam pk-grain fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      role="status"
      aria-label="Loading"
    >
      <div className="pk-wash absolute inset-0" />

      <div className="relative flex flex-col items-center">
        <div className="relative size-[168px] sm:size-[200px]">
          {/* Beats 1 and 2 — or the finished flower, when there is no time (or
              no appetite) for the story. */}
          <motion.div
            className="absolute inset-0"
            animate={
              morphing
                ? { scale: 0.34, rotate: -120, opacity: 0 }
                : { scale: 1, rotate: 0, opacity: 1 }
            }
            transition={{ duration: 0.62, ease: EASE_OUT_EXPO }}
          >
            {/* The Thiruvathira turn — slow, clockwise, the dance's circle —
                on its own wrapper so the CSS loop and Framer's morph
                transform above never write to the same element. */}
            <div className={cn("size-full", !reduced && "pk-dance")}>
              {full ? (
                <PookalamAssemble className="size-full" onLaid={() => setLaid(true)} />
              ) : (
                <motion.div
                  initial={reduced ? false : { scale: 0.86, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: DURATION.standard, ease: EASE_OUT_EXPO }}
                  className="size-full"
                >
                  <PookalamMandala className="size-full" dance={!reduced} />
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Beat 3 — the mark comes out of the middle of the flower rather
              than replacing it: the converge above and this bloom below are
              the same half-second. */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={morphing || !full ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
            transition={{ ...SPRING_GENTLE, delay: full ? 0.24 : 0.12 }}
          >
            <LogoMark className="size-14 sm:size-16" />
          </motion.div>

          {/* A single flash of warmth at the hand-over. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-40%] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(254,208,1,0.5), rgba(254,208,1,0) 65%)",
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={morphing ? { opacity: [0, 0.9, 0], scale: 1.15 } : { opacity: 0 }}
            transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
          />

          {/* The waiting pulse. If data still hasn't arrived once the logo is
              out, the frame must not freeze — a slow breath of warmth says
              "still working" without a spinner. Unmounts with the loader, so
              the loop can never outlive the loading it narrates. */}
          {!reduced && (morphing || !full) && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-25%] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(254,208,1,0.35), rgba(254,208,1,0) 60%)",
              }}
              initial={{ opacity: 0, scale: 1 }}
              animate={{ opacity: [0.12, 0.4, 0.12], scale: [1, 1.07, 1] }}
              transition={{ duration: 2.8, delay: 0.9, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        {/* The lamp, lit, as a quiet accent beside the flower. */}
        {full && (
          <motion.div
            className="absolute -right-12 bottom-2 sm:-right-16"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.entrance, delay: 0.9, ease: EASE_OUT_EXPO }}
          >
            <Nilavilakku lit className="h-16 sm:h-20" />
          </motion.div>
        )}

        <motion.p
          className="mt-9 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-ink-soft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.standard, delay: full ? 1.2 : 0.1 }}
        >
          Ekaton
        </motion.p>
      </div>
    </div>
  );
}

/* -------------------------------- skeleton -------------------------------- */

/**
 * In-page loading: kasavu cards with a gold sweep, never a spinner.
 *
 * This closes a real gap rather than decorating one. Between joining and the
 * message history resolving, the list was simply empty — which rendered the
 * "No responses yet, be the first to share" empty state over a wall that was
 * already full of responses.
 */
export function StorySkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="flex list-none flex-col gap-3 sm:gap-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="relative overflow-hidden rounded-pk-lg border border-ink-warm/[0.07] bg-kasavu p-4 shadow-rest sm:p-5"
        >
          <span
            className="pk-shimmer absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-festival-gold/25 to-transparent"
            style={{ ["--pk-delay" as string]: `${index * 0.14}s` }}
          />
          <div className="flex items-center gap-3">
            <span className="size-9 shrink-0 rounded-pk-sm bg-ink-warm/[0.07]" />
            <div className="flex-1 space-y-2">
              <span className="block h-2.5 w-28 rounded-full bg-ink-warm/[0.07]" />
              <span className="block h-2 w-16 rounded-full bg-ink-warm/[0.05]" />
            </div>
            <span className="h-8 w-16 rounded-full bg-ink-warm/[0.06]" />
          </div>
          <span className="my-3.5 block h-px bg-ink-warm/[0.06]" />
          <div className="space-y-2">
            <span className="block h-3 w-full rounded-full bg-ink-warm/[0.07]" />
            <span
              className="block h-3 rounded-full bg-ink-warm/[0.07]"
              style={{ width: `${[86, 64, 92, 72][index % 4]}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
