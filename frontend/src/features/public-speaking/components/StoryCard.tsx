import { memo, useRef } from "react";
import { motion } from "framer-motion";
import { DURATION, listItem, useMotionPrefs } from "@/lib/motion";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { SpeakingMessage } from "../api";
import { VoteButton } from "./VoteButton";

/* -------------------------------- identity -------------------------------- */

/**
 * The name line, shared by the feed and the ranking so the two can never drift.
 *
 * There used to be a coloured initial chip in front of this — a deterministic
 * gradient square carrying one letter. It went because it was decoration
 * pretending to be identification: two responses from "Anonymous Falcon" and
 * "Anonymous Fox" drew the same "F" in tones a reader has no way to decode, and
 * the handle itself, spelled out immediately to its right, already said the
 * thing precisely. What it reliably did cost was ~38px off the front of every
 * row on a phone, which is width the response itself needed.
 *
 * With the chip gone, the handle carries identity alone, so it takes the weight
 * the chip was holding: a step up in size and to full ink, against the
 * timestamp beside it in the same mono caption at the softer tone. The
 * uppercase micro-label is this page's voice and stays.
 */
export function NameLine({
  message,
  showTimeFrom = "always",
}: {
  message: SpeakingMessage;
  /** The ranking's rows are too narrow to hold handle and time below `sm`. */
  showTimeFrom?: "always" | "sm";
}) {
  return (
    <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-soft sm:tracking-[0.14em]">
      <span className="text-[11px] font-black text-ink-warm">{message.display_name}</span>
      {/* Your own response, named as such. `is_own` is the same server-owned
          flag that stops you voting for it, so this can never label someone
          else's response as yours. Deliberately quiet — normal case, a step
          down, and the soft tone: it is an annotation on the handle, not a
          second handle. */}
      {message.is_own && (
        <span className="ml-1 text-[9.5px] font-semibold normal-case tracking-normal text-ink-soft/70">
          (You)
        </span>
      )}
      <span className={cn(showTimeFrom === "sm" && "hidden sm:inline")}>
        <span className="mx-1.5 opacity-40">·</span>
        {/* Relative time, exact stamp on hover — HH:MM was ambiguous on a wall
            that spans days. */}
        <time dateTime={message.created_at} title={formatDateTime(message.created_at)}>
          {timeAgo(message.created_at)}
        </time>
      </span>
    </p>
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
          "px-3 py-2.5 transition-colors duration-200 sm:px-3.5 sm:py-3",
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

        {/*
          Top-aligned on a phone, centred from `sm`.

          Centring works when a response is one line — everything sits on the
          same optical row. On a 360px screen most of them wrap to three or
          four, and centring then floats the heart against the middle of a
          paragraph, anchored to nothing. Aligning it to the name line gives the
          row a single top edge to read from and lets the text run its full
          height beneath.
        */}
        <div className="relative flex items-start gap-2 sm:items-center sm:gap-3">
          {/* No leading column any more: the text starts at the card's own
              padding edge, which is the ~38px of extra measure the response
              gained when the initial chip went. */}
          <div className="min-w-0 flex-1">
            <NameLine message={message} />
            {/* The response is the point of the row: the largest, heaviest
                thing in it, directly under the name line. The gap widens by
                2px so the jump from 10px caption to 15px body reads as a step
                rather than as two lines that happen to touch. */}
            <p className="mt-1 break-words text-[15px] font-medium leading-[1.5] text-ink-warm">
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
