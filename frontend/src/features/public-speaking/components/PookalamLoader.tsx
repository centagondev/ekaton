import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LogoMark } from "@/components/Logo";
import { DURATION, EASE_OUT_EXPO, SPRING_GENTLE, useMotionPrefs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ASSEMBLE_MS, Nilavilakku, PookalamAssemble, PookalamMandala } from "./Pookalam";

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
 * Three beats, in that order, one at a time: each is given room to be seen
 * before the next begins, and the overlaps that do exist are deliberate joins
 * rather than beats colliding. The timeline below is the authority on all of
 * it, and the page holds this on screen until that timeline says the story has
 * been told.
 */

/**
 * The story's clock, in milliseconds, as one readable timeline.
 *
 *   0                    a gold seed blooms at the centre, alone
 *   ASSEMBLE_MS (4100)   the last petal has landed
 *   MORPH_AT    (4900)   the finished flower is held, turning, then converges
 *   TOTAL       (6500)   the mark has sprung out of the middle and settled
 *
 * The held beat is not padding. A pookalam finished on Thiruvonam is looked
 * at, not swept away — and mechanically, converging on the same frame the
 * final petal lands made the completion invisible.
 *
 * The tail has to outlast the slowest thing in the last beat: the logo's
 * gentle spring, which starts 400ms into the converge and takes the better
 * part of a second to settle.
 */
const HOLD_MS = 800;
const TAIL_MS = 1600;

const MORPH_AT = ASSEMBLE_MS + HOLD_MS;
const TOTAL_MS = MORPH_AT + TAIL_MS;

/**
 * The largest gap the timeline will accept as real elapsed time.
 *
 * The clock below advances by the distance between animation frames, and there
 * are two situations where that distance is not time the viewer spent
 * watching: a backgrounded tab, where the browser stops producing frames
 * entirely and Framer's animations freeze with them, and a device that drops a
 * long stall. Clamping the step means the story *pauses* through both rather
 * than jumping past the frames nobody saw. Erring on the side of the timeline
 * running slightly behind the animation is deliberate — behind means the last
 * beat is still on screen when we hand over, ahead means it was cut.
 */
const MAX_STEP_MS = 100;

/**
 * The loader tells its story to the end, every time.
 *
 * It used to own no clock at all — the page unmounted it the instant the
 * discussion query resolved. On localhost that query took long enough for the
 * flower to be laid; in production it resolves in tens of milliseconds, which
 * cut the story to its last few frames and nobody ever saw the pookalam
 * assemble. `onFinished` is the fix: it fires when the story has actually been
 * told, and the page holds the loader until then. If data is still loading
 * when the story ends the loader simply stays up — the waiting pulse below
 * covers that — so ceremony and network never add to each other.
 *
 * There is deliberately no abbreviated telling. This component once kept a
 * `sessionStorage` flag of its own and skipped straight to the assembled
 * flower on a second visit, on the reasoning that a two-second story is
 * charming once and an obstacle the fourth time. In practice it meant leaving
 * the event and coming straight back played a different, faster animation than
 * the one you had just watched — the intro's speed depended on invisible
 * cached state, which is exactly what makes an experience feel unreliable
 * rather than considerate.
 *
 * The page has since put a session flag back, but at the other level: it
 * decides whether this component mounts *at all*, and renders `PookalamHold`
 * below when it doesn't. That is the distinction worth keeping — every
 * telling is still the same telling, and a visit either gets the whole story
 * or none of it. Nothing here is ever hurried.
 *
 * The one exception inside this file is `prefers-reduced-motion`, which is not
 * a cache: it is a visitor saying they do not want to be moved, and holding
 * them behind six seconds of motion they asked not to see would be the
 * opposite of respecting it. They get the finished flower and an immediate
 * hand-over.
 */
