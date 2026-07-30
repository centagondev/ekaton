import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  Gift,
  Heart,
  MessageCircle,
  MessagesSquare,
  SendHorizonal,
  ThumbsUp,
  Trophy,
  VenetianMask,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/Logo";
import { Modal } from "@/components/ui/Modal";
import { FullPageLoader } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { parseApiError } from "@/lib/errors";
import { cn, formatTime } from "@/lib/utils";
import {
  COARSE_POINTER,
  chatSurfaceStyle,
  composerPaddingStyle,
  useChatViewport,
} from "@/lib/useChatViewport";
import { publicSpeakingApi, type SpeakingMessage } from "./api";
import { useSpeakingSocket } from "./useSpeakingSocket";

const MAX_LENGTH = 1000;
const LEADERBOARD_SIZE = 10;

/**
 * Reddit ranking, applied client-side too.
 *
 * The server returns history already ranked, but votes and new messages arrive
 * over the socket afterwards; re-sorting here keeps the list correct without a
 * refetch per vote.
 */
function rank(messages: SpeakingMessage[]): SpeakingMessage[] {
  return [...messages].sort((a, b) => {
    if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/* --------------------------------- avatar --------------------------------- */

const AVATAR_FILLS = ["bg-brand-yellow", "bg-brand-lime", "bg-brand-lavender"] as const;

/**
 * Deterministic square avatar: same anonymous name → same colour everywhere it
 * appears, so a voice stays recognisable across the feed and the leaderboard.
 */
function avatarFill(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_FILLS[Math.abs(hash) % AVATAR_FILLS.length];
}

function AnonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 select-none items-center justify-center border-2 border-ink text-sm font-black uppercase",
        avatarFill(name),
        className,
      )}
    >
      {name.charAt(0)}
    </span>
  );
}

/* ------------------------------- vote button ------------------------------- */

/** Brutalist confetti: four little squares thrown from the heart on vote. */
const BURST_VECTORS = [
  { x: -14, y: -12 },
  { x: 12, y: -16 },
  { x: -10, y: 10 },
  { x: 15, y: 8 },
] as const;

/**
 * Horizontal heart chip: ❤ count, side by side.
 *
 * A heart, not an arrow — the prompt on stage is "vote for the most relatable
 * experience", and relating is what a heart says.
 *
 * A Reddit-style toggle: tap fills it yellow, tap again empties it. Only your
 * own story is inert (with a tooltip saying why). Votes are painted
 * optimistically by the parent, so fill, pop, burst and the rolling count all
 * play the instant of the tap — in either direction.
 */
