import { memo, type ReactElement } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Gender } from "@/types/api";
import "./typing-indicator.css";

/**
 * Which character is typing. "anonymous" until BOTH sides accept a reveal —
 * the caller derives this from `reveal.user`, which the socket only populates
 * on reveal_success, so the gendered character cannot leak early by
 * construction.
 */
export type TypingVariant = "anonymous" | Gender;

const SKIN = "#f2c19a";
const BLUSH = "#f79a8c";

/* ------------------------------- characters -------------------------------
   Hand-drawn flat SVGs in the Bitmoji register: big rounded head, dot eyes,
   open smile — but inked with the app's 2.5px black outlines so they sit in
   the brutalist system instead of beside it. `currentColor` is the tile's
   text-ink, so the linework always matches the border around it.

   Each face is a static element (module scope): referencing the same node
   every render means React never diffs the SVG subtree while the loops run.
--------------------------------------------------------------------------- */

/** Hooded incognito figure: white hood, shadowed face, two bright eyes. */
const ANONYMOUS_FACE = (
  <g className="ti-head">
    <path
      d="M32 7C19.5 7 11.5 17 11.5 30v19c0 3.3 2.7 6 6 6h29c3.3 0 6-2.7 6-6V30C52.5 17 44.5 7 32 7Z"
      fill="#fff"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <path
      d="M32 15.5c-8.3 0-13.5 6-13.5 14S23.7 43.5 32 43.5 45.5 37.5 45.5 29.5s-5.2-14-13.5-14Z"
      fill="currentColor"
    />
    <g className="ti-eyes">
      <ellipse cx="26.5" cy="29.5" rx="2.9" ry="3.5" fill="#fff" />
      <ellipse cx="37.5" cy="29.5" rx="2.9" ry="3.5" fill="#fff" />
    </g>
    {/* hood seam */}
    <path d="M24 50h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </g>
);

/** Shared face furniture for the revealed characters: brows, eyes, blush, smile. */
function RevealedFeatures({ dy = 0 }: { dy?: number }) {
  return (
    <g transform={dy ? `translate(0 ${dy})` : undefined}>
      <path
        d="M22.8 28.8c1.8-1.5 4.2-1.5 6 0M35.2 28.8c1.8-1.5 4.2-1.5 6 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <g className="ti-eyes">
        <circle cx="26" cy="34.5" r="2.3" fill="currentColor" />
        <circle cx="38" cy="34.5" r="2.3" fill="currentColor" />
      </g>
      <circle cx="21.5" cy="39" r="1.9" fill={BLUSH} opacity="0.55" />
      <circle cx="42.5" cy="39" r="1.9" fill={BLUSH} opacity="0.55" />
      <path
        d="M26.5 41.5c1.7 2.6 4 3.9 5.5 3.9s3.8-1.3 5.5-3.9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

const MALE_FACE = (
  <g className="ti-head">
    <rect
      x="15"
      y="13.5"
      width="34"
      height="37"
      rx="15"
      fill={SKIN}
      stroke="currentColor"
      strokeWidth="2.5"
    />
    {/* short-crop hair: outer arch down to the brow line, inner arch for the forehead */}
    <path
      d="M14.5 30C14.5 17.5 22 10.5 32 10.5S49.5 17.5 49.5 30h-5.2c0-6.5-4.6-9.8-12.3-9.8S19.7 23.5 19.7 30Z"
      fill="currentColor"
    />
    <RevealedFeatures />
  </g>
);

const FEMALE_FACE = (
  <g className="ti-head">
    {/* hair behind the face, framing both sides */}
    <path
      d="M32 9C19 9 12 17.5 12 30v14c0 4 3 7 7 7h26c4 0 7-3 7-7V30C52 17.5 45 9 32 9Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <rect
      x="17.5"
      y="15.5"
      width="29"
      height="33"
      rx="13.5"
      fill={SKIN}
      stroke="currentColor"
      strokeWidth="2.5"
    />
    {/* fringe */}
    <path
      d="M17.5 28c.6-8 6.2-12.5 14.5-12.5S45.9 20 46.5 28c-4.3-4.6-9-5.6-14.5-5.6S21.8 23.4 17.5 28Z"
      fill="currentColor"
    />
    <RevealedFeatures dy={0.5} />
  </g>
);

const FACES: Record<TypingVariant, ReactElement> = {
  anonymous: ANONYMOUS_FACE,
  male: MALE_FACE,
  female: FEMALE_FACE,
};

/** Tile colors stay in the brand set; lavender is the app's anonymity color. */
const TILE_BG: Record<TypingVariant, string> = {
  anonymous: "bg-brand-lavender",
  male: "bg-brand-yellow",
  female: "bg-brand-lime",
};

/**
 * Narrow whatever arrived to a character we can actually draw.
 *
 * `variant` is typed, but it originates from a server field and TypeScript
 * cannot enforce that at runtime — `gender` has no DB-level default, so a row
 * written outside the signup path (a superuser, an import) holds `""`. That
 * indexed the maps to `undefined` and painted an empty bordered tile. Falling
 * back to the anonymous character is both the total answer and the private
 * one: an unreadable gender must never resolve to a guess.
 */
function resolveVariant(variant: TypingVariant): TypingVariant {
  return variant === "male" || variant === "female" ? variant : "anonymous";
}

/**
 * The typing row: breathing character in a brutalist tile, floating speech
 * bubble with a staggered dot wave.
 *
 * Memoized, and every loop lives in typing-indicator.css — after the entrance
 * spring settles, this subtree causes no React work at all. framer-motion is
 * used ONLY for enter/exit so AnimatePresence in the thread keeps working.
 */
export const TypingIndicator = memo(function TypingIndicator({
  variant,
}: {
  variant: TypingVariant;
}) {
  const character = resolveVariant(variant);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 480, damping: 30 }}
      className="mt-3 flex w-fit origin-bottom-left items-end gap-2.5"
      /* Decorative on purpose. The header already carries the typing state in
         a live region ("Typing…"), so giving this row a role="status" made
         assistive tech announce the same event twice — once per keystroke
         burst. The picture is the redundant half, so it stays silent. */
      aria-hidden
    >
      <div
        className={cn(
          "ti-breathe flex size-12 shrink-0 items-center justify-center border-2 border-ink p-1 text-ink shadow-brutal-sm lg:size-14",
          TILE_BG[character],
        )}
      >
        {/* One svg, three interchangeable faces — keyed so a mid-typing reveal
            swaps the character cleanly instead of morphing paths. */}
        <svg key={character} viewBox="0 0 64 64" className="size-full" aria-hidden>
          {FACES[character]}
        </svg>
      </div>

      <div className="ti-float relative mb-3 border-2 border-ink bg-surface px-3.5 py-2.5 shadow-brutal-sm">
        {/* square tail pointing back at the speaker */}
        <span
          aria-hidden
          className="absolute -left-[7px] bottom-[7px] size-3 rotate-45 border-b-2 border-l-2 border-ink bg-surface"
        />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="ti-dot size-1.5 bg-ink" />
          ))}
        </div>
      </div>
    </motion.div>
  );
});
