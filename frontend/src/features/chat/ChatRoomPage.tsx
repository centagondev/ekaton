import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ForwardedRef,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowDown,
  ChevronLeft,
  Eye,
  Flag,
  Hand,
  ImagePlus,
  Reply,
  SendHorizonal,
  SkipForward,
  VenetianMask,
  X,
} from "lucide-react";
import { chatApi, REPORT_REASONS } from "@/lib/api/chat";
import { parseApiError } from "@/lib/errors";
import { useChatSocket, type ChatMessage } from "./useChatSocket";
import { TypingIndicator, type TypingVariant } from "./TypingIndicator";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { ImageViewer } from "@/components/ui/ImageViewer";
import { Spinner } from "@/components/ui/Spinner";
import { SwipeToReply } from "@/components/ui/SwipeToReply";
import { cn, formatTime } from "@/lib/utils";
import { IMAGE_ACCEPT, MAX_IMAGE_LABEL, formatBytes, validateImageFile } from "@/lib/images";
import {
  COARSE_POINTER,
  chatSurfaceStyle,
  composerPaddingStyle,
  useChatViewport,
} from "@/lib/useChatViewport";
import type { ReportReason, RevealedUser } from "@/types/api";

const MAX_LENGTH = 500;
const GROUP_WINDOW_MS = 2 * 60 * 1000;

/** How long a jumped-to message stays highlighted. */
const JUMP_FLASH_MS = 1400;

/**
 * How long to hold the connecting cover open before accepting that the other
 * side is not coming. Long enough for a slow phone to load the room, short
 * enough that nobody sits in front of a frozen-looking screen.
 */
const PARTNER_WAIT_MS = 12_000;

/** Shown when a room is given up on because its second seat never filled. */
const PARTNER_GONE_NOTICE = "The other user is no longer available.";

/** Shown after any skip the user asked for, in-chat or from the cover. */
const SKIP_NOTICE = "Skipped. Finding someone new…";

/* --------------------------------- pieces --------------------------------- */

/**
 * The partner's avatar once identities are revealed.
 *
 * Becomes a button only when there is a photo to open — an avatar showing
 * initials has nothing to view full-screen. Before a reveal this never renders,
 * so anonymity is unchanged.
 */
function RevealedAvatar({
  user,
  className,
  onView,
}: {
  user: RevealedUser;
  className?: string;
  onView: () => void;
}) {
  if (!user.profile_photo) {
    return <Avatar name={user.full_name} src={null} className={className} />;
  }

  return (
    <button
      type="button"
      onClick={onView}
      aria-label={`View ${user.full_name}'s photo`}
      className="block transition-transform duration-150 hover:scale-105 active:scale-95"
    >
      <Avatar name={user.full_name} src={user.profile_photo} className={className} />
    </button>
  );
}

function OnlineDot({ online, className }: { online: boolean; className?: string }) {
  return (
    <span className={cn("relative flex size-2.5", className)}>
      {online && (
        <span className="absolute inline-flex size-full animate-ping bg-online opacity-60" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2.5 border border-ink",
          online ? "bg-online" : "bg-muted",
        )}
      />
    </span>
  );
}

