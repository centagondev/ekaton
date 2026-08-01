import { motion } from "framer-motion";
import { EASE_OUT_EXPO, SPRING_GENTLE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The Living Pookalam — this page's one bold idea, expressed four ways.
 *
 *   1. `PookalamAssemble`  it builds itself, ring by ring, as the loader.
 *   2. `Petal`             a few of it burst outward when a vote lands.
 *   3. `PookalamMandala`   it rests as a barely-visible background watermark.
 *   4. `PookalamRing`      it crowns the top-ranked responses as a medallion.
 *
 * All four are the same geometry from the same table, so they are recognisably
 * one object rather than four flower drawings that happen to share a page. The
 * rest of the design stays quiet precisely so this thread can carry the page.
 *
 * Everything here is pure SVG on a 200-unit grid: no raster, no external
 * asset, and it inherits colour from the theme tokens so a palette change
 * follows automatically.
 */

/** One teardrop petal, base at the origin, tip at y = -26. */
const PETAL_PATH = "M0 0C7-7 7-19 0-26C-7-19-7-7 0 0Z";

interface Ring {
  count: number;
  radius: number;
  scale: number;
  fill: string;
  /** Counter-rotates alternate rings so the mandala never looks like a gear. */
  offset: number;
}

/**
 * Concentric bands, outermost first — the order a real pookalam is *laid*,
 * reversed, which is why the loader walks this array backwards.
 *
 * The colours follow the flowers an athapookalam is actually made of, centre
 * outward: white thumba (the most traditional, laid first on Atham), golden
 * jamanthi, red-orange chethi, and Ekaton gold as the outermost ring — the
 * one place the brand and the tradition are allowed to be the same colour.
 */
const RINGS: readonly Ring[] = [
  { count: 16, radius: 78, scale: 1, fill: "var(--color-festival-gold)", offset: 0 },
  { count: 12, radius: 57, scale: 0.9, fill: "var(--color-vermilion)", offset: 15 },
  { count: 10, radius: 39, scale: 0.78, fill: "var(--color-amber-deep)", offset: 0 },
  { count: 8, radius: 23, scale: 0.62, fill: "var(--color-kasavu)", offset: 22 },
];

function petalTransform(angle: number, radius: number, scale: number): string {
  return `translate(100 100) rotate(${angle}) translate(0 ${-radius}) scale(${scale})`;
}

function ringPetals(ring: Ring) {
  return Array.from({ length: ring.count }, (_, index) => ({
    key: index,
    transform: petalTransform(
      (360 / ring.count) * index + ring.offset,
      ring.radius,
      ring.scale,
    ),
  }));
}

/* ------------------------------- 3. watermark ------------------------------ */

/**
 * The resting form. `variant="line"` is the background watermark — stroked
 * outlines at a few percent opacity, which reads as embossed paper rather than
 * as a washed-out picture of a flower.
 */
export function PookalamMandala({
  className,
  variant = "solid",
  dance = false,
}: {
  className?: string;
  variant?: "solid" | "line";
  /**
   * Thiruvathira mode: the chethi ring drifts counter-clockwise against the
   * caller's own clockwise turn of the whole flower. Only the loader asks for
   * this — the watermark and medallion uses stay still.
   */
  dance?: boolean;
}) {
  const line = variant === "line";

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      {RINGS.map((ring, ringIndex) => (
        <g key={ringIndex} className={dance && ringIndex === 1 ? "pk-dance-ccw" : undefined}>
          {ringPetals(ring).map((petal) => (
            <path
              key={petal.key}
              d={PETAL_PATH}
              transform={petal.transform}
              fill={line ? "none" : ring.fill}
              stroke={line ? "currentColor" : "var(--color-ink-warm)"}
              strokeWidth={line ? 1.6 : 0.8}
              strokeOpacity={line ? 1 : 0.16}
            />
          ))}
        </g>
      ))}
      <circle
        cx="100"
        cy="100"
        r="13"
        fill={line ? "none" : "var(--color-festival-gold)"}
        stroke={line ? "currentColor" : "var(--color-ink-warm)"}
        strokeWidth={line ? 1.6 : 0.8}
        strokeOpacity={line ? 1 : 0.16}
      />
      <circle
        cx="100"
        cy="100"
        r="6"
        fill={line ? "none" : "var(--color-amber-deep)"}
        stroke={line ? "currentColor" : "none"}
        strokeWidth={1.6}
      />
    </svg>
  );
}

