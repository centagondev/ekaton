import { memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { EASE_OUT_EXPO, useMotionPrefs } from "@/lib/motion";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { SpeakingMessage } from "../api";
import { byVotes } from "../ordering";
import { AnonAvatar } from "./StoryCard";
import { VoteButton } from "./VoteButton";

/**
 * Every response, ranked by hearts.
 *
 * The top ten get the emphasis and everything past it stays one tap away
 * behind "Show all" — a hard cut at ten was what previously made the eleventh
 * response invisible, and the responses with no votes yet are exactly the ones
 * that most need a first heart.
 *
 * This is the one place on the page where rows are *supposed* to move. The feed
 * is deliberately time-ordered and never re-sorts under the reader's thumb;
 * here, rank is the subject, so `layout` on each row means a vote landing
 * anywhere in the room glides the affected rows past each other in real time.
 *
 * Density is the whole design. This reads like the private chat page's message
 * list — a scannable column, not a stack of cards — because a leaderboard's job
 * is comparison, and you cannot compare what you have to scroll between. The
 * previous version spent ~190px on a podium row and fit three on a phone.
 */

const PODIUM = 3;
const TOP = 10;

/**
 * Rows past this arrive instantly.
 *
 * A per-row delay that keeps climbing makes a long list feel like it is loading
 * rather than opening; eight rows is roughly one screen, which is all the
 * reader is waiting on.
 */
const STAGGER_ROWS = 8;
const STAGGER_STEP = 0.03;

/**
 * Warm tint for the top three, strongest at rank 1.
 *
 * This is the entire podium treatment — no rings, no medals, no crowns. The
 * ranking is already stated by the number in the left column and by the order
 * itself; a badge would be the third telling of the same fact.
 */
const PODIUM_TINT = [
  "bg-festival-gold/[0.13]",
  "bg-festival-gold/[0.08]",
  "bg-festival-gold/[0.05]",
] as const;

/* ----------------------------------- row ---------------------------------- */

/**
 * Memoised on purpose: a vote changes one row's count, and without this every
 * open row re-renders — including its `layout` measurement — on each socket
 * frame the room produces.
 */
const RankedRow = memo(function RankedRow({
  message,
  index,
  total,
  onUpvote,
  pending,
  rejectedNonce,
}: {
  message: SpeakingMessage;
  index: number;
  total: number;
  onUpvote: (id: string) => void;
  pending?: boolean;
  rejectedNonce?: number;
}) {
  const { reduced } = useMotionPrefs();
  const podium = index < PODIUM;

  return (
    <motion.li
      layout
      aria-posinset={index + 1}
      aria-setsize={total}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.22,
        ease: EASE_OUT_EXPO,
        delay: index < STAGGER_ROWS ? index * STAGGER_STEP : 0,
      }}
      className={cn(
        "border-b border-ink-warm/[0.06] last:border-b-0",
        // Colour only. A dense list that lifts or scales under the cursor
        // reads as a card grid pretending to be a list.
        "transition-colors duration-200 hover:bg-festival-gold/[0.07]",
        podium && PODIUM_TINT[index],
      )}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4">
        {/* Fixed width, tabular figures: the point of a rank column is that
            every number sits on the same axis down the left edge. */}
        <span
          className={cn(
            "w-5 shrink-0 text-right font-mono text-[12px] font-bold tabular-nums",
            podium ? "text-ink-warm" : "text-ink-soft/70",
          )}
        >
          {index + 1}
        </span>

        <AnonAvatar name={message.display_name} size="sm" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
            {message.display_name}
            {/* Below `sm` the row is too narrow for the handle and the time to
                coexist without one of them truncating to noise. */}
            <span className="hidden sm:inline">
              <span className="mx-1.5 opacity-40">·</span>
              <time dateTime={message.created_at} title={formatDateTime(message.created_at)}>
                {timeAgo(message.created_at)}
              </time>
            </span>
          </p>
          {/* The response is the content of the row; rank and handle are the
              metadata around it. Clamped to two lines — the full text carries
              on the `title`, and the feed is where responses are read in
              full. */}
          <p
            title={message.content}
            className="mt-0.5 line-clamp-2 break-words text-[13.5px] leading-[1.45] text-ink-warm"
          >
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
    </motion.li>
  );
});

/* ---------------------------------- modal --------------------------------- */

export function RankingModal({
  open,
  onClose,
  messages,
  onUpvote,
  pendingVotes,
  rejections,
}: {
  open: boolean;
  onClose: () => void;
  messages: SpeakingMessage[];
  onUpvote: (id: string) => void;
  pendingVotes: ReadonlySet<string>;
  rejections: Readonly<Record<string, number>>;
}) {
  const [showAll, setShowAll] = useState(false);

  // Ranked here rather than upstream, from the same array the feed renders, so
  // the existing socket frames keep this live with no extra request.
  const ranked = useMemo(() => byVotes(messages), [messages]);
  const visible = showAll ? ranked : ranked.slice(0, TOP);
  const hidden = ranked.length - visible.length;

  // Collapse again between openings, so the modal always opens on the podium.
  useEffect(() => {
    if (!open) setShowAll(false);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ranking"
      variant="soft"
      /* `chrome={false}` so the panel becomes a flex column that owns its own
         scrolling: a header that stays put while the list moves under it needs
         the scroll on the list, not on the panel.

         The `!` modifiers are load-bearing — `cn` here is a plain join, not
         tailwind-merge, so without them these would sit alongside the panel's
         own `max-w-lg` / `max-h-[92dvh]` / `overflow-y-auto` and the winner
         would be decided by stylesheet order rather than by this file. */
      chrome={false}
      className="flex max-h-[76dvh]! w-full max-w-[480px]! flex-col overflow-hidden!"
    >
      {/* ---------------------------- header ---------------------------- */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink-warm/[0.08] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-ink-warm">
            Ranking
          </h2>
          <p className="mt-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-soft">
            Every response, most hearted first.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="-mr-1 shrink-0 rounded-full border border-transparent p-1.5 text-ink-soft transition-colors hover:border-ink-warm/15 hover:bg-kasavu hover:text-ink-warm"
        >
          <X className="size-5" />
        </button>
      </div>

      {ranked.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-ink-soft">
          No responses yet — be the first to share.
        </p>
      ) : (
        /* `min-h-0` is what actually lets this scroll: a flex child's default
           `min-height:auto` refuses to shrink below its content, so the
           overflow would otherwise move up to the panel and take the header
           with it. */
        <div className="relative min-h-0 flex-1">
          <div className="h-full overflow-y-auto scroll-thin overscroll-contain">
            <ol className="flex list-none flex-col">
              <AnimatePresence initial={false}>
                {visible.map((message, index) => (
                  <RankedRow
                    key={message.id}
                    message={message}
                    index={index}
                    total={ranked.length}
                    onUpvote={onUpvote}
                    pending={pendingVotes.has(message.id)}
                    rejectedNonce={rejections[message.id] ?? 0}
                  />
                ))}
              </AnimatePresence>
            </ol>

            {hidden > 0 && (
              <div className="p-3 sm:p-4">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-center gap-2 rounded-pk-md",
                    "border border-ink-warm/10 bg-kasavu px-4",
                    "font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-warm",
                    "transition-colors hover:border-amber-deep hover:bg-festival-gold/15",
                  )}
                >
                  Show all {ranked.length} responses
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Edge softening, so rows meet the header and the panel's bottom by
              fading rather than by being sliced. Static gradients over a fixed
              cream ground — nothing here animates or repaints on scroll. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-cream to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-cream to-transparent"
          />
        </div>
      )}
    </Modal>
  );
}
