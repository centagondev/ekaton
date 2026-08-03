import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowDown,
  CalendarX2,
  ChevronLeft,
  LogIn,
  LogOut,
  MessageSquare,
  Reply,
  SendHorizonal,
  Users,
  X,
} from "lucide-react";
import { eventsApi, EVENT_MESSAGE_MAX } from "@/lib/api/events";
import { parseApiError } from "@/lib/errors";
import { cn, cursorFromUrl, formatTime } from "@/lib/utils";
import {
  COARSE_POINTER,
  chatSurfaceStyle,
  composerPaddingStyle,
  useChatViewport,
} from "@/lib/useChatViewport";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FullPageLoader } from "@/components/ui/Spinner";
import { SwipeToReply } from "@/components/ui/SwipeToReply";
import { getEventIdentity, rememberEventIdentity } from "./event-shared";
import { useEventSocket } from "./useEventSocket";
import type { EventMessage } from "@/types/api";

const GROUP_WINDOW_MS = 2 * 60 * 1000;

/** How long a jumped-to message stays highlighted. */
const JUMP_FLASH_MS = 1400;

/** Matches the server's quote truncation so an optimistic bubble cannot
 *  show more of the quote than the confirmed one will. */
const REPLY_PREVIEW_LENGTH = 120;

/** A message plus the grouping flags used to render it. */
interface RenderMessage {
  kind: "message";
  message: EventMessage;
  own: boolean;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
}

interface RenderSeparator {
  kind: "separator";
  key: string;
  label: string;
}

type RenderItem = RenderMessage | RenderSeparator;

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/* ------------------------------- presence -------------------------------- */

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

