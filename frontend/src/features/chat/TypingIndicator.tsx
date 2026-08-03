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

/**
 * The anonymous stranger: a cozy hooded figure with shoulders, drawn in the
 * app's ink. The face stays in shadow — anonymity is the point — but the eyes
 * have whites and pupils that glance about, and a small smile floats in the
 * dark, so the character reads as a friendly *someone* rather than a void.
 * Drawstrings ground the hoodie; a sparkle twinkles beside the hood as the
 * one playful accent. Every animated part is a named group so the CSS loops
 * can move it without React ever re-rendering the subtree.
 */
const ANONYMOUS_FACE = (
  <g className="ti-head">
    {/* shoulders — a body, however small, is what makes it a character */}
    <path
      d="M14 58c0-7.8 7.8-12 18-12 10.2 0 18 4.2 18 12v.5H14v-.5Z"
      fill="#fff"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* hood */}
    <path
      d="M32 5.5c-11.8 0-19.5 9.3-19.5 21.2 0 6.6 2.4 12.2 6.2 15.8 1.8 1.7 4.2 2.6 6.7 2.6h13.2c2.5 0 4.9-.9 6.7-2.6 3.8-3.6 6.2-9.2 6.2-15.8C51.5 14.8 43.8 5.5 32 5.5Z"
      fill="#fff"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    {/* hood opening: the shadow that keeps them anonymous */}
    <path
      d="M32 13c-7.9 0-13.2 5.8-13.2 13.7S24.1 40.5 32 40.5s13.2-5.9 13.2-13.8S39.9 13 32 13Z"
      fill="currentColor"
    />
    {/* eyes: whites that blink, pupils that glance */}
    <g className="ti-eyes">
      <ellipse cx="26.3" cy="26" rx="3.3" ry="4" fill="#fff" />
      <ellipse cx="37.7" cy="26" rx="3.3" ry="4" fill="#fff" />
      <g className="ti-pupils">
        <circle cx="26.9" cy="26.9" r="1.6" fill="currentColor" />
        <circle cx="38.3" cy="26.9" r="1.6" fill="currentColor" />
      </g>
    </g>
    {/* a small smile, floating in the shadow */}
    <path
      d="M28.6 34.4c1.9 1.8 4.9 1.8 6.8 0"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* drawstrings on the chest — deliberately uneven, the way real ones
        hang. Their whole job is to say "hoodie" in two marks. */}
    <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M29.3 46.8v5.2" />
      <path d="M34.7 46.8v6.6" />
    </g>
    {/* the twinkle by the hood */}
    <path
      className="ti-spark"
      d="M53.5 5.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3Z"
      fill="currentColor"
    />
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
    // The outer wrapper animates HEIGHT, not just opacity — the technique the
    // event chat's TypingBubble established. This row is ~70px of layout at
    // the very bottom of the transcript; mounting it at full size — or letting
    // AnimatePresence yank it out at full size right as the partner's message
    // arrives — snapped the transcript's height twice per arrival, which read
    // as the message list shaking. Easing the height means the transcript
    // grows and shrinks smoothly instead. The spacing (pt-3) lives INSIDE the
    // measured wrapper for the same reason: a margin on the animated element
    // would still collapse as a 12px snap. The 1-unit bottom/right padding is
    // shadow room — overflow-hidden would otherwise clip the brutal offsets.
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      /* `self-start` rather than `w-fit`: both shrink the row to its content
         in a column flex container, but one of them does it with an
         alignment the transcript already relies on everywhere else, and the
         other with a `fit-content` width keyword whose support inside a flex
         item is the least uniform thing in this file. `shrink-0` is the other
         half of the same idea — the transcript is a flex column, and a flex
         column is entitled to compress its items when the viewport is short,
         which on a small phone with the keyboard up is exactly the moment
         this row appears. The tile inside it keeps its 3rem height either
         way, so a compressed row would push the character past the
         transcript's own overflow clip and cut it off from below, leaving
         the speech bubble on screen with nobody beside it. */
      className="shrink-0 self-start overflow-hidden"
      /* Decorative on purpose. The header already carries the typing state in
         a live region ("Typing…"), so giving this row a role="status" made
         assistive tech announce the same event twice — once per keystroke
         burst. The picture is the redundant half, so it stays silent. */
      aria-hidden
    >
      <motion.div
        initial={{ y: 8, scale: 0.92 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 480, damping: 30 }}
        className="flex origin-bottom-left items-end gap-2.5 pb-1 pr-1 pt-3"
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
            side), so every browser lands on the same pixels.

            `shrink-0` and `max-*-full` are what make that arithmetic safe to
            depend on. It only balances at a 16px root font size: the tile and
            the character are in rem but the border is in px, so the content
            box is 40k − 4 while the character is 36k, and every phone running
            a browser text-size below 100% (Android's font-size setting scales
            the root) makes the character the larger of the two. As a flex
            item with the default shrink factor it was then squeezed on one
            axis only, and `object-contain` letterboxed what was left —
            measured at a 10px root: a 22.5px character pressed into 21.6px
            and visibly adrift inside its own tile. shrink-0 takes it out of
            flex distribution entirely; max-*-full keeps it inside the padding
            regardless. Unlike `size-full` these are maximums, so an engine
            that treats the tile's content box as indefinite simply ignores
            them and leaves the definite size-9 standing — the safe direction
            to fail in, and the reason the note above does not apply to them.

            The width/height attributes are a floor under the same box: an
            inline <svg> carrying nothing but a viewBox has no intrinsic size
            to fall back on, and the CSS classes override them at every
            breakpoint, so they only ever matter if the class does not land. */}
        {character === "anonymous" ? (
          <svg
            viewBox="0 0 64 64"
            width="36"
            height="36"
            className="size-9 max-h-full max-w-full shrink-0 lg:size-11"
            aria-hidden
          >
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
            className="ti-head-img size-9 max-h-full max-w-full shrink-0 object-contain lg:size-11"
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
    </motion.div>
  );
});