/* -------------------------------- 1. loader -------------------------------- */

/**
 * The choreography of the laying, as numbers rather than as a feeling.
 *
 * These are exported (through `ASSEMBLE_MS`) because the loader has to know
 * when this finishes, and the two ways it could find that out are not equal.
 * It used to wait for an `onAnimationComplete` on whichever petal happened to
 * be drawn last — an event that never arrives at all if the tab is
 * backgrounded while the page loads, and that quietly moves if a future edit
 * reorders the rings. Deriving the moment from the same constants that
 * schedule the petals means the sequence is synchronised by construction
 * rather than by observation.
 */
const ASSEMBLE = {
  /**
   * Quiet beat before the first petal, so the seed is watched blooming alone
   * rather than glimpsed under the wave already arriving on top of it.
   */
  start: 1.2,
  /** How long the wave of petals takes to travel from centre to rim. */
  spread: 2.4,
  /**
   * One petal's own unfurl.
   *
   * Deliberately not `DURATION.standard`. That is the product's general-purpose
   * 300ms and belongs to buttons and panels — things that should get out of the
   * way. A petal being laid is the thing being looked at, and at 300ms it read
   * as switching on rather than opening.
   */
  petal: 0.5,
} as const;

/** Wall-clock length of the full assembly, first frame to last petal at rest. */
export const ASSEMBLE_MS = Math.round(
  (ASSEMBLE.start + ASSEMBLE.spread + ASSEMBLE.petal) * 1000,
);

/**
 * The assembling form.
 *
 * Beat 1 is the centre dot blooming. Beat 2 lays the rings from the inside out
 * — each petal scales and rotates into place, staggered within its ring so you
 * can see it being *laid* rather than switched on. The whole thing takes
 * `ASSEMBLE_MS`, which is what the loader times its next beat off.
 *
 * Reduced motion is handled by the caller: it renders `PookalamMandala`
 * instead, fully formed, and crossfades it.
 */
export function PookalamAssemble({ className }: { className?: string }) {
  // Inside-out: the visual order a pookalam is actually built in.
  const laying = [...RINGS].reverse();
  const total = laying.reduce((sum, ring) => sum + ring.count, 0);
  let laid = 0;

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      {/* Warm glow growing from the centre — one element, opacity + scale. */}
      <motion.circle
        cx="100"
        cy="100"
        r="70"
        fill="url(#pk-glow)"
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: 1, scale: 1 }}
        /* Runs the length of beat 1 and into the laying, so the warmth is
           still spreading outward as the first ring goes down rather than
           having arrived before anything else has begun. */
        transition={{ duration: 2, ease: EASE_OUT_EXPO }}
        style={{ transformOrigin: "100px 100px" }}
      />
      <defs>
        <radialGradient id="pk-glow">
          <stop offset="0%" stopColor="var(--color-festival-gold)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--color-festival-gold)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Beat 1 — the seed. The two circles are spaced far enough apart to be
          read as two events: the gold bed is laid, and then the amber heart
          is set into it. At the delays this used to carry (0.05 / 0.16) they
          landed inside the same tenth of a second and read as one shape. */}
      <motion.circle
        cx="100"
        cy="100"
        r="13"
        fill="var(--color-festival-gold)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...SPRING_GENTLE, delay: 0.2 }}
        style={{ transformOrigin: "100px 100px" }}
      />
      <motion.circle
        cx="100"
        cy="100"
        r="6"
        fill="var(--color-amber-deep)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...SPRING_GENTLE, delay: 0.55 }}
        style={{ transformOrigin: "100px 100px" }}
      />

      {/* Beat 2 — rings laid outward.
          The petal is positioned by a `transform` attribute on a static <g>
          and animated by CSS transforms on the path inside it. They must not
          share an element: Framer drives animation through the `transform`
          *style*, and on an SVG element the style overrides the attribute — so
          animating the positioned node directly would drag all fifty petals
          into a heap at the centre. */}
      {laying.map((ring, ringIndex) =>
        ringPetals(ring).map((petal) => {
          const delay = ASSEMBLE.start + (laid++ / total) * ASSEMBLE.spread;
          return (
            <g key={`${ringIndex}-${petal.key}`} transform={petal.transform}>
              <motion.path
                d={PETAL_PATH}
                fill={ring.fill}
                stroke="var(--color-ink-warm)"
                strokeWidth={0.8}
                strokeOpacity={0.16}
                style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                initial={{ opacity: 0, scale: 0, rotate: -35 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay, duration: ASSEMBLE.petal, ease: EASE_OUT_EXPO }}
              />
            </g>
          );
        }),
      )}
    </svg>
  );
}