function VoteButton({
  message,
  onUpvote,
  className,
}: {
  message: SpeakingMessage;
  onUpvote: (id: string) => void;
  className?: string;
}) {
  const [burst, setBurst] = useState(0);
  const inert = message.is_own;

  return (
    <motion.button
      type="button"
      whileTap={inert ? undefined : { scale: 0.85 }}
      onClick={(event) => {
        // Cards can have their own click behaviour (leaderboard expand);
        // voting must never trigger it.
        event.stopPropagation();
        if (inert) return;
        // The burst celebrates adding a vote; removing one plays no confetti.
        if (!message.has_upvoted) setBurst((n) => n + 1);
        onUpvote(message.id);
      }}
      aria-pressed={message.has_upvoted}
      aria-disabled={inert || undefined}
      title={message.is_own ? "You can't vote for your own response." : undefined}
      aria-label={
        message.is_own
          ? `Your response (${message.upvote_count} votes)`
          : message.has_upvoted
            ? `Remove your vote (${message.upvote_count})`
            : `Vote for this story (${message.upvote_count})`
      }
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 rounded-sm border-2 border-ink px-2.5 py-1 transition-all duration-150",
        message.is_own
          ? "cursor-not-allowed bg-raised opacity-60"
          : message.has_upvoted
            ? "bg-brand-yellow shadow-brutal-sm hover:-translate-y-[1px]"
            : "bg-surface hover:-translate-y-[1px] hover:bg-raised hover:shadow-brutal-sm",
        className,
      )}
    >
      {/* Burst — keyed so each vote replays it, gone in ~350ms. */}
      <AnimatePresence>
        {burst > 0 && (
          <motion.span
            key={burst}
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {BURST_VECTORS.map((vector, index) => (
              <motion.span
                key={index}
                className="absolute size-1.5 bg-brand-yellow ring-1 ring-ink"
                initial={{ x: 0, y: 0, scale: 1 }}
                animate={{ x: vector.x, y: vector.y, scale: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            ))}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Keyed on voted state: filling pops in large, emptying shrinks back. */}
      <motion.span
        key={`heart-${message.has_upvoted}`}
        initial={message.has_upvoted ? { scale: 1.4 } : { scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 20 }}
      >
        <Heart
          className={cn(
            "size-3.5 transition-colors duration-150",
            message.has_upvoted && "fill-ink stroke-ink",
          )}
        />
      </motion.span>

      {/* Rolling counter: old value slides up and out, new one slides in. */}
      <span className="relative block h-4 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={message.upvote_count}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="block font-mono text-[11px] font-black leading-4 tabular-nums"
          >
            {message.upvote_count}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

/* ---------------------------- onam banner art ------------------------------ */

/**
 * Decorative snake-boat (vallam kali) sketch for the Onam banner. Hand-drawn
 * flat-style SVG rather than a raster image — nothing here fetches or embeds
 * an external asset. Purely presentational: aria-hidden, no semantic content.
 */
function OnamBoatArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 110" fill="none" aria-hidden="true" className={className}>
      <path
        d="M6 82 C 36 98, 82 102, 126 94 C 168 87, 198 68, 214 36 C 184 44, 158 49, 124 52 C 82 55, 38 62, 6 82 Z"
        fill="#3a2415"
      />
      <path
        d="M214 36 C 204 16, 192 4, 180 0"
        stroke="#3a2415"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={38 + i * 22} cy={76 - i * 1.4} r="6.5" fill="#8a5a2b" />
      ))}
      <line x1="86" y1="70" x2="86" y2="26" stroke="#3a2415" strokeWidth="3" />
      <path
        d="M62 30 Q86 14 110 30"
        stroke="#c0392b"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Decorative Onam sadhya (banana-leaf feast), nilavilakku lamp and umbrella.
 * Same rationale as OnamBoatArt: hand-drawn, decorative, aria-hidden.
 */
function OnamSadhyaArt({ className }: { className?: string }) {
  const dishColors = ["#f4d35e", "#e07a5f", "#f2f2f2", "#e07a5f", "#f4d35e"];
  return (
    <svg viewBox="0 0 220 120" fill="none" aria-hidden="true" className={className}>
      <ellipse cx="76" cy="97" rx="62" ry="17" fill="#2f6b32" />
      {dishColors.map((fill, i) => (
        <circle key={i} cx={40 + i * 18} cy={90 - (i % 2) * 4} r="7" fill={fill} />
      ))}
      <rect x="152" y="66" width="4" height="36" fill="#8a5a2b" />
      <ellipse cx="154" cy="62" rx="14" ry="5" fill="#c99a3f" />
      <path d="M154 57 Q157 47 154 41" stroke="#e07a1f" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M128 22 Q170 -4 206 20"
        stroke="#8a5a2b"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M128 22 Q168 6 206 20 Q168 32 128 22 Z" fill="#c0392b" opacity="0.9" />
      <line x1="167" y1="20" x2="167" y2="66" stroke="#8a5a2b" strokeWidth="3" />
    </svg>
  );
}

/** One "how it works" step inside the white pill bar under the banner. */
function BannerStep({
  icon,
  label,
  divider = true,
}: {
  icon: ReactNode;
  label: string;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-ink",
        divider && "sm:border-l-2 sm:border-ink/10",
      )}
    >
      {icon}
      {label}
    </div>
  );
}

/* ------------------------------- leaderboard ------------------------------- */

const MEDALS = ["🥇", "🥈", "🥉"] as const;

/**
 * One ranked story. The MESSAGE is the hero: two clamped lines with a fade,
 * tap to expand; rank, votes and the anonymous name are quiet metadata.
 */