export function PookalamLoader({ onFinished }: { onFinished?: () => void }) {
  const { reduced } = useMotionPrefs();
  const [morphing, setMorphing] = useState(false);

  const full = !reduced;

  // Kept in a ref so the timeline below never restarts because a parent
  // re-render handed down a new callback identity.
  const finishedRef = useRef(onFinished);
  useEffect(() => {
    finishedRef.current = onFinished;
  });

  /**
   * The whole timeline, on one clock, driven by animation frames.
   *
   * Not `setTimeout`. Timers keep running at full speed in a backgrounded tab
   * while `requestAnimationFrame` — and therefore every animation on this
   * screen — stops dead, so a timer-driven story would hand over to a viewer
   * who had watched none of it. Counting frames instead means the story is
   * measured in time the viewer was actually present for, and it pauses and
   * resumes with the animation it is narrating.
   *
   * Both beats read from the same accumulator rather than chaining, so the
   * converge cannot drift away from the moment the last petal lands.
   */
  useEffect(() => {
    if (reduced) {
      finishedRef.current?.();
      return;
    }

    let frame = 0;
    let last = performance.now();
    let elapsed = 0;
    let morphed = false;

    const tick = (now: number) => {
      elapsed += Math.min(now - last, MAX_STEP_MS);
      last = now;

      if (!morphed && elapsed >= MORPH_AT) {
        morphed = true;
        setMorphing(true);
      }

      if (elapsed >= TOTAL_MS) {
        finishedRef.current?.();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  return (
    <div
      className="theme-pookalam pk-grain fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      role="status"
      aria-label="Loading"
    >
      <div className="pk-wash absolute inset-0" />

      <div className="relative flex flex-col items-center">
        <div className="relative size-[168px] sm:size-[200px]">
          {/* Beats 1 and 2 — or the finished flower, when there is no appetite
              for the story. */}
          <motion.div
            className="absolute inset-0"
            animate={
              morphing
                ? { scale: 0.34, rotate: -120, opacity: 0 }
                : { scale: 1, rotate: 0, opacity: 1 }
            }
            /* A full second to fold inward. The converge is the flower's exit
               and a third of a turn of travel: at the 620ms it used to take,
               the rotation was over before the eye had followed it round. */
            transition={{ duration: 1, ease: EASE_OUT_EXPO }}
          >
            {/* The Thiruvathira turn — slow, clockwise, the dance's circle —
                on its own wrapper so the CSS loop and Framer's morph
                transform above never write to the same element. */}
            <div className={cn("size-full", !reduced && "pk-dance")}>
              {full ? (
                <PookalamAssemble className="size-full" />
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
              than replacing it. The delay places it just past the midpoint of
              the converge above, so the two overlap: the flower is still
              folding when the mark starts to rise out of it, which is what
              makes this read as one movement rather than a swap. */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={morphing || !full ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
            transition={{ ...SPRING_GENTLE, delay: full ? 0.4 : 0.12 }}
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
            /* Spans the whole hand-over: the swell peaks under the converge
               and is still fading as the mark settles. */
            transition={{ duration: 1.4, ease: EASE_OUT_EXPO }}
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
              /* Starts after the hand-over flash has cleared, so the two warm
                 glows never overlap and read as a flicker. */
              transition={{ duration: 3.4, delay: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        {/* The lamp, lit, as a quiet accent beside the flower.
            Placed inside the laying rather than before it: the flower is
            already a ring or two deep when the lamp is set down and takes
            light, so it arrives as company for something under way instead of
            as a second thing starting at the same moment. */}
        {full && (
          <motion.div
            className="absolute -right-12 bottom-2 sm:-right-16"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.9, ease: EASE_OUT_EXPO }}
          >
            <Nilavilakku lit className="h-16 sm:h-20" />
          </motion.div>
        )}

        {/* Last of the supporting elements to arrive, well clear of the lamp,
            so the eye is handed one thing at a time all the way down. */}
        <motion.p
          className="mt-9 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-ink-soft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: full ? 3.1 : 0.1 }}
        >
          Ekaton
        </motion.p>
      </div>
    </div>
  );
}

/* ---------------------------------- hold ---------------------------------- */

/**
 * The waiting screen for a visit that has already seen the story.
 *
 * Same surface as the loader — same wash, same grain, same mark at the same
 * size — so returning to the page lands you somewhere recognisable rather than
 * on a second, unrelated loading design. What it does not have is the story:
 * no assembly, no converge, no lamp, no timeline. It holds for exactly as long
 * as the query takes and not one frame longer, which on a warm cache is no
 * frames at all.
 *
 * A plain fade is the whole animation. There is no pulse or spinner because
 * this is not a wait anyone should have time to notice — and if the network
 * really is that slow, a still mark says "still here" without implying the
 * ceremony is about to start again.
 */
export function PookalamHold() {
  return (
    <div
      className="theme-pookalam pk-grain fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      role="status"
      aria-label="Loading"
    >
      <div className="pk-wash absolute inset-0" />
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.standard, ease: EASE_OUT_EXPO }}
      >
        <LogoMark className="size-14 sm:size-16" />
      </motion.div>
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
    /*
     * Shaped as the row it stands in for.
     *
     * It used to be a much taller card — a leading square, a hairline divider,
     * two paragraphs — from a version of StoryCard that no longer exists, so
     * the wall visibly re-laid itself out the moment real responses arrived.
     * The geometry below is the card's: same radius, same border, same
     * padding, no leading column, name line over body with the vote pill right.
     */
    <ul className="flex list-none flex-col gap-2.5 sm:gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="relative overflow-hidden border-2 border-ink/15 bg-surface px-3 py-2.5 sm:px-3.5 sm:py-3"
        >
          <span
            className="pk-shimmer absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-brand-yellow/30 to-transparent"
            style={{ ["--pk-delay" as string]: `${index * 0.14}s` }}
          />
          <div className="flex items-start gap-2 sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1">
              <span className="block h-2.5 w-24 bg-ink/[0.07]" />
              <span
                className="mt-2 block h-3 bg-ink/[0.07]"
                style={{ width: `${[86, 64, 92, 72][index % 4]}%` }}
              />
            </div>
            <span className="h-8 w-14 shrink-0 bg-ink/[0.06]" />
          </div>
        </li>
      ))}
    </ul>
  );
}