/** Sits in the transcript like a real message, labelled with who is typing. */
function TypingBubble({ names }: { names: string[] }) {
  const label =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} & ${names[1]}`
        : `${names[0]} +${names.length - 1}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="mt-5 flex flex-col items-start"
    >
      <p className="mb-1.5 px-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {label} typing
      </p>
      <div className="w-fit border-2 border-ink bg-surface px-4 py-3 lg:px-5">
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
      </div>
    </motion.div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function EventChatPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  /**
   * Leave the chat for the events list.
   *
   * Deliberately not a history "back": the event detail page sends a joined
   * participant straight back here, so anything that lands on it — going back
   * one entry included — bounces the user into the chat again and makes this
   * button look broken.
   */
  const leaveChat = useCallback(() => navigate("/events"), [navigate]);
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<EventMessage[]>([]);
  // Own messages already matched to a draft, so a re-render cannot retire the
  // same draft twice.
  const reconciledIds = useRef<Set<string>>(new Set());
  const [unseen, setUnseen] = useState(0);
  const [identity, setIdentity] = useState(() => getEventIdentity(id));
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** The message being replied to, or null for a plain send. */
  const [replyTo, setReplyTo] = useState<EventMessage | null>(null);
  /** Briefly highlights a message after jumping to it from a quote. */
  const [flashId, setFlashId] = useState<string | null>(null);
  // Below xl the participants list collapses into an overlay.
  const [peopleOpen, setPeopleOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const ownIds = useRef<Set<string>>(new Set());
  const typingSentRef = useRef(false);
  const typingStopRef = useRef<number | undefined>(undefined);

  const detail = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsApi.detail(id),
    enabled: Boolean(id),
  });

  const event = detail.data;
  const isActive =
    event?.status === "active" && new Date(event.end_time).getTime() > Date.now();

  /**
   * Adopt the identity the server reports, and cache it.
   *
   * `my_participant` is the only reliable answer to "which of these messages
   * are mine". The remembered copy is written by join/, so it is missing for
   * anyone who was already a member — another device, a cleared browser, or
   * an "already joined" bounce straight into the room — and without it every
   * message the user sent rendered as somebody else's, on the wrong side,
   * with the optimistic draft stuck beside it.
   */
  useEffect(() => {
    const mine = event?.my_participant;
    if (!mine) return;
    if (identity?.participantId === mine.id && identity.displayName === mine.display_name) {
      return;
    }
    const next = { participantId: mine.id, displayName: mine.display_name };
    rememberEventIdentity(id, next);
    setIdentity(next);
  }, [event?.my_participant, id, identity]);

  /** The messages endpoint 404s unless you are an active participant. */
  const messagesQuery = useInfiniteQuery({
    queryKey: ["events", id, "messages"],
    queryFn: ({ pageParam }) => eventsApi.messages(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => cursorFromUrl(lastPage.next),
    enabled: Boolean(event) && Boolean(isActive),
    retry: false,
  });

  const joined = messagesQuery.isSuccess;
  const notJoined =
    messagesQuery.isError && parseApiError(messagesQuery.error).status === 404;
  const historyLoading = !joined && !notJoined && Boolean(isActive);

  // A rejected send is only ever reported over the socket, so a draft has to
  // be dropped or the message sits there looking sent. The server answers in
  // the order it received them, so the rejection belongs to the oldest
  // unconfirmed draft — the same end the echo handler retires from.
  const handleSocketError = useCallback((message: string) => {
    toast.error(message);
    setPending((prev) => prev.slice(1));
  }, []);

  const { status, liveMessages, online, typing, sendTyping, sendMessage } = useEventSocket(
    id,
    joined && Boolean(isActive),
    identity?.participantId,
    handleSocketError,
  );

  /* -------------------------------- mutations ------------------------------- */

  const joinMutation = useMutation({
    mutationFn: () => eventsApi.join(id),
    onSuccess: (participant) => {
      rememberEventIdentity(id, participant);
      setIdentity(getEventIdentity(id));
      void queryClient.invalidateQueries({ queryKey: ["events", id] });
      toast.success(
        event?.is_anonymous_chat && participant.display_name
          ? `You're in as "${participant.display_name}"`
          : "You're in!",
      );
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      if (!parsed.message.toLowerCase().includes("already joined")) {
        toast.error(parsed.message);
      }
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ["events", id, "messages"] }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => eventsApi.leave(id),
    onSuccess: () => {
      setConfirmLeave(false);
      void queryClient.invalidateQueries({ queryKey: ["events", id] });
      queryClient.resetQueries({ queryKey: ["events", id, "messages"] });
      toast.info("You left the event.");
      navigate("/events");
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const sendMutation = useMutation({
    mutationFn: (payload: { content: string; replyTo: string | null }) =>
      eventsApi.sendMessage(id, payload.content, payload.replyTo),
    onSuccess: (message) => ownIds.current.add(message.id),
    onError: (error) => toast.error(parseApiError(error).message),
  });

  /* --------------------------- message assembly ---------------------------- */

  const isOwn = useCallback(
    (message: EventMessage) =>
      ownIds.current.has(message.id) ||
      (identity?.displayName !== undefined && message.sender_name === identity.displayName),
    [identity],
  );

  const messages = useMemo(() => {
    const pages = (messagesQuery.data?.pages ?? []) as Array<{ results: EventMessage[] }>;
    const fromRest = pages.flatMap((page) => page.results ?? []);
    // History and live messages arrive through different stores; dedupe by id
    // and order by the server clock so the list is always chronological.
    const byId = new Map<string, EventMessage>();
    for (const message of [...fromRest, ...liveMessages]) byId.set(message.id, message);

    const confirmed = [...byId.values()];

    // Drafts are retired by the effect below rather than filtered here — the
    // server can change a message on its way through, so the copy that comes
    // back cannot be recognised by its text.
    return [...confirmed, ...pending].sort((a, b) => {
      const delta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return delta !== 0 ? delta : a.id.localeCompare(b.id);
    });
  }, [messagesQuery.data, liveMessages, pending]);

  /** Messages plus date separators and grouping flags, ready to render. */
  const items = useMemo<RenderItem[]>(() => {
    const output: RenderItem[] = [];
    const timeOf = (m: EventMessage) => new Date(m.created_at).getTime();

    messages.forEach((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];

      if (!previous || dayLabel(previous.created_at) !== dayLabel(message.created_at)) {
        output.push({
          kind: "separator",
          key: `sep-${message.id}`,
          label: dayLabel(message.created_at),
        });
      }

      const own = isOwn(message);
      const sameAsPrevious =
        previous &&
        previous.sender_name === message.sender_name &&
        timeOf(message) - timeOf(previous) <= GROUP_WINDOW_MS &&
        dayLabel(previous.created_at) === dayLabel(message.created_at);
      const sameAsNext =
        next &&
        next.sender_name === message.sender_name &&
        timeOf(next) - timeOf(message) <= GROUP_WINDOW_MS &&
        dayLabel(next.created_at) === dayLabel(message.created_at);

      output.push({
        kind: "message",
        message,
        own,
        isFirst: !sameAsPrevious,
        isLast: !sameAsNext,
        pending: message.id.startsWith("pending-"),
      });
    });

    return output;
  }, [messages, isOwn]);

  /* ------------------------------ scrolling -------------------------------- */

  /**
   * Scroll the transcript itself to its true bottom rather than
   * `scrollIntoView` on a sentinel: aligning a sentinel's border box leaves
   * the container's own bottom padding scrolled out of view, so the last
   * bubble's shadow sat clipped against the overflow edge — and the extra
   * page scroll `scrollIntoView` can trigger is one of the sources of the
   * whole surface visibly jumping on send.
   */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  /**
   * Jump to a quoted message and flash it.
   *
   * The original may sit on a cursor page the client has not loaded yet, in
   * which case there is nothing to scroll to — say so rather than doing
   * nothing, which reads as a broken tap.
   */
  const jumpToMessage = useCallback((messageId: string) => {
    const node = document.getElementById(`event-message-${messageId}`);
    if (!node) {
      toast.info("That message is further up — scroll to load older messages.");
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(messageId);
    window.setTimeout(() => setFlashId(null), JUMP_FLASH_MS);
  }, []);

  /** Start replying and put the cursor back in the composer. */
  const startReply = useCallback((message: EventMessage) => {
    setReplyTo(message);
    inputRef.current?.focus();
  }, []);

  /** Replying is only possible where sending is. */
  const canReply = Boolean(isActive) && joined;

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 140;
    nearBottomRef.current = nearBottom;
    if (nearBottom) setUnseen(0);
  }, []);

  /**
   * React only when the *newest* message changes — loading older pages grows
   * the list without touching the tail and must not move the viewport.
   *
   * Own sends pin the transcript instantly ("auto"): the optimistic bubble is
   * already in the layout when this runs, so an instant pin lands in the same
   * frame and nothing visibly travels. Smooth scrolling here raced the send —
   * animating toward a bottom that was still moving — which is what read as
   * the chat jumping and settling, worst on small screens.
   */
  // Layout effect, not useEffect: the pin must land before paint, or the
  // browser shows one frame of the grown transcript at the old offset — the
  // subtle jump at the end of a send.
  const lastMessageIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.id === lastMessageIdRef.current) return;
    const firstFill = lastMessageIdRef.current === null;
    lastMessageIdRef.current = last.id;

    if (last.id.startsWith("pending-")) {
      // Only the act of sending claims the bottom.
      nearBottomRef.current = true;
      scrollToBottom("auto");
    } else if (isOwn(last)) {
      // The server echo replacing a draft re-fires this with a new tail id.
      // Re-pin only if still at the bottom — someone who scrolled up between
      // send and echo must not be yanked back down — and never count an own
      // message as unseen.
      if (nearBottomRef.current) scrollToBottom("auto");
    } else if (nearBottomRef.current) {
      // The room's first paint lands at the bottom rather than easing there.
      scrollToBottom(firstFill ? "auto" : "smooth");
    } else {
      setUnseen((count) => count + 1);
    }
  }, [messages, isOwn, scrollToBottom]);

  // Track the visible viewport so the composer rides above the keyboard and
  // the newest message stays visible while it opens.
  useChatViewport(
    useCallback(() => {
      if (nearBottomRef.current) scrollToBottom("auto");
    }, [scrollToBottom]),
  );

  // Drop optimistic entries once the server echoes them back.
  //
  // Matched by arrival order, not by text. The server may change a message on
  // the way through — profanity is masked before it is saved — so the copy
  // that comes back is often not what was typed, and comparing content would
  // leave the draft sitting on screen next to its own masked twin.
  useEffect(() => {
    const fresh = liveMessages.filter(
      (message) => isOwn(message) && !reconciledIds.current.has(message.id),
    );

    if (fresh.length === 0) return;

    for (const message of fresh) reconciledIds.current.add(message.id);
    setPending((prev) => prev.slice(fresh.length));
  }, [liveMessages, isOwn]);

  /* -------------------------------- composer ------------------------------- */

  // The typing debounce outlives the component if you navigate away mid-word.
  useEffect(() => () => window.clearTimeout(typingStopRef.current), []);

  const handleDraft = (value: string) => {
    setDraft(value.slice(0, EVENT_MESSAGE_MAX));
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

  const submit = (formEvent?: { preventDefault: () => void }) => {
    formEvent?.preventDefault();
    const text = draft.trim();
    if (!text || !isActive) return;

    nearBottomRef.current = true;

    const target = replyTo;

    // Prefer the open socket — it skips the HTTP round trip entirely.
    if (sendMessage(text, target?.id ?? null)) {
      setPending((prev) => [
        ...prev,
        {
          id: `pending-${Date.now()}-${prev.length}`,
          sender_name: identity?.displayName ?? "You",
          content: text,
          created_at: new Date().toISOString(),
          // Built here so the quote is on the bubble from the first frame;
          // waiting for the echo would pop it in a moment later.
          reply_to: target
            ? {
                id: target.id,
                sender_name: target.sender_name,
                content: target.content.slice(0, REPLY_PREVIEW_LENGTH),
              }
            : null,
        },
      ]);
    } else {
      if (sendMutation.isPending) return;
      sendMutation.mutate({ content: text, replyTo: target?.id ?? null });
    }

    setReplyTo(null);
    setDraft("");
    inputRef.current?.focus();
    window.clearTimeout(typingStopRef.current);
    if (typingSentRef.current) {
      sendTyping(false);
      typingSentRef.current = false;
    }
  };

  /* --------------------------------- states -------------------------------- */

  if (detail.isLoading) return <FullPageLoader />;

  if (detail.isError || !event) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <EmptyState
          icon={CalendarX2}
          title="Event not found"
          description="It may have been removed."
          action={<Button onClick={() => navigate("/events")}>Back to events</Button>}
        />
      </div>
    );
  }

  const typingNames = Object.values(typing);
  const connected = status === "connected";

  /* -------------------------------- panels --------------------------------- */

  const peoplePanel = (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-ink px-4 py-3.5">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
          Online
        </h2>
        <span
          className={cn(
            "min-w-6 border-2 border-ink px-1.5 py-0.5 text-center font-mono text-[11px] font-black tabular-nums",
            connected ? "bg-brand-lime" : "bg-raised text-muted",
          )}
        >
          {online.length}
        </span>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-3">
        {online.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div className="border-2 border-ink bg-raised p-3">
              <Users className="size-5 text-muted" />
            </div>
            <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-muted">
              {joined ? "Nobody else here right now" : "Join to see who's online"}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {online.map((participant) => {
              const isSelf = participant.id === identity?.participantId;
              // display_name is the resolved name (real for public events,
              // alias for anonymous ones) and is preferred whenever the
              // presence payload carries it. anonymous_name is the current
              // wire field. The personal fallback applies to OUR row only —
              // sharing it rendered everyone as the logged-in user.
              const name =
                participant.display_name ??
                participant.anonymous_name ??
                (isSelf ? identity?.displayName : null) ??
                "Participant";
              return (
                <motion.li
                  key={participant.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "group flex items-center gap-3 border-2 px-3 py-2.5 transition-all",
                    isSelf
                      ? "border-ink bg-brand-yellow shadow-brutal-sm"
                      : "border-ink bg-canvas hover:translate-x-[2px] hover:shadow-brutal-sm",
                  )}
                >
                  {/* Initial tile keeps the row visually anchored, matching
                      the Avatar treatment used elsewhere in the app. */}
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center border-2 border-ink font-black",
                      isSelf ? "bg-surface" : "bg-brand-lavender",
                    )}
                    aria-hidden="true"
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[11px] font-bold uppercase tracking-wider">
                      {name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-muted">
                      <OnlineDot online className="scale-75" />
                      {isSelf ? "you" : "online"}
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  /* --------------------------------- render -------------------------------- */

  return (
    <div
      className="fixed inset-x-0 flex flex-col overflow-hidden bg-canvas"
      style={chatSurfaceStyle}
    >
      {/* -------------------------------- header ------------------------------- */}
      <header
        className="shrink-0 border-b-2 border-ink bg-surface"
        style={{
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1800px] items-center justify-between gap-3 px-3 sm:px-4 lg:h-[4.5rem] lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={leaveChat}
              aria-label="Back to events"
              className="-ml-1 p-2 transition-all hover:-translate-x-0.5 hover:bg-raised"
            >
              <ChevronLeft className="size-5" />
            </button>

            <div className="hidden size-10 shrink-0 items-center justify-center border-2 border-ink bg-brand-lavender sm:flex">
              <MessageSquare className="size-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-black leading-tight sm:text-lg">
                {event.name}
              </p>
              <p
                className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted"
                aria-live="polite"
              >
                <OnlineDot online={connected} className="mr-1.5 inline-flex align-middle" />
                {connected
                  ? `${online.length} online`
                  : status === "connecting"
                    ? "Connecting…"
                    : isActive
                      ? "Offline"
                      : "Event ended"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Participants toggle — only below the docked-sidebar breakpoint. */}
            <button
              onClick={() => setPeopleOpen((open) => !open)}
              aria-label="Online participants"
              className="border-2 border-ink p-2 transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-raised xl:hidden"
            >
              <Users className="size-4" />
            </button>

            {/* The one action that belongs to the conversation itself. */}
            {isActive && joined && (
              <Button size="sm" variant="secondary" onClick={() => setConfirmLeave(true)}>
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">Leave group</span>
              </Button>
            )}

            {isActive && notJoined && (
              <Button
                size="sm"
                onClick={() => joinMutation.mutate()}
                loading={joinMutation.isPending}
              >
                <LogIn className="size-3.5" />
                <span className="hidden sm:inline">Join event</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------- body -------------------------------- */}
      <div className="mx-auto flex w-full max-w-[1800px] flex-1 overflow-hidden">
        {/* The event briefing lives on the detail page; inside the room the
            conversation gets the full width. */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Wrapping the scroller lets the jump pill anchor to the bottom of
              the transcript instead of guessing the composer's height. */}
          <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scroll-thin h-full overflow-y-auto overscroll-contain"
          >
            <div
              className={cn(
                "mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 pb-6 pt-6 sm:px-6 lg:max-w-5xl lg:px-10 xl:max-w-6xl",
                // A full transcript hugs the composer; an empty room centres
                // its state instead of stranding it at the bottom of a tall
                // blank canvas.
                messages.length > 0 ? "justify-end" : "justify-center",
              )}
            >
              {messagesQuery.hasNextPage && (
                <div className="mb-4 flex justify-center">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={messagesQuery.isFetchingNextPage}
                    onClick={() => void messagesQuery.fetchNextPage()}
                  >
                    Load older messages
                  </Button>
                </div>
              )}

              {historyLoading && (
                <div className="space-y-4" aria-busy="true">
                  {/* Varied widths + alternating sides read as a conversation
                      loading, not a generic content block. */}
                  {[
                    "w-[45%]",
                    "ml-auto w-[38%]",
                    "w-[62%]",
                    "w-[30%]",
                    "ml-auto w-[52%]",
                    "w-[44%]",
                    "ml-auto w-[35%]",
                  ].map((width, index) => (
                    <Skeleton
                      key={index}
                      className={cn(index % 3 === 2 ? "h-20" : "h-14", width)}
                    />
                  ))}
                </div>
              )}

              {notJoined && (
                <div className="flex flex-col items-center gap-5 py-10 text-center">
                  <div className="border-2 border-ink bg-brand-yellow p-5 shadow-brutal">
                    <LogIn className="size-8" />
                  </div>
                  <div>
                    <p className="text-xl font-black uppercase tracking-wide">
                      Join to start chatting
                    </p>
                    <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                      Join this event to read the conversation and post messages.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => joinMutation.mutate()}
                    loading={joinMutation.isPending}
                  >
                    <LogIn className="size-4" /> Join event
                  </Button>
                </div>
              )}

              {!isActive && (
                <div className="mx-auto my-6 border-2 border-ink bg-raised px-4 py-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                  This event has ended — the room is closed.
                </div>
              )}

              {joined && messages.length === 0 && isActive && (
                <div className="flex flex-col items-center gap-5 py-10 text-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, rotate: [0, 8, -5, 0] }}
                    transition={{ duration: 1.4, delay: 0.2 }}
                    className="border-2 border-ink bg-brand-lime p-5 shadow-brutal"
                  >
                    <MessageSquare className="size-8" />
                  </motion.div>
                  <div>
                    <p className="text-xl font-black uppercase tracking-wide">No messages yet</p>
                    <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                      {event.is_anonymous_chat
                        ? "Everyone here is anonymous. Say hello and get it started."
                        : "Say hello and get the conversation started."}
                    </p>
                  </div>
                </div>
              )}

              <div aria-live="polite">
                {items.map((item) =>
                  item.kind === "separator" ? (
                    <div key={item.key} className="my-5 flex items-center gap-3">
                      <span className="h-px flex-1 bg-ink/20" />
                      <span className="border-2 border-ink bg-surface px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em]">
                        {item.label}
                      </span>
                      <span className="h-px flex-1 bg-ink/20" />
                    </div>
                  ) : (
                    // A plain element on purpose — no entrance spring, no
                    // layout animation. The scale/rise entrance made short
                    // messages (an emoji most of all) balloon and float in,
                    // and `layout` re-sprang every earlier bubble on each
                    // send. A group room renders like a normal text chat:
                    // the bubble is simply there, full-size, first frame.
                    <div
                      key={item.message.id}
                      id={`event-message-${item.message.id}`}
                      className={cn(
                        "group flex flex-col scroll-mt-24",
                        item.own ? "items-end" : "items-start",
                        // Tight within a group, generous between speakers —
                        // the rhythm that makes a transcript scannable. Both
                        // steps sit on the 4/8px scale the rest of the page uses.
                        item.isFirst ? "mt-6" : "mt-1",
                      )}
                    >
                      {item.isFirst && !item.own && (
                        <p className="mb-2 px-1 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.14em]">
                          {item.message.sender_name}
                        </p>
                      )}

                      <SwipeToReply
                        enabled={canReply && !item.pending}
                        onReply={() => startReply(item.message)}
                        // Percentage keeps bubbles proportional on phones; the
                        // rem cap keeps line length readable on a 27" monitor.
                        className="max-w-[min(85%,30rem)] sm:max-w-[min(78%,34rem)] lg:max-w-[min(68%,42rem)]"
                      >
                        <div
                          className={cn(
                            "flex items-end gap-2",
                            item.own ? "flex-row-reverse" : "flex-row",
                          )}
                        >
                          <div
                            className={cn(
                              // No width rule here on purpose: as a flex item
                              // the bubble already sizes to its content and is
                              // bounded by the wrapper above. `break-words`
                              // only splits a word that cannot fit alone, so
                              // prose wraps at spaces and only long URLs break.
                              "min-w-0 break-words border-2 border-ink px-4 py-3",
                              "text-[15px] leading-[1.55] lg:px-5 lg:text-base",
                              // One transition covers the pending fade and the
                              // jump highlight, so both ease instead of snap.
                              "transition-[opacity,box-shadow] duration-200 ease-out",
                              item.own ? "bg-brand-yellow" : "bg-surface",
                              item.isLast && "shadow-brutal-sm",
                              item.pending && "opacity-60",
                              // A ring that fades in and out reads calmer than
                              // a pulse, and still catches the eye on arrival.
                              flashId === item.message.id && "ring-4 ring-brand-lime",
                            )}
                          >
                            {item.message.reply_to && (
                              <button
                                type="button"
                                onClick={() => jumpToMessage(item.message.reply_to!.id)}
                                aria-label={`Go to the message from ${item.message.reply_to.sender_name}`}
                                className={cn(
                                  "mb-2 flex w-full flex-col items-start gap-0 text-left",
                                  // A thin rule plus the faintest wash — just
                                  // enough to separate the quote from the
                                  // message without becoming a panel dropped
                                  // inside the bubble. The own-bubble tint is
                                  // a step stronger because yellow swallows it.
                                  "border-l-[3px] py-1 pl-2 pr-2",
                                  "transition-colors duration-200",
                                  item.own
                                    ? "border-ink/70 bg-ink/[0.06] hover:bg-ink/[0.11]"
                                    : "border-ink/50 bg-ink/[0.04] hover:bg-ink/[0.08]",
                                )}
                              >
                                {/* Name never squeezes — an alias clipped to
                                    "Neon B…" identifies nobody. The preview
                                    below absorbs the shortfall instead. */}
                                <span className="font-mono text-[10px] font-bold uppercase leading-[1.5] tracking-[0.12em]">
                                  {item.message.reply_to.sender_name}
                                </span>
                                {/* line-clamp, not truncate: it still reports a
                                    full-text intrinsic width, so a quote can
                                    widen the bubble instead of collapsing to
                                    an ellipsis behind a two-word message. */}
                                <span className="line-clamp-1 w-full text-[12.5px] leading-[1.5] opacity-60">
                                  {item.message.reply_to.content}
                                </span>
                              </button>
                            )}

                            {item.message.content}
                          </div>

                          {/* Pointer users get a button; touch users swipe. */}
                          {canReply && !item.pending && (
                            <button
                              type="button"
                              onClick={() => startReply(item.message)}
                              aria-label={`Reply to ${item.message.sender_name}`}
                              className="mb-1 hidden shrink-0 border-2 border-ink bg-surface p-2 opacity-0 transition-opacity hover:bg-brand-lime focus-visible:opacity-100 group-hover:opacity-100 sm:block"
                            >
                              <Reply className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </SwipeToReply>

                      {item.isLast && (
                        <p className="mt-2 px-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                          {formatTime(item.message.created_at)}
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>

              <AnimatePresence>
                {typingNames.length > 0 && <TypingBubble key="typing" names={typingNames} />}
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
                // bottom-6/8 rather than bottom-4: sitting a bubble's height
                // above the composer border keeps the pill (and its shadow)
                // clearly floating over the transcript instead of half-merged
                // into the composer edge, on phones most of all.
                className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 border-2 border-ink bg-brand-yellow px-4 py-1.5 font-mono text-[11px] font-black uppercase tracking-[0.2em] shadow-brutal-sm transition-transform hover:translate-y-[1px] sm:bottom-8"
              >
                <ArrowDown className="size-3.5" />
                {unseen} new {unseen === 1 ? "message" : "messages"}
              </motion.button>
            )}
          </AnimatePresence>
          </div>

          {/* composer */}
          <div
            className="shrink-0 border-t-2 border-ink bg-surface"
            style={composerPaddingStyle}
          >
            <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-6 lg:max-w-5xl lg:px-10 lg:py-4 xl:max-w-6xl">
              {/* Typing is surfaced in the transcript itself (see TypingBubble),
                  so the composer stays uncluttered. */}
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
                        aria-label={`Go to the message from ${replyTo.sender_name}`}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 text-left transition-colors duration-200 hover:bg-ink/5"
                      >
                        <Reply className="size-3.5 shrink-0 opacity-70" />
                        {/* Stacked, matching the in-bubble quote, so the two
                            reply surfaces read as the same idea. */}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-mono text-[10px] font-bold uppercase leading-[1.5] tracking-[0.12em]">
                            Replying to {replyTo.sender_name}
                          </span>
                          <span className="min-w-0 truncate text-[12.5px] leading-[1.5] text-muted">
                            {replyTo.content}
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
                <div
                  className={cn(
                    "relative flex flex-1 items-end border-2 border-ink bg-canvas transition-shadow duration-150",
                    "focus-within:shadow-brutal-sm",
                    (!isActive || !joined) && "opacity-50",
                  )}
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    onChange={(changeEvent) => handleDraft(changeEvent.target.value)}
                    onKeyDown={(keyEvent) => {
                      // Enter sends, Shift+Enter inserts a newline.
                      if (keyEvent.key === "Enter" && !keyEvent.shiftKey) {
                        keyEvent.preventDefault();
                        submit();
                      }
                      // Escape drops the reply before it drops focus.
                      if (keyEvent.key === "Escape" && replyTo) {
                        keyEvent.preventDefault();
                        setReplyTo(null);
                      }
                    }}
                    placeholder={
                      !isActive
                        ? "Event has ended"
                        : !joined
                          ? "Join the event to chat"
                          : event.is_anonymous_chat && identity?.displayName
                            ? `Message as ${identity.displayName}…`
                            : "Type a message…"
                    }
                    disabled={!isActive || !joined}
                    aria-label="Message"
                    autoFocus={!COARSE_POINTER}
                    enterKeyHint="send"
                    /* 16px minimum, otherwise iOS Safari zooms in on focus. */
                    className="max-h-44 min-h-[3.25rem] w-full resize-none bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted/60 lg:px-5"
                  />
                  <AnimatePresence>
                    {draft.length > EVENT_MESSAGE_MAX - 150 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "pointer-events-none self-center pr-3 font-mono text-[10px]",
                          draft.length >= EVENT_MESSAGE_MAX
                            ? "font-bold text-danger"
                            : "text-muted",
                        )}
                      >
                        {EVENT_MESSAGE_MAX - draft.length}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>

                {/* Fixed height matches the collapsed textarea so the button
                    stays aligned to the input's baseline as it grows. */}
                <motion.div whileTap={{ scale: 0.92 }} className="shrink-0">
                  <Button
                    type="submit"
                    disabled={!draft.trim() || !isActive || !joined}
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
        </main>

        {/* right: online participants */}
        <aside
          className="hidden w-72 shrink-0 border-l-2 border-ink bg-surface xl:block"
          aria-label="Online participants"
        >
          {peoplePanel}
        </aside>
      </div>

      {/* ----------------------- mobile / tablet overlays ---------------------- */}
      <AnimatePresence>
        {peopleOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex justify-end bg-ink/50 xl:hidden"
            onClick={() => setPeopleOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="h-full w-[min(22rem,88vw)] border-l-2 border-ink bg-surface"
              onClick={(clickEvent) => clickEvent.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                  Online
                </span>
                <button onClick={() => setPeopleOpen(false)} aria-label="Close panel">
                  <X className="size-4" />
                </button>
              </div>
              <div className="h-[calc(100%-3.25rem)]">
                {peoplePanel}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------------------------------- modals ------------------------------- */}
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this event?">
        <p className="mb-5 text-sm text-muted">
          You can rejoin later{event.is_anonymous_chat ? " — you'll keep the same alias" : ""}.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button
            variant="danger"
            loading={leaveMutation.isPending}
            onClick={() => leaveMutation.mutate()}
          >
            Leave
          </Button>
        </div>
      </Modal>

    </div>
  );
}