const Bubble = memo(function Bubble({
  message,
  isFirst,
  isLast,
  canReply,
  pending,
  onReply,
  onJumpToReply,
  partnerName,
  flashed,
}: {
  message: ChatMessage;
  isFirst: boolean;
  isLast: boolean;
  canReply: boolean;
  /** True while this is an optimistic bubble still waiting on its echo. */
  pending: boolean;
  onReply: (message: ChatMessage) => void;
  onJumpToReply: (id: string) => void;
  partnerName: string;
  flashed: boolean;
}) {
  return (
    // A plain element on purpose — no entrance spring, no layout animation —
    // matching the event chat's MessageItem. The scale/rise entrance made
    // short messages balloon and float in, and with the optimistic bubble now
    // landing in the same frame as the scroll pin, any transform on arrival
    // reads as the transcript moving. The bubble is simply there, full-size,
    // first frame; the pending fade below is the only motion on send.
    <div
      id={`chat-message-${message.id}`}
      className={cn(
        "group flex scroll-mt-24 flex-col",
        message.isOwn ? "items-end" : "items-start",
        isFirst ? "mt-4 lg:mt-5" : "mt-1",
      )}
    >
      <SwipeToReply
        enabled={canReply}
        onReply={() => onReply(message)}
        className="max-w-[min(88%,26rem)] sm:max-w-[min(80%,32rem)] lg:max-w-[min(70%,42rem)]"
      >
        <div
          className={cn("flex items-end gap-2", message.isOwn ? "flex-row-reverse" : "flex-row")}
        >
          <div
            className={cn(
              "min-w-0 break-words border-2 border-ink px-4 py-2.5 text-[15px] leading-relaxed",
              "lg:px-5 lg:py-3 lg:text-base",
              "transition-[opacity,box-shadow] duration-200 ease-out",
              message.isOwn ? "bg-brand-yellow" : "bg-surface",
              isLast && "shadow-brutal-sm",
              pending && "opacity-60",
              flashed && "ring-4 ring-brand-lime",
            )}
          >
            {message.replyTo && (
              <button
                type="button"
                onClick={() => onJumpToReply(message.replyTo!.id)}
                aria-label={`Go to the message from ${
                  message.replyTo.is_own ? "you" : partnerName
                }`}
                className={cn(
                  "mb-2 flex w-full flex-col items-start gap-0 text-left",
                  "border-l-[3px] py-1 pl-2 pr-2",
                  "transition-colors duration-200",
                  message.isOwn
                    ? "border-ink/70 bg-ink/[0.06] hover:bg-ink/[0.11]"
                    : "border-ink/50 bg-ink/[0.04] hover:bg-ink/[0.08]",
                )}
              >
                <span className="font-mono text-[10px] font-bold uppercase leading-[1.5] tracking-[0.12em]">
                  {message.replyTo.is_own ? "You" : partnerName}
                </span>
                <span className="line-clamp-1 w-full text-[12.5px] leading-[1.5] opacity-60">
                  {message.replyTo.message}
                </span>
              </button>
            )}
            {message.text}
          </div>

          {/* Pointer users get a button; touch users swipe. */}
          {canReply && (
            <button
              type="button"
              onClick={() => onReply(message)}
              aria-label={`Reply to ${message.isOwn ? "your message" : `${partnerName}'s message`}`}
              className="mb-1 hidden shrink-0 border-2 border-ink bg-surface p-2 opacity-0 transition-opacity hover:bg-brand-lime focus-visible:opacity-100 group-hover:opacity-100 sm:block"
            >
              <Reply className="size-3.5" />
            </button>
          )}
        </div>
      </SwipeToReply>

      {isLast && (
        <p className="mt-1.5 px-1 font-mono text-[9px] uppercase tracking-wider text-muted">
          {formatTime(message.createdAt)}
        </p>
      )}
    </div>
  );
});

const STARTERS = ["Hey there 👋", "Any exams coming up?", "Settle a debate for me…"] as const;

function EmptyConversation({ onPick }: { onPick: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="flex flex-col items-center gap-4 py-14 text-center lg:gap-5 lg:py-24"
    >
      <motion.div
        animate={{ rotate: [0, 12, -8, 0] }}
        transition={{ duration: 1.6, delay: 0.5 }}
        className="border-2 border-ink bg-brand-yellow p-3.5 shadow-brutal-sm lg:p-4"
      >
        <Hand className="size-6 lg:size-7" />
      </motion.div>
      <p className="max-w-xs text-sm text-muted lg:max-w-sm lg:text-base">
        You're matched. Neither of you knows who the other is — break the ice.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            onClick={() => onPick(starter)}
            className="border-2 border-ink bg-surface px-3 py-1.5 text-xs font-bold transition-all hover:-translate-y-0.5 hover:shadow-brutal-sm active:translate-y-0 active:shadow-none lg:px-4 lg:py-2 lg:text-sm"
          >
            {starter}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* -------------------------------- composer -------------------------------- */

/** What the page can ask of the composer without owning its draft. */
interface ComposerHandle {
  /** Put the cursor back in the input. */
  focus: () => void;
  /** Replace the draft (conversation starters) and focus the input. */
  setDraft: (text: string) => void;
}

/**
 * The message input row, extracted and memoized so a keystroke re-renders
 * this subtree alone. When the draft lived in page state, every character
 * re-ran the header, the desktop sidebar, the overlay AnimatePresence trees
 * and the prop diff of every memoized bubble — none of which can change while
 * typing. Every function prop here is useCallback-stable at the call site,
 * so the memo actually holds between keystrokes.
 */
const Composer = memo(
  forwardRef(function Composer(
    {
      online,
      replyTo,
      partnerName,
      onSend,
      onTyping,
      onCancelReply,
      onJumpToQuote,
      onSkip,
    }: {
      online: boolean;
      replyTo: ChatMessage | null;
      partnerName: string;
      onSend: (text: string) => void;
      onTyping: (typing: boolean) => void;
      onCancelReply: () => void;
      onJumpToQuote: (id: string) => void;
      onSkip: () => void;
    },
    ref: ForwardedRef<ComposerHandle>,
  ) {
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const typingSentRef = useRef(false);
    const typingStopRef = useRef<number | undefined>(undefined);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        setDraft: (text: string) => {
          setDraft(text.slice(0, MAX_LENGTH));
          inputRef.current?.focus();
        },
      }),
      [],
    );

    // The typing debounce outlives the component if you navigate away mid-word.
    useEffect(() => () => window.clearTimeout(typingStopRef.current), []);

    const handleDraft = (value: string) => {
      setDraft(value.slice(0, MAX_LENGTH));
      if (!typingSentRef.current) {
        onTyping(true);
        typingSentRef.current = true;
      }
      window.clearTimeout(typingStopRef.current);
      typingStopRef.current = window.setTimeout(() => {
        onTyping(false);
        typingSentRef.current = false;
      }, 1500);
    };

    const submit = (event?: { preventDefault: () => void }) => {
      event?.preventDefault();
      const text = draft.trim();
      if (!text || !online) return;
      onSend(text);
      setDraft("");
      inputRef.current?.focus();
      window.clearTimeout(typingStopRef.current);
      if (typingSentRef.current) {
        onTyping(false);
        typingSentRef.current = false;
      }
    };

    return (
      <div className="shrink-0 border-t-2 border-ink bg-surface" style={composerPaddingStyle}>
        <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-6 lg:px-10 lg:py-4 xl:max-w-5xl">
          <AnimatePresence initial={false}>
            {replyTo && (
              <motion.div
                key="reply-strip"
                initial={{ height: 0, opacity: 0, y: -4 }}
                animate={{ height: "auto", opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -4 }}
                // A short tween rather than a spring: the strip should
                // settle, not bounce, next to an input the user is typing in.
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mb-2 flex items-stretch border-2 border-ink bg-raised">
                  {/* The full-height accent bar is the cue that reads first
                      — before any text — that a reply is being composed. */}
                  <span aria-hidden className="w-1 shrink-0 bg-brand-yellow" />

                  <button
                    type="button"
                    onClick={() => onJumpToQuote(replyTo.id)}
                    aria-label={`Go to the message from ${
                      replyTo.isOwn ? "you" : partnerName
                    }`}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left transition-colors duration-200 hover:bg-ink/5"
                  >
                    <Reply className="size-3.5 shrink-0 opacity-70" />
                    {/* Stacked, matching the in-bubble quote, so the two
                        reply surfaces read as the same idea. */}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-mono text-[10px] font-bold uppercase leading-[1.5] tracking-[0.12em]">
                        Replying to {replyTo.isOwn ? "You" : partnerName}
                      </span>
                      <span className="min-w-0 truncate text-[12.5px] leading-[1.5] text-muted">
                        {replyTo.text}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onCancelReply}
                    aria-label="Cancel reply"
                    className="shrink-0 border-l-2 border-ink px-3 transition-colors hover:bg-danger/10"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submit} className="flex items-end gap-2 lg:gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onSkip}
              disabled={!online}
              aria-label="Skip to the next chat"
              className="h-[3.25rem] max-sm:px-3 lg:hidden"
            >
              <SkipForward className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Skip</span>
            </Button>

            <div
              className={cn(
                "relative flex flex-1 items-center border-2 border-ink bg-canvas transition-shadow duration-150",
                "focus-within:shadow-brutal-sm",
                !online && "opacity-50",
              )}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => handleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) submit(event);
                  // Escape drops the reply before it drops focus.
                  if (event.key === "Escape" && replyTo) {
                    event.preventDefault();
                    onCancelReply();
                  }
                }}
                placeholder={online ? "Type a message…" : "Chat is not active"}
                disabled={!online}
                aria-label="Message"
                autoFocus={!COARSE_POINTER}
                autoComplete="off"
                enterKeyHint="send"
                /* text-base is load-bearing: iOS Safari zooms the page in
                   on focus for any input under 16px, and the zoom is what
                   makes the composer jump around mid-conversation. */
                className="w-full bg-transparent px-4 py-3 text-base outline-none placeholder:text-muted/70 lg:px-5 lg:py-3.5"
              />
              <AnimatePresence>
                {draft.length > MAX_LENGTH - 100 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "pointer-events-none pr-3 font-mono text-[10px]",
                      draft.length >= MAX_LENGTH ? "font-bold text-danger" : "text-muted",
                    )}
                  >
                    {MAX_LENGTH - draft.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* Fixed height matches the input container so the button stays
                aligned to the input's box instead of its own text metrics. */}
            <motion.div whileTap={{ scale: 0.92 }} className="shrink-0">
              <Button
                type="submit"
                disabled={!draft.trim() || !online}
                aria-label="Send message"
                className="h-[3.25rem] px-4 lg:px-6"
              >
                <SendHorizonal className="size-4" />
                <span className="hidden sm:inline">Send</span>
              </Button>
            </motion.div>
          </form>
        </div>
      </div>
    );
  }),
);

/* --------------------------- match / connect ------------------------------ */

/**
 * The three real states of getting two strangers into one room. Every one of
 * them is read off the socket — nothing here runs on a timer, so the overlay
 * can never claim progress that has not actually happened.
 */
type ConnectPhase = "connecting" | "linked" | "connected";