/* --------------------------------- 2. petal -------------------------------- */

/**
 * A single marigold petal — the burst particle and the ambient drifter.
 *
 * Deliberately not a library: a vote throws twelve of these, which is twelve
 * spans. Pulling in a confetti canvas to draw twelve things would be more
 * bytes than the entire rest of this file.
 */
export function Petal({
  className,
  tone = "gold",
}: {
  className?: string;
  tone?: "gold" | "amber" | "cream" | "leaf";
}) {
  const fill = {
    gold: "var(--color-festival-gold)",
    amber: "var(--color-amber-deep)",
    cream: "var(--color-kasavu)",
    leaf: "var(--color-leaf)",
  }[tone];

  return (
    <svg viewBox="-10 -28 20 30" className={className} aria-hidden="true" focusable="false">
      <path
        d={PETAL_PATH}
        fill={fill}
        stroke="var(--color-ink-warm)"
        strokeWidth={1.1}
        strokeOpacity={0.2}
      />
    </svg>
  );
}

/* ------------------------------- 4. medallion ------------------------------ */

const MEDAL_TONES = {
  gold: { petal: "var(--color-festival-gold)", core: "var(--color-amber-deep)" },
  kasavu: { petal: "var(--color-kasavu)", core: "#d8cdb0" },
  bronze: { petal: "#c98a4b", core: "var(--color-bronze)" },
} as const;

export type MedalTone = keyof typeof MEDAL_TONES;

/**
 * The rank medallion: a ring of eight petals sized to sit *around* an avatar.
 *
 * This replaces the 🥇🥈🥉 emoji, which rendered as three unrelated artworks
 * across Windows, iOS and Android — the podium is the one place on the page
 * that has to look deliberate.
 */
export function PookalamRing({
  tone,
  className,
}: {
  tone: MedalTone;
  className?: string;
}) {
  const colours = MEDAL_TONES[tone];

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn("pointer-events-none", className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* Radius + scale chosen so the petal tips land inside the 200-unit box
          (72 + 26×0.88 ≈ 95): pushed any further out and the ring is silently
          cropped by its own viewBox. */}
      {Array.from({ length: 8 }, (_, index) => (
        <path
          key={index}
          d={PETAL_PATH}
          transform={petalTransform((360 / 8) * index, 72, 0.88)}
          fill={colours.petal}
          stroke={colours.core}
          strokeWidth={1.4}
          strokeOpacity={0.5}
        />
      ))}
    </svg>
  );
}

/* ------------------------------- the lamp ---------------------------------- */

/**
 * Nilavilakku — the lamp from the banner's right-hand side, redrawn as line
 * art. Used unlit in the empty state (nobody has spoken yet) and lit once the
 * first response lands, and as the loader's small accent.
 */
export function Nilavilakku({ lit, className }: { lit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 96" className={className} aria-hidden="true" focusable="false">
      <g
        fill="none"
        stroke="var(--color-ink-warm)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      >
        {/* Base, stem, bowl. */}
        <path d="M18 90h28" />
        <path d="M24 90c0-6 3-9 8-9s8 3 8 9" />
        <path d="M32 81V56" />
        <path d="M14 56h36l-6 8H20z" />
        <path d="M14 56c0-7 8-12 18-12s18 5 18 12" />
      </g>
      {/* The wick's flame — three keyframes, and only when lit. */}
      {lit && (
        <g className="pk-flicker" style={{ transformOrigin: "32px 44px" }}>
          <path
            d="M32 22c6 7 9 12 9 17a9 9 0 0 1-18 0c0-5 3-10 9-17z"
            fill="var(--color-festival-gold)"
            stroke="var(--color-amber-deep)"
            strokeWidth="1.6"
          />
          <path
            d="M32 31c2.6 3.4 4 6 4 8.4a4 4 0 0 1-8 0c0-2.4 1.4-5 4-8.4z"
            fill="var(--color-cream)"
          />
        </g>
      )}
    </svg>
  );
}
