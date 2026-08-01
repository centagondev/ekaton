import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";

/**
 * One motion vocabulary for the whole product.
 *
 * Everything that moves should pull its easing, spring and duration from here
 * rather than inventing its own, so the page feels like one material rather
 * than a pile of independently-tuned effects.
 *
 * The other half of this module's job is reduced motion. The global CSS rule in
 * styles/index.css only neutralises *CSS* animations and transitions — Framer
 * Motion drives its values from JavaScript and ignores the media query
 * entirely, so before this module every spring, burst and layout animation on
 * the site played at full force for someone who had asked for none of it.
 * `useMotionPrefs()` is the single gate that fixes that: it hands back calm,
 * opacity-only equivalents instead of springs and travel.
 */

/* --------------------------------- easing --------------------------------- */

/** Decisive arrival — the house easing for anything entering. */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** Symmetric and unhurried — for things that move and settle in place. */
export const EASE_IN_OUT_SOFT: [number, number, number, number] = [0.65, 0, 0.35, 1];

/* -------------------------------- durations ------------------------------- */

export const DURATION = {
  /** Colour swaps, icon beats. */
  micro: 0.18,
  /** The default for anything with a visible travel. */
  standard: 0.3,
  /** First paint of a section. */
  entrance: 0.55,
  /** A vote landing, a checkmark drawing. */
  celebration: 1,
  /** Full-screen page transition. */
  transition: 1.3,
} as const;

/* --------------------------------- springs -------------------------------- */

/** The default. Used for cards, panels, layout shifts. */
export const SPRING: Transition = { type: "spring", stiffness: 260, damping: 22 };
/** Slower and heavier — for large surfaces that would feel twitchy otherwise. */
export const SPRING_GENTLE: Transition = { type: "spring", stiffness: 170, damping: 26 };
/** Presses and taps: reacts inside a frame or two, no overshoot to speak of. */
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 500, damping: 30 };

/** What every spring above collapses to when motion is reduced. */
export const CALM: Transition = { duration: DURATION.micro, ease: EASE_OUT_EXPO };

/* -------------------------------- staggering ------------------------------ */

const STAGGER_STEP = 0.07;
/** Total entrance never runs past this, however many cards there are. */
const STAGGER_CAP = 0.6;

export function staggerDelay(index: number): number {
  return Math.min(index * STAGGER_STEP, STAGGER_CAP);
}

/* ----------------------------- particle budgets --------------------------- */

/**
 * Hard caps, named so the budget is a fact in the code rather than a promise in
 * a document. Every particle source clamps to one of these.
 */
export const PARTICLES = {
  /** Hearts floated by a single vote. */
  voteBurst: 4,
  /** Sparkles + petals inside the submitted dialog. */
  celebration: 30,
  /** Petals drifting in the page background, for the life of the page. */
  ambient: 7,
} as const;

/* ---------------------------------- hook ---------------------------------- */

export interface MotionPrefs {
  /** True when the visitor has asked for less movement. */
  reduced: boolean;
  spring: Transition;
  gentle: Transition;
  snappy: Transition;
  /**
   * Fade + rise, or a plain fade when motion is reduced. `distance` is ignored
   * in the reduced case rather than merely shortened — a 4px twitch reads as a
   * rendering fault, not as restraint.
   */
  rise: (distance?: number) => Variants;
  /** Scale-in for panels and dialogs; opacity-only when reduced. */
  pop: (from?: number) => Variants;
  /** `whileTap` scale, or nothing at all when reduced. */
  tap: (scale?: number) => { scale: number } | undefined;
}

export function useMotionPrefs(): MotionPrefs {
  const reduced = Boolean(useReducedMotion());

  return useMemo<MotionPrefs>(() => {
    const transition = reduced ? CALM : SPRING;

    return {
      reduced,
      spring: transition,
      gentle: reduced ? CALM : SPRING_GENTLE,
      snappy: reduced ? CALM : SPRING_SNAPPY,

      rise: (distance = 16) => ({
        hidden: reduced ? { opacity: 0 } : { opacity: 0, y: distance },
        show: reduced
          ? { opacity: 1, transition: CALM }
          : { opacity: 1, y: 0, transition: { duration: DURATION.entrance, ease: EASE_OUT_EXPO } },
        exit: reduced ? { opacity: 0, transition: CALM } : { opacity: 0, transition: CALM },
      }),

      pop: (from = 0.92) => ({
        hidden: reduced ? { opacity: 0 } : { opacity: 0, scale: from, y: 12 },
        show: reduced
          ? { opacity: 1, transition: CALM }
          : { opacity: 1, scale: 1, y: 0, transition: SPRING },
        exit: reduced
          ? { opacity: 0, transition: CALM }
          : { opacity: 0, scale: from, y: 8, transition: CALM },
      }),

      tap: (scale = 0.95) => (reduced ? undefined : { scale }),
    };
  }, [reduced]);
}

/* -------------------------------- variants -------------------------------- */

/**
 * Container for a staggered list. Pair with `listItem` on each child, passing
 * the child's index through `custom`.
 *
 * Deliberately *not* `staggerChildren`: Framer's stagger is per-child and
 * uncapped, so a hundred-card wall would take seven seconds to finish
 * arriving. `listItem` reads its delay from `staggerDelay` instead, which
 * flattens past the cap — the ninetieth card and the tenth both land at 600ms,
 * and the whole list is always in within the same beat.
 */
export const listContainer: Variants = {
  hidden: {},
  show: {},
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.entrance,
      ease: EASE_OUT_EXPO,
      delay: staggerDelay(index),
    },
  }),
};
