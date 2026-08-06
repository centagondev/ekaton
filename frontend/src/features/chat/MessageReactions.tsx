import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Quick emoji reactions — live, but deliberately ephemeral.
 *
 * A reaction is relayed to the partner over the chat socket (`reaction`
 * frames, mirroring `typing`: no database, no persistence) and vanishes with
 * the room, exactly like the transcript itself. The palette below is
 * mirrored in the backend's ALLOWED_REACTION_EMOJIS (apps/chat/consumers.py)
 * — anything else is dropped server-side.
 *
 * Deploy-order note: a backend that predates the reaction handler answers
 * these frames with an `error` frame, and the page treats `error` frames as
 * refused *sends* — which retires an optimistic draft and would desync the
 * send/echo pairing. `handleServerError` in ChatRoomPage therefore ignores
 * the "Unsupported event type." refusal specifically: against an old server,
 * reactions silently degrade to local-only instead of corrupting messages.
 */

/** The five quick reactions, in display order. */
export const QUICK_REACTIONS = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "😂", label: "Laughing" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🔥", label: "Fire" },
] as const;

/**
 * The floating five-emoji strip, anchored to a bubble's corner.
 *
 * Absolutely positioned against the message row so opening it never moves a
 * single bubble. It normally sits above the bubble; the caller flips it below
 * for messages so close to the top of the transcript that "above" would be
 * clipped by the scroll container.
 */
export const ReactionPicker = memo(function ReactionPicker({
  current,
  side,
  placement,
  onPick,
  onDismiss,
}: {
  /** The reaction already on this message, if any. */
  current: string | null;
  side: "own" | "partner";
  placement: "above" | "below";
  onPick: (emoji: string) => void;
  /** Escape from inside the picker — the caller also restores focus. */
  onDismiss: () => void;
}) {
  return (
    <motion.div
      role="group"
      aria-label="React to this message"
      /* The transcript is an aria-live region, so without this every open
         would read all five emoji out as if they were new chat content. The
         buttons still announce normally when focused. */
      aria-live="off"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // Handled here so focus returns to the trigger; the page's own
        // Escape listener covers the case where focus is elsewhere.
        event.stopPropagation();
        onDismiss();
      }}
      initial={{ opacity: 0, scale: 0.7, y: placement === "above" ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.1 } }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      // The page closes the picker on any pointerdown that reaches the
      // document; a press inside the picker must not count as "outside".
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        "absolute z-30 flex items-center gap-0.5 border-2 border-ink bg-surface p-1 shadow-brutal-sm",
        // Offset from the bubble's own edge rather than a fixed distance, so
        // the picker clears it by exactly 8px at any button size.
        placement === "above" ? "bottom-full mb-2" : "top-full mt-2",
        side === "own" ? "right-0" : "left-0",
        // Scale out of the corner it is anchored to, so the pop reads as
        // growing from the bubble rather than dropping in from nowhere.
        placement === "above"
          ? side === "own"
            ? "origin-bottom-right"
            : "origin-bottom-left"
          : side === "own"
            ? "origin-top-right"
            : "origin-top-left",
      )}
    >
      {QUICK_REACTIONS.map(({ emoji, label }, index) => (
        <motion.button
          key={emoji}
          type="button"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.02 + index * 0.025, type: "spring", stiffness: 640, damping: 26 }}
          whileHover={{ scale: 1.2, y: -2 }}
          whileTap={{ scale: 0.85 }}
          onClick={() => onPick(emoji)}
          aria-label={current === emoji ? `Remove ${label} reaction` : `React with ${label}`}
          aria-pressed={current === emoji}
          className={cn(
            // 44px on touch — the size a thumb can hit without catching the
            // neighbouring emoji, and the figure Apple's and Google's target
            // guidance both land on. Tightened once a mouse is driving.
            "grid size-11 select-none place-items-center text-xl leading-none sm:size-9 sm:text-lg",
            current === emoji ? "bg-brand-yellow" : "hover:bg-raised",
          )}
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
});

const labelFor = (emoji: string) =>
  QUICK_REACTIONS.find((reaction) => reaction.emoji === emoji)?.label ?? "emoji";

/**
 * The reactions sitting on a message: the partner's, then this user's, in
 * one row. In normal flow below the bubble — an absolute badge would overlap
 * the next bubble in a 4px-gapped group — with the row's height eased in the
 * way the composer's reply strip arrives. Your own chip is brand-yellow (the
 * colour of your bubbles) and reopens the picker; the partner's is a plain
 * surface chip and, since it is not yours to change, not a control.
 *
 * `key={emoji}` on each chip remounts its scale-pop when the emoji changes,
 * so a 👍 becoming ❤️ pops the way a fresh reaction does. Both springs are
 * damped hard enough not to overshoot: the wrapper is `overflow-hidden` for
 * the height ease, and a bouncing chip would have its edges shaved off for
 * the frames it spends over scale 1.
 */
export const ReactionTags = memo(function ReactionTags({
  own,
  partner,
  partnerName,
  onChangeOwn,
}: {
  own: string | null;
  partner: string | null;
  partnerName: string;
  onChangeOwn: () => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="mt-1 flex items-center gap-1">
        {partner && (
          <motion.span
            key={`partner-${partner}`}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            role="img"
            aria-label={`${partnerName} reacted: ${labelFor(partner)}`}
            className="grid h-6 min-w-7 select-none place-items-center border-2 border-ink bg-surface px-1.5 text-[13px] leading-none"
          >
            {partner}
          </motion.span>
        )}
        {own && (
          <motion.button
            key={`own-${own}`}
            type="button"
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            onClick={onChangeOwn}
            // See ReactionPicker: keep this press from reading as "outside"
            // and closing the picker the click is about to toggle.
            onPointerDown={(event) => event.stopPropagation()}
            aria-label={`Your ${labelFor(own)} reaction — change it`}
            /* `transition-[translate]`, not `transition-transform`: the hover
               lift rides the `translate` property, while `transform` is
               written every frame by the entrance spring — transitioning that
               one too would have the browser easing toward each of framer's
               frames and turn a crisp pop into a smear. */
            className="grid h-6 min-w-7 select-none place-items-center border-2 border-ink bg-brand-yellow px-1.5 text-[13px] leading-none transition-[translate] hover:-translate-y-0.5 active:translate-y-0"
          >
            {own}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
});
