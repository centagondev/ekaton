import { memo, useRef } from "react";
import { motion } from "framer-motion";
import { DURATION, listItem, useMotionPrefs } from "@/lib/motion";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { SpeakingMessage } from "../api";
import { VoteButton } from "./VoteButton";

/* --------------------------------- avatar --------------------------------- */

/**
 * Deterministic warm-palette chip: the same anonymous name gets the same colour
 * everywhere it appears, so a voice stays recognisable between the feed and
 * the ranking.
 *
 * The hash is unchanged from the version this replaces — only the palette
 * moved, from the app's yellow/lime/lavender to four tones taken out of the
 * banner. Lavender in particular read as UI chrome borrowed from a different
 * product once it sat under Onam artwork.
 *
 * This chip is where the page keeps its brutalist accent: a crisp 2px ink
 * border, deliberately, so the design still reads as *this* product rather
 * than as a soft template.
 */
const AVATAR_TONES = [
  "bg-gradient-to-br from-festival-gold to-amber-deep",
  "bg-gradient-to-br from-kasavu to-[#efe0bd]",
  "bg-gradient-to-br from-leaf to-leaf-deep text-cream",
  "bg-gradient-to-br from-[#ffe480] to-festival-gold",
] as const;

function avatarTone(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

/**
 * Size is a prop rather than a className override.
 *
 * `cn` is a plain string joiner with no Tailwind conflict resolution, so
 * passing `size-8` alongside the built-in `size-9` ships both classes and lets
 * stylesheet order pick the winner — which is to say, silently ignores the
 * caller. An enum can't be overruled by accident.
 */
const AVATAR_SIZES = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
} as const;

export function AnonAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-pk-sm",
        "border-2 border-ink-warm font-black uppercase text-ink-warm",
        AVATAR_SIZES[size],
        avatarTone(name),
        className,
      )}
    >
      {name.charAt(0)}
    </span>
  );
}

/* ---------------------------------- card ---------------------------------- */

interface StoryCardProps {
  message: SpeakingMessage;
  /** Position in the list, for the entrance stagger. */
  index: number;
  onUpvote: (id: string) => void;
  /** A vote for this message is in flight. */
  pending?: boolean;
  /** Bumped when the server rejects a vote for this message. */
  rejectedNonce?: number;
  /** Just arrived over the socket — plays the highlight wash once. */
  fresh?: boolean;
}

function StoryCardBase({
  message,
  index,
  onUpvote,
  pending,
  rejectedNonce,
  fresh = false,
}: StoryCardProps) {
  const { reduced } = useMotionPrefs();

  /**
   * The entrance delay is fixed at mount.
   *
   * Every arrival shifts every existing card's index by one, and a `custom`
   * that keeps changing makes Framer re-resolve the variant on cards that
   * finished arriving minutes ago. Freezing it means a new card enters at
   * delay 0 and nothing already on screen is disturbed.
   */
  const entranceIndex = useRef(index).current;

  /**
   * One horizontal band, the same density language as the ranking modal and
   * the chat page: identity and time on a single meta line, the response
   * directly under it with no divider, the heart on the right.
   *
   * What this replaced — and why it is gone rather than merely smaller:
   *   - The gradient hairline divider: 29px of height (1px line + my-3.5)
   *     whose only message was "the text starts now", which the layout
   *     already says.
   *   - Name and time as two stacked lines plus a clock glyph — three rows of
   *     chrome for one row of content.
   *   - The hover lift: a feed is scanned, not browsed; rows warming in place
   *     read calmer than rows rising toward the cursor. Colour transition
   *     only, so no transform layer per row either.
   *
   * A short response now costs ~64px against the old ~145px — the difference
   * between two on a laptop screen and six.
   */
  return (
    <motion.li
      layout="position"
      variants={listItem}
      custom={entranceIndex}
      exit={{ opacity: 0, transition: { duration: DURATION.micro } }}
      className="relative list-none"
    >
      <div
        className={cn(
          "relative rounded-pk-md border border-ink-warm/[0.07] bg-kasavu/80",
          "px-3 py-2.5 transition-colors duration-200 sm:px-3.5",
          "hover:bg-kasavu",
        )}
      >
        {/* Arrival wash — a card that landed while you were watching glows
            gold and settles. Fires once; `fresh` is cleared by the page. */}
        {fresh && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-pk-md bg-festival-gold"
            initial={{ opacity: reduced ? 0.1 : 0.28 }}
            animate={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.4 : 1.5, ease: "easeOut" }}
          />
        )}

        <div className="relative flex items-center gap-2.5 sm:gap-3">
          <AnonAvatar name={message.display_name} size="sm" className="self-start sm:mt-0.5" />

          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
              <span className="text-ink-warm">{message.display_name}</span>
              <span className="mx-1.5 opacity-40">·</span>
              {/* Relative time, exact stamp on hover — HH:MM was ambiguous on
                  a wall that spans days. */}
              <time dateTime={message.created_at} title={formatDateTime(message.created_at)}>
                {timeAgo(message.created_at)}
              </time>
            </p>
            {/* The response is the point of the row: the largest, heaviest
                thing in it, directly under the meta line. */}
            <p className="mt-0.5 break-words text-[15px] font-medium leading-[1.5] text-ink-warm">
              {message.content}
            </p>
          </div>

          <VoteButton
            message={message}
            onUpvote={onUpvote}
            pending={pending}
            rejectedNonce={rejectedNonce}
          />
        </div>
      </div>
    </motion.li>
  );
}

/**
 * Memoised: one remote vote used to re-render every card and every heart on the
 * wall, and with a layout animation on each row that meant a full measure pass
 * per socket frame. Now only the card whose count actually moved re-renders.
 */
export const StoryCard = memo(StoryCardBase);