function TopStoryCard({
  message,
  index,
  onUpvote,
}: {
  message: SpeakingMessage;
  index: number;
  onUpvote: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Rough two-line capacity; below this there is nothing to fade or expand.
  const clampable = message.content.length > 90;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="rounded-sm border-2 border-ink bg-surface transition-all hover:-translate-y-[1px] hover:shadow-brutal-sm"
    >
      <div className="p-4">
        {/* The story area is the expand control; the vote chip below stays a
            sibling, never a nested button. */}
        <button
          type="button"
          onClick={() => clampable && setExpanded((current) => !current)}
          aria-expanded={clampable ? expanded : undefined}
          className="block w-full text-left"
        >
          {/* Rank — small inline badge, not a block. */}
          <p className="mb-1.5 font-mono text-[11px] font-black tracking-[0.1em]">
            {MEDALS[index] ? `${MEDALS[index]} ` : ""}#{index + 1}
          </p>

          {/* The story itself, large. */}
          <div className="relative">
            <motion.p
              layout="position"
              className={cn(
                "break-words text-[15px] font-medium leading-relaxed",
                !expanded && "line-clamp-2",
              )}
            >
              {message.content}
            </motion.p>
            {/* The second line fades out while clamped, promising more below. */}
            {clampable && !expanded && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-surface to-transparent"
              />
            )}
          </div>
        </button>

        {/* Metadata row: votes first, identity last and tiny. */}
        <div className="mt-3 flex items-center gap-3">
          <VoteButton message={message} onUpvote={onUpvote} />
          <span className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
            {message.display_name} · {formatTime(message.created_at)}
          </span>
        </div>
      </div>
    </motion.li>
  );
}

/**
 * Top ten, in a modal behind the 🏆 button.
 *
 * Derived from the same ranked array the feed renders, so the existing
 * `upvote` socket frames keep it live with no extra request — and `layout` on
 * each card animates rank changes as votes land while it is open.
 */
function LeaderboardModal({
  open,
  onClose,
  messages,
  onUpvote,
}: {
  open: boolean;
  onClose: () => void;
  messages: SpeakingMessage[];
  onUpvote: (id: string) => void;
}) {
  const top = messages.filter((m) => m.upvote_count > 0).slice(0, LEADERBOARD_SIZE);

  return (
    <Modal open={open} onClose={onClose} title="🏆 Top Stories">
      <p className="-mt-2 mb-5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
        Most upvoted experiences today.
      </p>
      {top.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No votes yet — heart the stories you relate to.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {top.map((message, index) => (
              <TopStoryCard
                key={message.id}
                message={message}
                index={index}
                onUpvote={onUpvote}
              />
            ))}
          </AnimatePresence>
        </ol>
      )}
    </Modal>
  );
}

/* --------------------------------- card ----------------------------------- */

