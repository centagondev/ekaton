import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Reply,
  SendHorizonal,
  SkipForward,
  VenetianMask,
  X,
} from "lucide-react";
import { chatApi, REPORT_REASONS } from "@/lib/api/chat";
import { parseApiError } from "@/lib/errors";
import { useChatSocket, type ChatMessage } from "./useChatSocket";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Avatar } from "@/components/ui/Avatar";
import { SwipeToReply } from "@/components/ui/SwipeToReply";
import { cn, formatTime } from "@/lib/utils";
import {
  COARSE_POINTER,
  chatSurfaceStyle,
  composerPaddingStyle,
  useChatViewport,
} from "@/lib/useChatViewport";
import type { ReportReason } from "@/types/api";

const MAX_LENGTH = 500;
const GROUP_WINDOW_MS = 2 * 60 * 1000;

/** How long a jumped-to message stays highlighted. */
const JUMP_FLASH_MS = 1400;

/* --------------------------------- pieces --------------------------------- */

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

/** iMessage-grade typing bubble: three dots on a staggered wave. */
function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="mt-3 w-fit origin-bottom-left border-2 border-ink bg-surface px-4 py-3"
      aria-label="Stranger is typing"
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            className="size-1.5 bg-ink/70"
            animate={{ y: [0, -4, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.16, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

const Bubble = memo(function Bubble({
  message,
  isFirst,
  isLast,
  canReply,
  onReply,
  onJumpToReply,
  partnerName,
  flashed,
}: {
  message: ChatMessage;
  isFirst: boolean;
  isLast: boolean;
  canReply: boolean;
  onReply: (message: ChatMessage) => void;
  onJumpToReply: (id: string) => void;
  partnerName: string;
  flashed: boolean;
}) {
  return (
    <motion.div
      id={`chat-message-${message.id}`}
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 480, damping: 34 }}
      className={cn(
        "group flex scroll-mt-24 flex-col",
        message.isOwn ? "origin-bottom-right items-end" : "origin-bottom-left items-start",
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
    </motion.div>
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

/* ---------------------------------- page ---------------------------------- */

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

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
  } = useChatSocket(roomId);

  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [revealClicking, setRevealClicking] = useState(false);
  const [respondLoading, setRespondLoading] = useState<"accept" | "reject" | null>(null);
  const [unseen, setUnseen] = useState(0);
  /** The message being replied to, or null for a plain send. */
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  /** Briefly highlights a message after jumping to it from a quote. */
  const [flashId, setFlashId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nearBottomRef = useRef(true);
  const typingSentRef = useRef(false);
  const typingStopRef = useRef<number | undefined>(undefined);
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
   * Both clients hold the chat closed until each has proof the other is in the
   * room, so the conversation opens for both at the same instant instead of
   * whoever polled first entering early. `stranded` is a safety valve only —
   * it never delays the happy path, it just prevents being trapped here if the
   * other side never actually connects.
   */
  const [stranded, setStranded] = useState(false);
  useEffect(() => {
    if (!online || partnerPresent) return;
    const timer = window.setTimeout(() => setStranded(true), 12_000);
    return () => window.clearTimeout(timer);
  }, [online, partnerPresent]);

  const waitingForPartner = online && !partnerPresent && !stranded;

  /* ----------------------------- scroll behaviour ---------------------------- */

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
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
    inputRef.current?.focus();
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

  useEffect(() => {
    if (messages.length === 0) return;
    if (nearBottomRef.current || messages[messages.length - 1]?.isOwn) scrollToBottom();
    else setUnseen((count) => count + 1);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (partnerTyping && nearBottomRef.current) scrollToBottom();
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
            ? "Skipped. Finding someone new…"
            : "Stranger skipped to a new chat."
          : "Stranger disconnected.";

  useEffect(() => {
    if (!exitNotice) return;
    // replace: the dead room must not sit in history behind /home.
    navigate("/home", { replace: true, state: { autostart: true, notice: exitNotice } });
  }, [exitNotice, navigate]);

  // The typing debounce outlives the component if you navigate away mid-word.
  useEffect(() => () => window.clearTimeout(typingStopRef.current), []);

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

  const handleDraft = (value: string) => {
    setDraft(value.slice(0, MAX_LENGTH));
    if (!typingSentRef.current) {
      sendTyping(true);
      typingSentRef.current = true;
    }
    window.clearTimeout(typingStopRef.current);
    typingStopRef.current = window.setTimeout(() => {
      sendTyping(false);
      typingSentRef.current = false;
    }, 1500);
  };

  const submit = (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || !online) return;
    const target = replyTo;
    sendMessage(text, target?.id ?? null);
    setReplyTo(null);
    setDraft("");
    inputRef.current?.focus();
    window.clearTimeout(typingStopRef.current);
    if (typingSentRef.current) {
      sendTyping(false);
      typingSentRef.current = false;
    }
  };

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
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];
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
      };
    });
  }, [messages]);

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
                <Avatar name={reveal.user.full_name} src={reveal.user.profile_photo} />
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
              <p
                className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted"
                aria-live="polite"
              >
                {statusText}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            {online && reveal.phase !== "accepted" && (
              <Button size="sm" onClick={handleReveal} loading={revealClicking} disabled={revealPending}>
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
              <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
                <div className="flex items-center gap-2.5">
                  <motion.span
                    animate={{ rotate: [0, -8, 8, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1 }}
                    className="border-2 border-ink bg-surface p-1.5"
                  >
                    <Eye className="size-4" />
                  </motion.span>
                  <p className="text-sm font-bold">They want to reveal identities. You in?</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="lime"
                    loading={respondLoading === "accept"}
                    disabled={respondLoading !== null}
                    onClick={() => handleRespond(true)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={respondLoading === "reject"}
                    disabled={respondLoading !== null}
                    onClick={() => handleRespond(false)}
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
                  <Avatar
                    name={reveal.user.full_name}
                    src={reveal.user.profile_photo}
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
            {/* Reveal payload carries only name + batch + photo — no email. */}
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
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scroll-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end px-3 pb-6 pt-5 sm:px-6 lg:px-10 xl:max-w-5xl">
              <div className="mb-2 self-center border-2 border-ink bg-surface px-4 py-1 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                You are now chatting with a stranger. Be kind.
              </div>

              {messages.length === 0 && online && (
                <EmptyConversation
                  onPick={(text) => {
                    setDraft(text);
                    inputRef.current?.focus();
                  }}
                />
              )}

              <div aria-live="polite">
                {grouped.map(({ message, isFirst, isLast }) => (
                  <Bubble
                    key={message.id}
                    message={message}
                    isFirst={isFirst}
                    isLast={isLast}
                    canReply={canReply}
                    onReply={startReply}
                    onJumpToReply={jumpToMessage}
                    partnerName={partnerName}
                    flashed={flashId === message.id}
                  />
                ))}
              </div>

              <AnimatePresence>{partnerTyping && <TypingBubble key="typing" />}</AnimatePresence>
              <div ref={bottomRef} className="h-px" />
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
                className="absolute bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 border-2 border-ink bg-brand-yellow px-4 py-1.5 font-mono text-[11px] font-black uppercase tracking-[0.2em] shadow-brutal-sm"
              >
                <ArrowDown className="size-3.5" />
                {unseen} new {unseen === 1 ? "message" : "messages"}
              </motion.button>
            )}
          </AnimatePresence>

          {/* composer */}
          <div
            className="shrink-0 border-t-2 border-ink bg-surface"
            style={composerPaddingStyle}
          >
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
                        onClick={() => jumpToMessage(replyTo.id)}
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
                        onClick={() => setReplyTo(null)}
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
                  onClick={() => setConfirmSkip(true)}
                  disabled={!online}
                  className="max-sm:px-3 lg:hidden"
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
                        setReplyTo(null);
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
                    className="w-full bg-transparent px-4 py-3 text-base outline-none placeholder:text-muted/60 lg:px-5 lg:py-3.5"
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

                <motion.div whileTap={{ scale: 0.92 }}>
                  <Button
                    type="submit"
                    disabled={!draft.trim() || !online}
                    aria-label="Send message"
                    className="px-4 py-3 lg:px-6 lg:py-3.5"
                  >
                    <SendHorizonal className="size-4" />
                    <span className="hidden sm:inline">Send</span>
                  </Button>
                </motion.div>
              </form>
            </div>
          </div>
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
            <Avatar
              name={reveal.user?.full_name}
              src={reveal.user?.profile_photo}
              className="size-24 text-3xl shadow-brutal-sm"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            {/* Reveal payload carries only name + batch + photo — no email. */}
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

      <ReportModal roomId={roomId} open={reportOpen} onClose={() => setReportOpen(false)} />

      {/* ----------------------- match sync barrier ----------------------- */}
      <AnimatePresence>
        {waitingForPartner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-canvas p-4"
            role="status"
            aria-live="polite"
          >
            <div className="flex w-full max-w-sm flex-col items-center gap-6 border-2 border-ink bg-surface px-8 py-10 text-center shadow-brutal-lg">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 16 }}
                className="border-2 border-ink bg-brand-lime px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.25em]"
              >
                Match found
              </motion.span>

              <div className="relative flex items-center justify-center">
                {[0, 1].map((ring) => (
                  <motion.span
                    key={ring}
                    className="absolute size-20 border-2 border-ink"
                    initial={{ scale: 1, opacity: 0.45 }}
                    animate={{ scale: 1.75, opacity: 0 }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      delay: ring * 0.9,
                      ease: "easeOut",
                    }}
                  />
                ))}
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  className="relative flex size-20 items-center justify-center border-2 border-ink bg-brand-yellow shadow-brutal-sm"
                >
                  <VenetianMask className="size-9" />
                </motion.div>
              </div>

              <div>
                <h2 className="text-2xl font-black uppercase leading-tight">
                  Connecting you both
                </h2>
                <p className="mt-1.5 text-sm text-muted">
                  Opening the chat for both of you at once…
                </p>
              </div>

              <div className="h-1.5 w-40 overflow-hidden border-2 border-ink bg-canvas">
                <motion.div
                  className="h-full w-1/3 bg-brand-lime"
                  animate={{ x: ["-110%", "330%"] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------------- ended / error veil -------------------------- */}
      <AnimatePresence>
        {(status === "ended" || status === "error") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-[2px]"
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

  const submit = form.handleSubmit(async (values) => {
    if (!roomId) return;
    try {
      await chatApi.report({
        room_id: roomId,
        reason: values.reason,
        description: values.description,
      });
      toast.success("Report submitted. Thanks for keeping campus safe.");
      form.reset();
      onClose();
    } catch (error) {
      toast.error(parseApiError(error).message);
    }
  });

  return (
    <Modal open={open} onClose={onClose} title="Report this chat">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Reason" required>
          {(id) => (
            <Select id={id} {...form.register("reason")}>
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
            <Textarea id={id} placeholder="What happened?" {...form.register("description")} />
          )}
        </Field>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={form.formState.isSubmitting}>
            Submit report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