const PHASE_COPY: Record<ConnectPhase, string> = {
  connecting: "Opening secure line",
  linked: "Waiting for them to join",
  connected: "Connected",
};

/** Filled segments per phase — a segmented bar reads as brutalist, not glossy. */
const PHASE_STEP: Record<ConnectPhase, number> = {
  connecting: 1,
  linked: 2,
  connected: 3,
};

/**
 * Seconds the cover's Skip stays locked after a match is found, so a room
 * cannot be thrown away by reflex before the other side has had a chance to
 * arrive. Purely presentational — nothing in matchmaking knows about it.
 */
const SKIP_UNLOCK_S = 5;

/** One anonymous participant. Slides in from its side, then breathes inward. */
function PeerTile({ side, label, live }: { side: -1 | 1; label: string; live: boolean }) {
  return (
    <motion.div
      className="flex shrink-0 flex-col items-center gap-1.5"
      initial={{ x: side * 56, opacity: 0, rotate: side * 8 }}
      animate={{ x: 0, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <motion.div
        className={cn(
          "flex size-14 items-center justify-center border-2 border-ink shadow-brutal-sm sm:size-16",
          live ? "bg-brand-lime" : "bg-brand-yellow",
        )}
        // Leaning toward each other while they wait, snapping level on connect.
        animate={live ? { x: side * -4, rotate: 0 } : { x: [0, side * -3, 0] }}
        transition={
          live
            ? { type: "spring", stiffness: 400, damping: 18 }
            : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <VenetianMask className="size-7 sm:size-8" />
      </motion.div>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
    </motion.div>
  );
}

/**
 * Match-found / connecting cover.
 *
 * Shown from the moment the room mounts until the partner's first frame proves
 * they are in the room, and gone the instant it lands — the "connected" state
 * plays entirely inside the exit transition, so nothing is held back to let an
 * animation finish.
 */
const ConnectingOverlay = memo(function ConnectingOverlay({
  phase,
  onSkip,
}: {
  phase: ConnectPhase;
  onSkip: () => void;
}) {
  const live = phase === "connected";
  const step = PHASE_STEP[phase];

  /**
   * Chained one-second timeouts rather than an interval: exactly one timer is
   * ever alive, each is cleared by the effect's own cleanup (unmount, or the
   * match completing, included), and the state updater stays pure — which an
   * interval clearing itself from inside the tick cannot offer. At zero the
   * effect simply stops re-arming; nothing to clean, nothing leaks.
   */
  const [skipLockedFor, setSkipLockedFor] = useState(SKIP_UNLOCK_S);
  useEffect(() => {
    if (live || skipLockedFor === 0) return;
    const timer = window.setTimeout(
      () => setSkipLockedFor((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [live, skipLockedFor]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      /* `m-auto` on the card rather than `items-center` here, plus a scroll:
         the card centres exactly as before when there is room, but on a
         viewport too short for it — a phone held sideways, mostly — it
         scrolls instead of being clipped. Centring alignment clips the
         overflowing top edge and leaves it unreachable, which would hide
         the Skip button that is the whole point of this screen. */
      className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-canvas p-4"
      role="status"
      aria-live="polite"
      aria-label="Match found, connecting you both"
    >
      <motion.div
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 1.04 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="m-auto flex w-full max-w-sm flex-col items-center gap-5 border-2 border-ink bg-surface px-5 py-7 text-center shadow-brutal-lg sm:px-8 sm:py-8"
      >
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
          className="border-2 border-ink bg-brand-lime px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.25em]"
        >
          Match found
        </motion.span>

        {/* ---- the two of you, and the line being drawn between you ---- */}
        {/* Centred with a bounded rail rather than justify-between: letting the
            rail take all the width pushed the two of you to opposite edges of
            the card, which read as a gap to be filled instead of a link. */}
        <div className="flex w-full items-center justify-center gap-3 pt-1 sm:gap-4">
          <PeerTile side={-1} label="You" live={live} />

          <div className="relative mb-5 h-8 w-24 shrink-0 sm:w-32">
            {/* Rail. Grows out from the centre on mount so the link reads as
                being established rather than having always been there. */}
            <motion.span
              className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-ink"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />

            {/* Packets crossing the link, alternating direction so it reads as
                a two-way connection rather than a one-way loader. */}
            {!live &&
              [0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute top-1/2 size-1.5 -translate-y-1/2 bg-ink"
                  animate={{
                    left: i % 2 === 0 ? ["0%", "100%"] : ["100%", "0%"],
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.45,
                    ease: "linear",
                  }}
                />
              ))}

            {/* Centre node: a diamond, pulsing while it waits, locking to lime
                the moment both sides are proven present. */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {!live && (
                <motion.span
                  className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-ink"
                  animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <motion.span
                className={cn(
                  "block size-4 rotate-45 border-2 border-ink",
                  live ? "bg-brand-lime" : "bg-brand-yellow",
                )}
                animate={live ? { scale: 1.35 } : { scale: [1, 1.15, 1] }}
                transition={
                  live
                    ? { type: "spring", stiffness: 400, damping: 12 }
                    : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                }
              />
            </div>
          </div>

          <PeerTile side={1} label="Them" live={live} />
        </div>

        <div>
          <h2 className="text-xl font-black uppercase leading-tight sm:text-2xl">
            Connecting you both
          </h2>
          <p className="mt-1.5 text-sm text-muted">Opening the chat for both of you at once…</p>
        </div>

        {/* ---- honest, stage-based progress ---- */}
        <div className="w-full">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((segment) => (
              <div
                key={segment}
                className="h-2 flex-1 overflow-hidden border-2 border-ink bg-canvas"
              >
                <motion.span
                  className={cn("block h-full", live ? "bg-brand-lime" : "bg-brand-yellow")}
                  initial={false}
                  animate={{ scaleX: segment <= step ? 1 : 0 }}
                  style={{ originX: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted">
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {PHASE_COPY[phase]}
            </motion.span>
            <span className="tabular-nums">{`0${step}/03`}</span>
          </div>
        </div>

        {/* The manual way out of a wait that never resolves — the other side
            may have cancelled, gone offline, or closed the tab. Behaves
            exactly like Skip inside the chat; a match that has already landed
            is refused at the handler, which reads presence live rather than
            through this card's props. */}
        {!live && (
          <Button
            variant="secondary"
            onClick={onSkip}
            disabled={skipLockedFor > 0}
            className="w-full"
          >
            <SkipForward className="size-4" />
            Skip to next
            {/* aria-hidden, and not merely decorative: this card is a polite
                live region, so a counter ticking inside it would be read out
                once a second. The button keeps its stable name, and the lock
                itself is already conveyed by `disabled`.
                tabular-nums holds every digit to one width, so the label
                cannot wobble as the count falls. */}
            {skipLockedFor > 0 && (
              <span aria-hidden className="tabular-nums">
                ({skipLockedFor}s)
              </span>
            )}
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
});

/* ---------------------------------- page ---------------------------------- */

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [revealClicking, setRevealClicking] = useState(false);
  const [respondLoading, setRespondLoading] = useState<"accept" | "reject" | null>(null);
  /**
   * Optimistic own messages, shown the instant Send is tapped and retired
   * when the server echoes them back — the technique that makes the event
   * chat feel instant. Purely presentational: the socket protocol is
   * untouched, this is just what renders during the round trip.
   */
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const pendingSeq = useRef(0);
  // Own echoes already matched to a draft, so a re-render cannot retire the
  // same draft twice.
  const reconciledIds = useRef<Set<string>>(new Set());

  /**
   * A send the server refuses reports itself here and nowhere else — there is
   * no echo for a message it never stored. The rate limiter (one message per
   * second, per person) is the one that fires in ordinary use.
   *
   * Retiring the draft is what keeps drafts and echoes in step. They are
   * paired off in arrival order below, so a draft left behind by a refused
   * send shifts every later pairing by one: from then on each echo retires
   * the *previous* message's draft and the newest one stays on screen beside
   * its own confirmed copy — the duplicated message, for the rest of the room.
   *
   * The server answers frames in the order it received them, so a refusal
   * belongs to the oldest unconfirmed draft: the same end the echo handler
   * retires from.
   */
  const handleServerError = useCallback((message: string) => {
    toast.error(message);
    setRevealClicking(false);
    setRespondLoading(null);
    setPendingMessages((prev) => (prev.length === 0 ? prev : prev.slice(1)));
  }, []);

  const {
    status,
    endInfo,
    messages,
    partnerTyping,
    partnerPresent,
    reveal,
    lastError,
    clearError,
    dismissReveal,
    sendMessage,
    sendTyping,
    requestReveal,
    respondReveal,
    skipChat,
  } = useChatSocket(roomId, handleServerError);

  const [reportOpen, setReportOpen] = useState(false);
  /**
   * Stable identity on purpose: Modal keys its focus/scroll-lock effect on
   * `onClose`, so a fresh closure every render would yank focus back to the
   * trigger each time the report form re-renders.
   */
  const closeReport = useCallback(() => setReportOpen(false), []);
  /** Full-screen view of the revealed partner's photo. */
  const [photoOpen, setPhotoOpen] = useState(false);
  const openPhoto = useCallback(() => setPhotoOpen(true), []);
  const closePhoto = useCallback(() => setPhotoOpen(false), []);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [unseen, setUnseen] = useState(0);
  /** The message being replied to, or null for a plain send. */
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  /** Briefly highlights a message after jumping to it from a quote. */
  const [flashId, setFlashId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const nearBottomRef = useRef(true);
  const skipRequestedRef = useRef(false);
  // "End chat" means stop, not "find me another". The server's chat_ended
  // broadcast arrives before the REST call resolves, so without this flag the
  // auto-return would fire first and drop the user straight back into a search
  // they just opted out of.
  const endRequestedRef = useRef(false);

  const online = status === "connected";
  const revealPending = reveal.phase === "outgoing" || revealClicking;
  const partnerName = reveal.user?.full_name ?? "Stranger";
  /**
   * `reveal.user` only exists after reveal_success, so this is "anonymous"
   * for the entire pre-reveal life of the room — the gendered character can
   * never render early. Older servers that omit gender degrade to anonymous.
   */
  const typingVariant: TypingVariant = reveal.user?.gender ?? "anonymous";

  /**
   * Both clients hold the chat closed until each has proof the other is in the
   * room, so the conversation opens for both at the same instant instead of
   * whoever polled first entering early. `stranded` is the safety valve for
   * the case the barrier cannot survive on its own: a partner who was matched
   * but never arrives, because they cancelled their search in the same instant
   * the queue handed them over.
   *
   * The timer keys on `partnerPresent` ALONE, deliberately. Keying it on the
   * socket status as well restarted the countdown when the socket opened, so
   * the real budget was the wait plus a fresh 12s rather than 12s in total.
   */
  const [stranded, setStranded] = useState(false);
  useEffect(() => {
    if (partnerPresent) return;
    const timer = window.setTimeout(() => setStranded(true), PARTNER_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [partnerPresent]);

  /**
   * Cover the socket handshake too, not just the wait for the partner.
   *
   * This used to be `online && !partnerPresent`, so between mount and the
   * socket opening the overlay was absent and the full chat rendered behind it
   * — an empty thread, a live composer and a "Connecting…" header — before the
   * overlay slammed over the top of it a moment later. That flash of a chat the
   * user could not yet use was the flicker; the connect phase is part of the
   * same wait and belongs under the same cover.
   */
  const connecting = status === "connecting";
  /**
   * No `stranded` term here on purpose. Running out of patience used to drop
   * the cover and reveal the room behind it — an empty transcript, a live
   * composer and a header reading "Online", with nothing to explain any of it.
   * That was the "app is frozen" report. Being stranded now ends the room
   * instead (see below), so the cover simply stays up until we leave.
   */
  const waitingForPartner = connecting || (online && !partnerPresent);
  const connectPhase: ConnectPhase = partnerPresent
    ? "connected"
    : online
      ? "linked"
      : "connecting";

  /* ----------------------------- scroll behaviour ---------------------------- */

  /**
   * Scroll the transcript itself to its true bottom rather than
   * `scrollIntoView` on a sentinel: aligning the sentinel's border box left
   * the container's own bottom padding scrolled out of view, so the typing
   * indicator (and the last bubble) sat flush against the overflow clip edge
   * — its entrance/exit transforms and shadow were visibly cut off once the
   * thread was long enough to scroll.
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  /**
   * Jump to a quoted message and flash it.
   *
   * There is no message history here — everything the socket has delivered
   * this session is already rendered — so a missing node means the original
   * is genuinely gone, not just unloaded.
   */
  const jumpToMessage = useCallback((messageId: string) => {
    const node = document.getElementById(`chat-message-${messageId}`);
    if (!node) {
      toast.info("That message is no longer available.");
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(messageId);
    window.setTimeout(() => setFlashId(null), JUMP_FLASH_MS);
  }, []);

  /** Start replying and put the cursor back in the composer. */
  const startReply = useCallback((message: ChatMessage) => {
    setReplyTo(message);
    composerRef.current?.focus();
  }, []);

  /** Replying is only possible where sending is. */
  const canReply = online;

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 130;
    nearBottomRef.current = nearBottom;
    if (nearBottom) setUnseen(0);
  }, []);

  /**
   * The transcript as rendered: confirmed messages plus the optimistic tail.
   * A plain concat, never a re-sort — a pending bubble must stay at the very
   * bottom, and sorting by a client clock against server clocks could insert
   * it mid-list, which would shift layout.
   */
  const allMessages = useMemo(
    () => (pendingMessages.length === 0 ? messages : [...messages, ...pendingMessages]),
    [messages, pendingMessages],
  );

  // React only when the *newest* message changes, keyed by its id — the
  // echo replacing a draft re-fires this with a new tail id, while renders
  // that leave the tail alone (typing, presence, reveal) fall straight
  // through. A layout effect on purpose: useEffect runs after paint, so the
  // browser showed one frame of the taller transcript at the old scroll
  // offset before the pin landed — the subtle end-of-send jump. Correcting
  // the scroll before paint means no wrong frame ever reaches the screen.
  const lastMessageIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const last = allMessages[allMessages.length - 1];
    if (!last || last.id === lastMessageIdRef.current) return;
    lastMessageIdRef.current = last.id;

    if (last.id.startsWith("pending-")) {
      // Only the act of sending claims the bottom. The optimistic bubble is
      // already laid out when this runs, so an "auto" scroll lands in the
      // same frame and nothing visibly travels.
      nearBottomRef.current = true;
      scrollToBottom("auto");
    } else if (last.isOwn) {
      // The server echo replacing a draft. Re-pin only if still at the
      // bottom — someone who scrolled up between send and echo must not be
      // yanked back down — and never count an own message as unseen.
      if (nearBottomRef.current) scrollToBottom("auto");
    } else if (nearBottomRef.current) {
      scrollToBottom();
    } else {
      setUnseen((count) => count + 1);
    }
  }, [allMessages, scrollToBottom]);

  // Drop optimistic entries once the server echoes them back.
  //
  // Matched by arrival order, not by text — the server may alter a message on
  // its way through, so the copy that comes back cannot be recognised by its
  // content. That pairing is only sound while every draft has exactly one
  // outcome coming for it, which is why the two ways a send can end without
  // an echo are both closed: a refused send retires its draft in
  // `handleServerError`, and a frame that never left the socket never gets a
  // draft at all (see `handleSend`). Without those, one unanswered draft
  // offsets the queue permanently and the newest message renders twice.
  //
  // A layout effect, not useEffect: a passive effect runs after paint, so
  // every send would show one frame with the echo AND the draft both in the
  // list — the message doubled, then snapped back a frame later. Retiring the
  // draft in the layout phase lands echo-in and draft-out in one paint.
  useLayoutEffect(() => {
    const fresh = messages.filter(
      (message) => message.isOwn && !reconciledIds.current.has(message.id),
    );
    if (fresh.length === 0) return;
    for (const message of fresh) reconciledIds.current.add(message.id);
    setPendingMessages((prev) => (prev.length === 0 ? prev : prev.slice(fresh.length)));
  }, [messages]);

  // A dead socket can never echo, so nothing pending can ever confirm — and
  // every way a room ends navigates away in a moment anyway. Clearing keeps a
  // half-opacity ghost from being the last thing on screen.
  useEffect(() => {
    if (!online) setPendingMessages((prev) => (prev.length === 0 ? prev : []));
  }, [online]);

  // The indicator eases its height in over ~160ms, so a single scroll call
  // at mount aims at a bottom that is still moving. Pinning each frame while
  // it grows keeps the newest message and the indicator both in view, with
  // the motion supplied entirely by the height easing itself.
  useEffect(() => {
    if (!partnerTyping || !nearBottomRef.current) return;
    let frame = 0;
    const started = performance.now();
    const track = (now: number) => {
      scrollToBottom("auto");
      if (now - started < 260) frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
  }, [partnerTyping, scrollToBottom]);

  /**
   * Keep the surface glued to the visible viewport, and re-pin the transcript
   * as the keyboard slides in so the newest message stays in view instead of
   * being covered. "auto" rather than "smooth": the keyboard is already
   * animating, and a second easing on top of it reads as lag.
   */
  useChatViewport(
    useCallback(() => {
      if (nearBottomRef.current) scrollToBottom("auto");
    }, [scrollToBottom]),
  );

  /* ------------------------------- side effects ------------------------------ */

  useEffect(() => {
    if (lastError) {
      toast.error(lastError);
      clearError();
      setRevealClicking(false);
      setRespondLoading(null);
    }
  }, [lastError, clearError]);

  useEffect(() => {
    if (reveal.phase !== "idle") setRevealClicking(false);
    if (reveal.phase === "accepted" || reveal.phase === "rejected") setRespondLoading(null);
  }, [reveal.phase]);

  useEffect(() => {
    if (reveal.phase !== "rejected") return;
    const timer = window.setTimeout(dismissReveal, 4000);
    return () => window.clearTimeout(timer);
  }, [reveal.phase, dismissReveal]);

  /**
   * Every way a room can end — they left, they skipped, they closed the tab,
   * the server timed it out, or I skipped — lands the user straight back in
   * matchmaking. There is deliberately no delay: sitting in a dead room
   * reading a notice is the worst possible use of the seconds it takes to find
   * the next person, so the reason travels to the home page as a toast and the
   * search starts immediately.
   *
   * `status === "error"` is excluded — that means we never got in, so it keeps
   * its manual card instead of silently bouncing the user.
   */
  const exitNotice =
    status !== "ended" || endRequestedRef.current
      ? null
      : endInfo?.kind === "timeout"
        ? "Chat ended — it went quiet for too long."
        : endInfo?.kind === "skipped"
          ? skipRequestedRef.current
            ? SKIP_NOTICE
            : "Stranger skipped to a new chat."
          : // "Disconnected" would be a lie about someone who was never here.
            // A room that ends before its second seat is ever proven filled is
            // a partner who walked away between the match and the room.
            partnerPresent
            ? "Stranger disconnected."
            : PARTNER_GONE_NOTICE;

  useEffect(() => {
    if (!exitNotice) return;
    // An open report form outlives the room: navigating now would unmount the
    // modal and throw away everything the reporter has typed, and the report
    // endpoint accepts ended rooms — so the exit waits. Closing or submitting
    // the report flips `reportOpen` and this effect resumes the normal exit.
    if (reportOpen) return;
    // replace: the dead room must not sit in history behind /home.
    navigate("/home", { replace: true, state: { autostart: true, notice: exitNotice } });
  }, [exitNotice, reportOpen, navigate]);

  /**
   * Give up on a room whose second participant never arrived.
   *
   * The room is ended through the REST call rather than by letting the socket
   * close on unmount do it. Both end the room, but only this one is finished
   * before we navigate — and /home starts searching the moment it mounts,
   * while `start/` hands back any room that is still ACTIVE. Racing the
   * teardown is what produced the search → connecting → chat → search loop:
   * the very first poll of the new search found this room still open and
   * marched straight back into it.
   *
   * `endRequestedRef` claims the exit so the generic notice above cannot fire
   * a second, competing navigation once our own end broadcast lands.
   */
  const strandedHandled = useRef(false);
  useEffect(() => {
    if (!stranded || strandedHandled.current || endRequestedRef.current) return;
    if (status === "ended" || status === "error") return;

    strandedHandled.current = true;
    endRequestedRef.current = true;

    void (async () => {
      try {
        if (roomId) await chatApi.end(roomId);
      } catch {
        // Already ended, or never really there — leaving is right either way.
      }
      navigate("/home", {
        replace: true,
        state: {
          autostart: true,
          // The same exit serves two stories: the timer giving up on a
          // partner who never came, and the user skipping from the cover.
          // Each gets its own words.
          notice: skipRequestedRef.current ? SKIP_NOTICE : PARTNER_GONE_NOTICE,
        },
      });
    })();
  }, [stranded, status, roomId, navigate]);

  /**
   * Manual exit from the connecting cover — pure reuse, no cleanup of its
   * own. With the socket open this is exactly the in-chat skip (same frame,
   * same server-side teardown, same exit notice). Before the socket opens a
   * skip frame cannot be delivered, so it declares the room stranded instead,
   * which runs the existing give-up path: end the room over REST — so no
   * orphaned room can be handed back to the next search — then return to
   * matchmaking. Both paths are already guarded against running twice.
   */
  const skipFromConnecting = useCallback(() => {
    if (skipRequestedRef.current || endRequestedRef.current) return;
    // A match that has already landed is never skippable from here. The cover
    // takes ~200ms to animate away, and AnimatePresence replays an exiting
    // child from the element it last rendered — i.e. with the props from
    // before the partner arrived — so the overlay's own `live` check cannot
    // hide the button during that window. Re-reading presence at the moment
    // of the tap is the only reading that cannot be stale.
    if (partnerPresent) return;
    skipRequestedRef.current = true;
    if (online) skipChat();
    else setStranded(true);
  }, [online, partnerPresent, skipChat]);

  useEffect(() => {
    if (!online) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [online]);

  /* --------------------------------- actions -------------------------------- */

  /**
   * Read through a ref so `handleSend` keeps one identity for the life of the
   * room: a fresh closure per replyTo change would re-render the memoized
   * composer on every reply pick for no visual gain.
   */
  const replyToRef = useRef(replyTo);
  replyToRef.current = replyTo;

  const handleSend = useCallback(
    (text: string) => {
      const target = replyToRef.current;
      // A frame that never left the socket can be neither echoed nor refused,
      // so it can never retire its own draft — drawing one would strand it on
      // screen and put every later echo one draft out of step.
      if (!sendMessage(text, target?.id ?? null)) return;

      // The optimistic bubble, on screen in the same frame as the send. The
      // quote is built here so it is on the bubble from the first paint;
      // waiting for the echo would pop it in a moment later.
      setPendingMessages((prev) => [
        ...prev,
        {
          id: `pending-${pendingSeq.current++}`,
          text,
          isOwn: true,
          createdAt: new Date().toISOString(),
          replyTo: target
            ? { id: target.id, is_own: target.isOwn, message: target.text }
            : null,
        },
      ]);
      setReplyTo(null);
    },
    [sendMessage],
  );

  const cancelReply = useCallback(() => setReplyTo(null), []);
  const openSkipConfirm = useCallback(() => setConfirmSkip(true), []);

  const handleReveal = () => {
    if (revealPending) return;
    setRevealClicking(true); // instant feedback before the server acks
    requestReveal();
  };

  const handleRespond = (accepted: boolean) => {
    setRespondLoading(accepted ? "accept" : "reject");
    respondReveal(accepted);
  };

  const endChat = async () => {
    endRequestedRef.current = true;
    setEnding(true);
    try {
      if (roomId) await chatApi.end(roomId);
    } catch {
      // Room may already be gone; the socket state covers the UI.
    }
    navigate("/home");
  };

  /* ------------------------------- grouping -------------------------------- */

  const grouped = useMemo(() => {
    const timeOf = (message: ChatMessage) => new Date(message.createdAt).getTime();
    return allMessages.map((message, index) => {
      const previous = allMessages[index - 1];
      const next = allMessages[index + 1];
      return {
        message,
        isFirst:
          !previous ||
          previous.isOwn !== message.isOwn ||
          timeOf(message) - timeOf(previous) > GROUP_WINDOW_MS,
        isLast:
          !next ||
          next.isOwn !== message.isOwn ||
          timeOf(next) - timeOf(message) > GROUP_WINDOW_MS,
        pending: message.id.startsWith("pending-"),
      };
    });
  }, [allMessages]);

  const statusText = !roomId
    ? "Invalid room"
    : status === "connecting"
      ? "Connecting…"
      : online
        ? partnerTyping
          ? "Typing…"
          : "Online"
        : "Disconnected";

  return (
    <div
      className="fixed inset-x-0 flex flex-col overflow-hidden bg-canvas"
      style={chatSurfaceStyle}
    >
      {/* -------------------------------- header -------------------------------- */}
      <header
        className="shrink-0 border-b-2 border-ink bg-surface"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-4 lg:h-[4.5rem] lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => (online ? setConfirmEnd(true) : navigate("/home"))}
              aria-label="Leave chat"
              className="-ml-1 p-2 transition-all hover:-translate-x-0.5 hover:bg-raised"
            >
              <ChevronLeft className="size-5" />
            </button>

            <div className="relative shrink-0">
              {reveal.user ? (
                <RevealedAvatar user={reveal.user} onView={openPhoto} />
              ) : (
                <motion.div
                  initial={false}
                  animate={revealPending ? { scale: [1, 1.06, 1] } : {}}
                  transition={{ duration: 1.4, repeat: revealPending ? Infinity : 0 }}
                  className="flex size-10 items-center justify-center border-2 border-ink bg-brand-lavender"
                >
                  <VenetianMask className="size-5" />
                </motion.div>
              )}
              <OnlineDot online={online} className="absolute -bottom-0.5 -right-0.5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-black leading-tight sm:text-lg">
                  {partnerName}
                </p>
                <AnimatePresence>
                  {revealPending && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-block shrink-0 animate-pulse border border-ink bg-brand-yellow px-1.5 py-px font-mono text-[9px] font-black uppercase tracking-[0.15em]"
                    >
                      Reveal pending
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {/* Batch joins the line the header already had rather than
                  taking one of its own, so the header keeps its two rows and
                  its height. `reveal.user` exists only after reveal_success,
                  so before a reveal this renders exactly as it always did:
                  the status on its own.

                  Bare, where the sidebar chip and the reveal card both say
                  "Batch X". They have a whole line to spend; this one carries
                  the connection state too, and the label is what pushed the
                  pair past the width of a 320px phone — measured, with the
                  Reveal button already gone from the header by this point. */}
              <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                {reveal.user?.batch && (
                  <>
                    {/* min-w-0 so an unusually long batch truncates instead of
                        pushing the connection state out of the header. */}
                    <span className="min-w-0 truncate">{reveal.user.batch}</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                {/* The live region stays around the status alone — putting the
                    batch inside it would re-announce the name every time the
                    partner started or stopped typing. */}
                <span className="shrink-0" aria-live="polite">
                  {statusText}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            {online && reveal.phase !== "accepted" && (
              <Button
                size="sm"
                onClick={handleReveal}
                loading={revealClicking}
                disabled={revealPending}
                /* Below `sm` the label span is display:none and leaves the
                   accessibility tree, so without this the button is a nameless
                   icon to assistive tech on exactly the screens it matters. */
                aria-label={
                  reveal.phase === "outgoing" ? "Reveal request pending" : "Request identity reveal"
                }
              >
                <Eye className="size-4" />
                <span className="hidden sm:inline">
                  {reveal.phase === "outgoing" ? "Pending…" : "Reveal"}
                </span>
              </Button>
            )}
            <button
              onClick={() => setReportOpen(true)}
              aria-label="Report this chat"
              className="border-2 border-ink p-2 transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-raised"
            >
              <Flag className="size-4" />
            </button>
          </div>

          <p className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted lg:block">
            Anonymous room · not stored
          </p>
        </div>

        {/* --------------------------- reveal strips --------------------------- */}
        <AnimatePresence>
          {reveal.phase === "incoming" && (
            <motion.div
              key="incoming"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
              className="overflow-hidden border-t-2 border-ink bg-brand-lavender"
            >
              {/* Stacked on phones, one row from `sm` up. The old flex-wrap
                  version wrapped the buttons onto a ragged second row hugging
                  the left edge; stacking on purpose gives the pair the full
                  width, equal halves, and consistent spacing at 320px. */}
              <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
                <div className="flex min-w-0 items-center gap-2.5">
                  <motion.span
                    animate={{ rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1 }}
                    className="shrink-0 border-2 border-ink bg-surface p-1.5"
                  >
                    <Eye className="size-4" />
                  </motion.span>
                  <p className="text-sm font-bold">They want to reveal identities. You in?</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="lime"
                    loading={respondLoading === "accept"}
                    disabled={respondLoading !== null}
                    onClick={() => handleRespond(true)}
                    className="flex-1 sm:flex-none"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={respondLoading === "reject"}
                    disabled={respondLoading !== null}
                    onClick={() => handleRespond(false)}
                    className="flex-1 sm:flex-none"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
          {reveal.phase === "rejected" && (
            <motion.div
              key="rejected"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t-2 border-ink bg-raised"
            >
              <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-4 py-2 lg:px-8">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
                  Reveal declined — you're both still anonymous.
                </p>
                <button
                  onClick={dismissReveal}
                  aria-label="Dismiss"
                  className="-mr-2 p-2 text-muted hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* -------------------------------- body --------------------------------- */}
      <div className="mx-auto flex w-full max-w-[1800px] min-h-0 flex-1 overflow-hidden">
        {/* desktop sidebar */}
        <aside
          className="hidden w-80 shrink-0 flex-col gap-5 overflow-y-auto border-r-2 border-ink bg-surface p-6 lg:flex xl:w-[22rem]"
          aria-label="Chat details"
        >
          <div className="border-2 border-ink bg-canvas p-5 shadow-brutal-sm">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {reveal.user ? (
                  <RevealedAvatar
                    user={reveal.user}
                    onView={openPhoto}
                    className="size-14 text-xl"
                  />
                ) : (
                  <div className="flex size-14 items-center justify-center border-2 border-ink bg-brand-lavender">
                    <VenetianMask className="size-7" />
                  </div>
                )}
                <OnlineDot online={online} className="absolute -bottom-1 -right-1" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black leading-tight">{partnerName}</p>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                  {statusText}
                </p>
              </div>
            </div>
            {/* Reveal payload carries only name + batch + gender + photo — no email. */}
            {reveal.user?.batch && (
              <p className="mt-3 inline-block bg-brand-yellow px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                Batch {reveal.user.batch}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {reveal.phase !== "accepted" && (
              <Button
                onClick={handleReveal}
                loading={revealClicking}
                disabled={!online || revealPending}
                className="w-full justify-start"
              >
                <Eye className="size-4" />
                {reveal.phase === "outgoing" ? "Reveal pending…" : "Reveal Request"}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setConfirmSkip(true)}
              disabled={!online}
              className="w-full justify-start"
            >
              <SkipForward className="size-4" /> Skip to next
            </Button>
            <Button
              variant="secondary"
              onClick={() => setReportOpen(true)}
              className="w-full justify-start"
            >
              <Flag className="size-4" /> Report
            </Button>
            <Button
              variant="danger"
              onClick={() => (online ? setConfirmEnd(true) : navigate("/home"))}
              className="w-full justify-start"
            >
              <X className="size-4" /> End chat
            </Button>
          </div>
        </aside>

        {/* conversation */}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Wrapping the scroller lets the jump pill anchor to the bottom of
              the transcript instead of guessing the composer's height — which
              drifts as the reply strip opens and closes. */}
          <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scroll-thin h-full overflow-y-auto overscroll-contain"
            /* The header and the composer have always cleared the notch; the
               transcript between them did not, so on a notched phone held
               sideways its left edge ran under the cutout and the rounded
               corner. The typing character is the leftmost thing in the
               thread and the first to disappear behind them. Resolves to 0 on
               every device without insets, which is every device in
               portrait. */
            style={{
              paddingLeft: "env(safe-area-inset-left)",
              paddingRight: "env(safe-area-inset-right)",
            }}
          >
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end px-3 pb-6 pt-5 sm:px-6 lg:px-10 xl:max-w-5xl">
              <div className="mb-2 self-center border-2 border-ink bg-surface px-4 py-1 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                You are now chatting with a stranger. Be kind.
              </div>

              {allMessages.length === 0 && online && (
                <EmptyConversation
                  onPick={(text) => composerRef.current?.setDraft(text)}
                />
              )}

              <div aria-live="polite">
                {grouped.map(({ message, isFirst, isLast, pending }) => (
                  <Bubble
                    key={message.id}
                    message={message}
                    isFirst={isFirst}
                    isLast={isLast}
                    /* A pending id is provisional — replying to it would
                       quote a message the server has not named yet. */
                    canReply={canReply && !pending}
                    pending={pending}
                    onReply={startReply}
                    onJumpToReply={jumpToMessage}
                    partnerName={partnerName}
                    flashed={flashId === message.id}
                  />
                ))}
              </div>

              <AnimatePresence>
                {partnerTyping && <TypingIndicator key="typing" variant={typingVariant} />}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {unseen > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                onClick={() => {
                  scrollToBottom();
                  setUnseen(0);
                }}
                // bottom-6/8 rather than a composer-height guess: sitting a
                // bubble's height above the transcript's own bottom edge keeps
                // the pill clearly floating over the messages instead of
                // half-merged into the composer border.
                className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 border-2 border-ink bg-brand-yellow px-4 py-1.5 font-mono text-[11px] font-black uppercase tracking-[0.2em] shadow-brutal-sm transition-transform hover:translate-y-[1px] sm:bottom-8"
              >
                <ArrowDown className="size-3.5" />
                {unseen} new {unseen === 1 ? "message" : "messages"}
              </motion.button>
            )}
          </AnimatePresence>
          </div>

          <Composer
            ref={composerRef}
            online={online}
            replyTo={replyTo}
            partnerName={partnerName}
            onSend={handleSend}
            onTyping={sendTyping}
            onCancelReply={cancelReply}
            onJumpToQuote={jumpToMessage}
            onSkip={openSkipConfirm}
          />
        </main>
      </div>

      {/* ------------------------------- modals -------------------------------- */}
      <Modal
        open={reveal.phase === "accepted" && Boolean(reveal.user) && !reveal.seen}
        onClose={dismissReveal}
        title="Identities revealed"
      >
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <motion.div
            initial={{ scale: 0.4, rotate: -10, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
          >
            {reveal.user && (
              <RevealedAvatar
                user={reveal.user}
                onView={openPhoto}
                className="size-24 text-3xl shadow-brutal-sm"
              />
            )}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            {/* Reveal payload carries only name + batch + gender + photo — no email. */}
            <p className="text-2xl font-black">{reveal.user?.full_name}</p>
            {reveal.user?.batch && (
              <p className="mt-2 inline-block bg-brand-yellow px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.2em]">
                Batch {reveal.user.batch}
              </p>
            )}
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <Button onClick={dismissReveal}>Keep chatting</Button>
          </motion.div>
        </div>
      </Modal>

      <Modal open={confirmSkip} onClose={() => setConfirmSkip(false)} title="Skip this chat?">
        <p className="mb-5 text-sm text-muted">
          This ends the conversation for both of you and finds you someone new.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmSkip(false)}>
            Stay
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmSkip(false);
              skipRequestedRef.current = true;
              skipChat();
            }}
          >
            <SkipForward className="size-4" /> Skip
          </Button>
        </div>
      </Modal>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End this chat?">
        <p className="mb-5 text-sm text-muted">
          This permanently ends the conversation for both of you.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
            Stay
          </Button>
          <Button variant="danger" loading={ending} onClick={() => void endChat()}>
            End chat
          </Button>
        </div>
      </Modal>

      <ReportModal roomId={roomId} open={reportOpen} onClose={closeReport} />

      {/* Only ever reachable once `reveal.user` exists, so no photo can leak
          out of an anonymous chat. */}
      <ImageViewer
        open={photoOpen && Boolean(reveal.user?.profile_photo)}
        src={reveal.user?.profile_photo ?? null}
        alt={`${reveal.user?.full_name ?? "Partner"}'s profile photo`}
        caption={reveal.user?.full_name}
        onClose={closePhoto}
      />

      {/* ----------------------- match sync barrier ----------------------- */}
      <AnimatePresence>
        {waitingForPartner && (
          <ConnectingOverlay phase={connectPhase} onSkip={skipFromConnecting} />
        )}
      </AnimatePresence>

      {/* --------------------------- ended / error veil -------------------------- */}
      <AnimatePresence>
        {(status === "ended" || status === "error") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-scrim/70 p-4 backdrop-blur-[2px]"
          >
            {/* An ended room is already navigating away; this only covers the
                frame between the socket closing and the route changing, so the
                user never glimpses a chat they can no longer talk in. */}
            {status === "ended" ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex max-w-sm flex-col items-center gap-4 border-2 border-ink bg-surface px-10 py-8 text-center shadow-brutal-lg"
                role="status"
                aria-live="assertive"
              >
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                  className="size-8 border-[3px] border-ink border-t-brand-yellow"
                />
                {exitNotice && <p className="text-lg font-black leading-snug">{exitNotice}</p>}
                <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted">
                  {exitNotice ? "Searching for another student…" : "Ending chat…"}
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ y: 24, scale: 0.96, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="w-full max-w-sm space-y-5 border-2 border-ink bg-surface p-8 text-center shadow-brutal-lg"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.1 }}
                  className="mx-auto flex size-14 items-center justify-center border-2 border-ink bg-brand-lavender"
                >
                  <VenetianMask className="size-7" />
                </motion.div>
                <div>
                  <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                    Can't connect
                  </p>
                  <h2 className="text-2xl font-black leading-tight">Couldn't join this room</h2>
                  {endInfo?.message && (
                    <p className="mt-2 text-sm text-muted">{endInfo.message}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  <Button onClick={() => navigate("/home", { state: { autostart: true } })}>
                    Find a new match
                  </Button>
                  <Button variant="ghost" onClick={() => navigate("/home")}>
                    Back home
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------- report --------------------------------- */

interface ReportFormValues {
  reason: ReportReason;
  description: string;
}

/**
 * The optional screenshot attached to a report.
 *
 * The file itself is held by the parent rather than react-hook-form: the
 * preview, the removal and the busy state are all local UI concerns, and
 * registering a `File` with the form buys nothing.
 */
function EvidencePicker({
  id,
  file,
  preview,
  busy,
  onPick,
  onRemove,
}: {
  id: string;
  file: File | null;
  preview: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    // Lets the same file be re-picked after a removal or a rejection.
    event.target.value = "";
    if (picked) onPick(picked);
  };

  return (
    <>
      {/* Carries the Field's id so its label stays wired to the real control —
          and so clicking "Evidence" opens the picker. */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        // The visible buttons below are the tab stops; a screen-reader-only
        // input would otherwise sit inside the dialog's focus trap.
        tabIndex={-1}
        disabled={busy}
        onChange={handleChange}
      />

      {file && preview ? (
        <div className="flex items-center gap-3 border-2 border-ink bg-surface p-2">
          <span className="relative size-14 shrink-0 overflow-hidden border-2 border-ink bg-raised">
            <img src={preview} alt="" className="size-full object-cover" />
            <AnimatePresence>
              {busy && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 grid place-items-center bg-scrim/70 text-white"
                >
                  <Spinner className="size-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink">{file.name}</span>
            <span className="block text-xs text-muted">
              {busy ? "Uploading…" : formatBytes(file.size)}
            </span>
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label="Remove screenshot"
            className={cn(
              "grid size-8 shrink-0 place-items-center border-2 border-transparent text-muted",
              "transition-colors hover:border-ink hover:text-danger",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            "flex w-full items-center justify-center gap-2 border-2 border-dashed border-ink bg-raised",
            "px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-ink",
            "transition-colors hover:bg-brand-lavender disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <ImagePlus className="size-4" />
          Add a screenshot
        </button>
      )}
    </>
  );
}

function ReportModal({
  roomId,
  open,
  onClose,
}: {
  roomId: string | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const form = useForm<ReportFormValues>({
    defaultValues: { reason: "spam", description: "" },
  });

  const [evidence, setEvidence] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // One object URL per selected file, released the moment it stops being shown.
  useEffect(() => {
    if (!evidence) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(evidence);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [evidence]);

  const pickEvidence = useCallback((file: File) => {
    const problem = validateImageFile(file, "Evidence image");
    if (problem) {
      toast.error(problem);
      return;
    }
    setEvidence(file);
  }, []);

  const submitting = form.formState.isSubmitting;

  // Read through a ref so the guard does not cost `handleClose` its identity —
  // see the note on `closeReport` above.
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;

  /** Closing mid-upload would orphan the request, so it is refused until done. */
  const handleClose = useCallback(() => {
    if (!submittingRef.current) onClose();
  }, [onClose]);

  const submit = form.handleSubmit(async (values) => {
    // handleSubmit already ignores re-entry while `isSubmitting`, so the file
    // cannot be uploaded twice by a double tap.
    if (!roomId) return;
    try {
      await chatApi.report({
        room_id: roomId,
        reason: values.reason,
        description: values.description,
        evidence_image: evidence,
      });
      toast.success("Report submitted. Thanks for keeping campus safe.");
      form.reset();
      setEvidence(null);
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  });

  return (
    <Modal open={open} onClose={handleClose} title="Report this chat">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Reason" required>
          {(id) => (
            <Select id={id} {...form.register("reason")} disabled={submitting}>
              {REPORT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Details" hint="Optional — anything that helps us review.">
          {(id) => (
            <Textarea
              id={id}
              placeholder="What happened?"
              disabled={submitting}
              {...form.register("description")}
            />
          )}
        </Field>
        <Field label="Evidence" hint={`Optional — one image, ${MAX_IMAGE_LABEL} max.`}>
          {(id) => (
            <EvidencePicker
              id={id}
              file={evidence}
              preview={preview}
              busy={submitting}
              onPick={pickEvidence}
              onRemove={() => setEvidence(null)}
            />
          )}
        </Field>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={submitting}>
            Submit report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