function StoryCard({
  message,
  onUpvote,
}: {
  message: SpeakingMessage;
  onUpvote: (id: string) => void;
}) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "group border-2 border-ink bg-surface p-4 transition-all sm:p-5",
        // Hover elevation, brutalist: the card lifts onto a hard shadow.
        "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-brutal-sm",
      )}
    >
      <div className="flex items-center gap-3">
        <AnonAvatar name={message.display_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] font-black uppercase tracking-[0.14em]">
            {message.display_name}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted">
            {formatTime(message.created_at)}
          </p>
        </div>
        <VoteButton message={message} onUpvote={onUpvote} />
      </div>

      <p className="mt-3 break-words text-[15px] leading-relaxed">
        {message.content}
      </p>
    </motion.li>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function PublicSpeakingPage() {
  const [messages, setMessages] = useState<SpeakingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Mirrors the server's has_posted; never the sole authority for it.
  const [hasPosted, setHasPosted] = useState(false);
  // True when the server said has_posted at join time — a returning visitor —
  // so the notice can thank them instead of confirming a submission they made
  // in some earlier session.
  const [postedEarlier, setPostedEarlier] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingStopRef = useRef<number | undefined>(undefined);
  const typingSentRef = useRef(false);

  /**
   * The database is the source of truth for whether a discussion is running.
   *
   * `retry` is deliberate: a transport failure (CORS, offline, backend
   * restarting) must NOT be reported as "no discussion" — only a real 404
   * from the server means that. Retrying anything else is what stops a
   * momentary blip from blanking a live room.
   */
  const discussionQuery = useQuery({
    queryKey: ["public-speaking"],
    queryFn: publicSpeakingApi.discussion,
    retry: (failureCount, error) =>
      parseApiError(error).status === 404 ? false : failureCount < 3,
    staleTime: 0,
  });

  // Only a 404 means the room is genuinely closed.
  const noDiscussion = parseApiError(discussionQuery.error).status === 404;

  const joined = displayName !== null;

  /* --------------------------------- join --------------------------------- */

  const joinMutation = useMutation({
    mutationFn: publicSpeakingApi.join,
    onSuccess: async (result) => {
      setDisplayName(result.display_name);
      // Server-owned, so a refresh restores the locked composer rather than
      // offering an input the backend would reject.
      setHasPosted(result.has_posted);
      setPostedEarlier(result.has_posted);
      setMessages(rank(await publicSpeakingApi.messages()));
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  /**
   * Participation state, from the database, on every page load.
   *
   * This is what makes refresh and new tabs safe. It is NOT gated on the
   * browser holding a token: identity may live only in the HttpOnly cookie
   * (storage cleared, or blocked), and gating on localStorage was precisely
   * what let such a browser present itself as a brand new participant and post
   * and vote a second time.
   */
  const stateQuery = useQuery({
    queryKey: ["public-speaking", "state"],
    queryFn: publicSpeakingApi.state,
    enabled: Boolean(discussionQuery.data),
    retry: (failureCount, error) =>
      parseApiError(error).status === 404 ? false : failureCount < 3,
    staleTime: 0,
  });

  // Adopt the server's verdict the moment it lands — before any composer is
  // rendered, so there is no window in which an already-posted visitor can type.
  const adopted = useRef(false);
  useEffect(() => {
    const state = stateQuery.data;
    if (!state || adopted.current) return;
    adopted.current = true;

    if (!state.joined) return;

    setDisplayName(state.display_name);
    setHasPosted(state.already_posted);
    setPostedEarlier(state.already_posted);
    void publicSpeakingApi.messages().then((rows) => setMessages(rank(rows)));
  }, [stateQuery.data]);

  /* -------------------------------- socket -------------------------------- */

  const handleMessage = useCallback((incoming: SpeakingMessage) => {
    setMessages((current) =>
      current.some((message) => message.id === incoming.id)
        ? current
        : rank([...current, incoming]),
    );
  }, []);

  const handleUpvote = useCallback((messageId: string, count: number, mine?: boolean) => {
    setMessages((current) =>
      rank(
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                upvote_count: count,
                has_upvoted: mine ?? message.has_upvoted,
              }
            : message,
        ),
      ),
    );
  }, []);

  const { status, typingNames, sendMessage, sendUpvote, sendTyping } = useSpeakingSocket({
    enabled: joined,
    onMessage: handleMessage,
    onUpvote: handleUpvote,
    onPosted: useCallback((messageId: string | undefined) => {
      setHasPosted(true);
      // Mark the just-broadcast message as ours so the no-self-vote rule
      // applies to it immediately; a refresh gets the same flag from the API.
      if (messageId) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId ? { ...message, is_own: true } : message,
          ),
        );
      }
    }, []),
    onError: useCallback((message: string, alreadyPosted: boolean) => {
      // A rejection that means "you already answered" locks the composer in
      // place — no refresh — so a stale tab stops offering an input the server
      // will never accept.
      if (alreadyPosted) {
        setHasPosted(true);
        setPostedEarlier(true);
        toast.error("You have already submitted your response.");
        return;
      }
      toast.error(message);
    }, []),
    // An optimistic vote the server refused: land the UI back on exactly what
    // the database holds, then explain.
    onVoteError: useCallback(
      (messageId: string, count: number, hasUpvoted: boolean, message: string) => {
        setMessages((current) =>
          rank(
            current.map((item) =>
              item.id === messageId
                ? { ...item, upvote_count: count, has_upvoted: hasUpvoted }
                : item,
            ),
          ),
        );
        toast.error(message);
      },
      [],
    ),
  });

  // Optimistic voting: paint the vote before the network answers. Guards run
  // against a ref so the callback never goes stale mid-render.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const vote = useCallback(
    (messageId: string) => {
      const target = messagesRef.current.find((m) => m.id === messageId);
      // Own responses are the one dead end the server would reject anyway.
      if (!target || target.is_own) return;

      // send() drops frames on a closed socket, so an optimistic vote here
      // would stick on screen and never reach the server.
      if (status !== "connected") {
        toast.error("Reconnecting — try again in a moment.");
        return;
      }

      // Toggle, Reddit-style: painted optimistically in whichever direction,
      // reconciled by upvote_ack, rolled back by upvote_error.
      navigator.vibrate?.(target.has_upvoted ? 8 : 15);
      setMessages((current) =>
        rank(
          current.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  has_upvoted: !item.has_upvoted,
                  upvote_count: item.upvote_count + (item.has_upvoted ? -1 : 1),
                }
              : item,
          ),
        ),
      );
      sendUpvote(messageId);
    },
    [sendUpvote, status],
  );

  useChatViewport();

  // Ranking means a new message can land anywhere, so jumping to the top on
  // every arrival yanks a reader off what they were reading to show them
  // nothing. Only follow when the top card actually changed.
  const headId = messages[0]?.id;
  useEffect(() => {
    if (!headId) return;
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [headId]);

  /* -------------------------------- actions -------------------------------- */

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
    // The guard is a courtesy; the server rejects a second post regardless.
    if (!text || status !== "connected" || hasPosted) return;
    sendMessage(text);
    setDraft("");
    window.clearTimeout(typingStopRef.current);
    if (typingSentRef.current) {
      sendTyping(false);
      typingSentRef.current = false;
    }
  };

  useEffect(() => () => window.clearTimeout(typingStopRef.current), []);

  const typingLabel = useMemo(() => {
    if (typingNames.length === 0) return null;
    if (typingNames.length === 1) return `${typingNames[0]} is typing…`;
    return `${typingNames.length} people are typing…`;
  }, [typingNames]);

  /* -------------------------------- render -------------------------------- */

  if (discussionQuery.isPending) return <FullPageLoader />;

  if (noDiscussion) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <EmptyState
          title="No discussion running"
          description="There is no live discussion right now. Check back shortly."
        />
      </div>
    );
  }

  // Reached the server but could not read it — a retriable fault, never
  // presented as "the discussion is gone".
  if (!discussionQuery.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <EmptyState
          title="Can't reach the discussion"
          description="Check your connection — this page will keep trying."
        />
      </div>
    );
  }

  const discussion = discussionQuery.data;

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
        {/* Top row: brand left, identity + leaderboard right. */}
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2.5 sm:px-6">
          {/* This page sits outside AppLayout, so BottomNav is not mounted —
              without this the only interactive page has no way back. */}
          <Link to="/home" aria-label="Back to Ekaton home" className="shrink-0">
            <Logo />
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {joined && (
              <span className="flex min-w-0 items-center gap-1.5 border-2 border-ink bg-brand-lavender px-2 py-1">
                <VenetianMask className="size-3.5 shrink-0" />
                <span className="hidden truncate font-mono text-[10px] font-black uppercase tracking-[0.14em] sm:inline">
                  {displayName}
                </span>
              </span>
            )}
            {/* Desktop leaderboard trigger — the mobile one floats over the feed. */}
            <button
              type="button"
              onClick={() => setLeaderboardOpen(true)}
              className="hidden items-center gap-1.5 border-2 border-ink bg-surface px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.14em] shadow-brutal-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none sm:flex"
            >
              <Trophy className="size-3.5" /> Top 10
            </button>
          </div>
        </div>

        {/* The question is the event. Large, centred, never scrolled away.
            Festive one-off treatment for the Onam run — rounded pills and the
            boat/sadhya art depart from the app's usual sharp-cornered style on
            purpose, matching the banner this was designed against. */}
        <div className="relative overflow-hidden border-t-2 border-ink bg-brand-yellow">
          <OnamBoatArt className="pointer-events-none absolute -left-3 bottom-0 hidden h-24 w-auto opacity-90 lg:block xl:h-28" />
          <OnamSadhyaArt className="pointer-events-none absolute -right-3 bottom-0 hidden h-24 w-auto opacity-90 lg:block xl:h-28" />

          <div className="relative mx-auto w-full max-w-3xl px-4 py-5 text-center sm:px-6 sm:py-7">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-1 font-mono text-[10px] font-black uppercase tracking-[0.2em]">
              <span aria-hidden="true">🌼</span>
              {discussion.title} Celebration
              <span aria-hidden="true">🌼</span>
            </span>

            <h1 className="mx-auto mt-3 max-w-2xl text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              {discussion.topic}
            </h1>

            <p className="mt-2 font-bold text-ink/70">
              <span aria-hidden="true">🌿</span> Suggest{" "}
              <span aria-hidden="true">·</span> Vote{" "}
              <span aria-hidden="true">·</span> Celebrate Together{" "}
              <span aria-hidden="true">🌿</span>
            </p>

            <div className="mt-4 inline-flex flex-col items-stretch rounded-2xl bg-surface/95 shadow-brutal-sm sm:flex-row sm:items-center">
              <BannerStep
                icon={<MessageCircle className="size-4 shrink-0" aria-hidden="true" />}
                label="Suggest Your Ideas"
                divider={false}
              />
              <BannerStep
                icon={<ThumbsUp className="size-4 shrink-0" aria-hidden="true" />}
                label="Vote for Your Favorite"
              />
              <BannerStep
                icon={<Gift className="size-4 shrink-0" aria-hidden="true" />}
                label="Let's Celebrate Onam Together!"
              />
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------- feed --------------------------------- */}
      <main className="relative flex min-h-0 flex-1 flex-col">
        {/* Mobile floating leaderboard button, top-right over the feed. */}
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setLeaderboardOpen(true)}
          aria-label="Top 10 responses"
          className="absolute right-3 top-3 z-20 flex items-center gap-1.5 border-2 border-ink bg-brand-yellow px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] shadow-brutal-sm sm:hidden"
        >
          <Trophy className="size-4" /> Top 10
        </motion.button>

        <div
          ref={listRef}
          className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
            {!joined ? (
              /* ----------------------------- join gate ---------------------------- */
              <div className="flex flex-col items-center gap-6 py-14 text-center sm:py-20">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="border-2 border-ink bg-brand-lavender p-5 shadow-brutal"
                >
                  <VenetianMask className="size-9" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">
                    Join anonymously
                  </h2>
                  <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
                    No account, no email. You'll be given a random name for this
                    session — share one story, then vote.
                  </p>
                </div>
                <Button
                  onClick={() => joinMutation.mutate()}
                  loading={joinMutation.isPending}
                  className="px-8 py-3.5"
                >
                  Join discussion
                </Button>
              </div>
            ) : messages.length === 0 ? (
              /* ---------------------------- empty state --------------------------- */
              <div className="flex flex-col items-center gap-5 py-14 text-center sm:py-20">
                <motion.div
                  animate={{ rotate: [0, -4, 4, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  className="border-2 border-ink bg-brand-yellow p-6 shadow-brutal"
                >
                  <MessagesSquare className="size-12" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">
                    No responses yet.
                  </h2>
                  <p className="mt-1 text-sm text-muted">Be the first to share.</p>
                </div>
              </div>
            ) : (
              <ul className="flex flex-col gap-3 pt-8 sm:gap-4 sm:pt-0">
                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <StoryCard
                      key={message.id}
                      message={message}
                      onUpvote={vote}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>

        {/* --------------------- composer, or the posted notice -------------------- */}
        {joined && hasPosted && (
          <div
            className="shrink-0 border-t-2 border-ink bg-surface"
            style={composerPaddingStyle}
            role="status"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto flex w-full max-w-3xl items-center justify-center gap-3 px-4 py-4 sm:px-6"
            >
              <span className="flex size-9 shrink-0 items-center justify-center border-2 border-ink bg-brand-lime">
                <CheckCircle2 className="size-5" />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-sm font-black uppercase tracking-tight">
                  {postedEarlier
                    ? "You already shared your story."
                    : "Your response has been submitted."}
                </p>
                <p className="text-xs text-muted">
                  {postedEarlier
                    ? "Thank you for participating — you can vote for other stories."
                    : "You can now vote for other stories."}
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {joined && !hasPosted && (
          <div
            className="shrink-0 border-t-2 border-ink bg-surface"
            style={composerPaddingStyle}
          >
            <div className="mx-auto w-full max-w-3xl px-4 pb-3 pt-2 sm:px-6">
              <p className="mb-1.5 h-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                {typingLabel ?? (status === "connected" ? "" : "Reconnecting…")}
              </p>
              <form onSubmit={submit} className="flex items-end gap-2">
                <div className="flex flex-1 items-end border-2 border-ink bg-canvas focus-within:shadow-brutal-sm">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    onChange={(event) => handleDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) submit(event);
                    }}
                    placeholder="Share your story…"
                    aria-label="Your answer"
                    autoFocus={!COARSE_POINTER}
                    enterKeyHint="send"
                    /* 16px minimum — iOS zooms on focus below that. */
                    className="max-h-40 min-h-[3rem] w-full resize-none bg-transparent px-4 py-3 text-base outline-none placeholder:text-muted/60"
                  />
                </div>
                <motion.div whileTap={{ scale: 0.92 }} className="shrink-0">
                  <Button
                    type="submit"
                    disabled={!draft.trim() || status !== "connected"}
                    aria-label="Send"
                    className="h-[3rem] px-4"
                  >
                    <SendHorizonal className="size-4" />
                  </Button>
                </motion.div>
              </form>
            </div>
          </div>
        )}
      </main>

      <LeaderboardModal
        open={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        messages={messages}
        onUpvote={vote}
      />
    </div>
  );
}
