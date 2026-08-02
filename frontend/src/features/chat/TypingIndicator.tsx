import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Gender } from "@/types/api";
import maleAvatar from "./assets/avatar-male.png";
import femaleAvatar from "./assets/avatar-female.png";
import "./typing-indicator.css";

/**
 * Which character is typing. "anonymous" until BOTH sides accept a reveal —
 * the caller derives this from `reveal.user`, which the socket only populates
 * on reveal_success, so the gendered character cannot leak early by
 * construction.
 */
export type TypingVariant = "anonymous" | Gender;

/* ------------------------------- characters -------------------------------
   Two registers, on purpose.

   BEFORE a reveal the character is drawn here as a flat SVG, inked with the
   app's 2.5px black outlines so it sits inside the brutalist system rather
   than beside it — and, more importantly, so an anonymous partner is a
   *symbol* rather than a person. `currentColor` is the tile's text-ink, so the
   linework always matches the border around it.

   AFTER a reveal the character is the supplied Bitmoji portrait, imported as a
   real asset so Vite fingerprints and compresses it. Both are trimmed to their
   own artwork and share a render height, so neither is stretched and the two
   genders read at the same scale.

   The anonymous face is a static element (module scope): referencing the same
   node every render means React never diffs the SVG subtree while the loops
   run.
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

/** The supplied Bitmoji portraits, one per revealed gender. */
const AVATARS: Record<Gender, string> = {
  male: maleAvatar,
  female: femaleAvatar,
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
        {/* Sized in absolute units rather than `size-full`.
            A percentage height on a replaced element (svg/img) inside a flex
            box is the one thing here whose resolution genuinely differs
            between engines — Chrome measures it against the tile's content
            box, others can treat that box as indefinite and collapse the child
            to nothing, which leaves the speech bubble sitting on its own with
            no character beside it. size-9/size-11 IS the tile's content box
            (48 and 56, less the 2px border and 1 unit of padding on each
            side), so every browser lands on the same pixels. */}
        {character === "anonymous" ? (
          <svg viewBox="0 0 64 64" className="size-9 lg:size-11" aria-hidden>
            {ANONYMOUS_FACE}
          </svg>
        ) : (
          /* Keyed so a mid-typing reveal swaps the portrait outright instead of
             leaving the previous one up while the new file decodes. */
          <img
            key={character}
            src={AVATARS[character]}
            alt=""
            aria-hidden
            draggable={false}
            decoding="async"
            /* object-contain, never object-cover: the two portraits have
               different aspect ratios and cropping to fill would cut the top
               of someone's head off. Letterboxing inside the tile keeps both
               whole and undistorted at every size. */
            className="ti-head-img size-9 object-contain lg:size-11"
          />
        )}
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
