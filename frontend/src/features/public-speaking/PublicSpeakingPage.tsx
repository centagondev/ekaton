import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, SendHorizonal, Trophy, VenetianMask, WifiOff } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { BottomNav } from "@/components/layout/BottomNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { parseApiError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  DURATION,
  EASE_OUT_EXPO,
  listContainer,
  useMotionPrefs,
} from "@/lib/motion";
import {
  COARSE_POINTER,
  chatSurfaceStyle,
  composerPaddingStyle,
  useChatViewport,
} from "@/lib/useChatViewport";
import { publicSpeakingApi, type SpeakingMessage } from "./api";
import { byNewest } from "./ordering";
import { useSpeakingSocket } from "./useSpeakingSocket";
import { BackgroundStage } from "./components/BackgroundStage";
import { Nilavilakku, PookalamMandala } from "./components/Pookalam";
import { PookalamLoader, StorySkeleton } from "./components/PookalamLoader";
import { RankingModal } from "./components/RankingModal";
import { StoryCard } from "./components/StoryCard";
import { SubmittedDialog } from "./components/SubmittedDialog";
import onamBanner from "./assets/onam-banner.png";
import "./pookalam.css";

const MAX_LENGTH = 1000;
/** Where the counter starts mattering. */
const COUNTER_FROM = 800;

/** How far from the top a reader can be and still be auto-followed to a new story. */
const FOLLOW_THRESHOLD_PX = 120;

/** How long a newly arrived card keeps its highlight wash. */
const FRESH_MS = 2400;

/** Safety valve on the in-flight vote lock, if an ack never arrives. */
const VOTE_TIMEOUT_MS = 4000;

/** Socket vote frames are coalesced into one render per window. */
const VOTE_BATCH_MS = 120;

/** The banner's intrinsic size — supplied so it can never shift the layout. */
const BANNER = { width: 2172, height: 324 };

/* --------------------------------- header --------------------------------- */

/**
 * One pill recipe, used by every control in the bar.
 *
 * The previous version had four different heights (44 / 26 / 26 / 34px) and
 * four different border alphas (/10, /12, /25, /30) sitting on one line, which
 * is what made the cluster read as assorted rather than as a set. Height,
 * radius, border and label treatment are now decided once, here.
 *
 * `h-11` below `sm` is the 44px touch target; `sm:h-9` is the slimmer desktop
 * proportion, where a 44px pill in a 64px bar looks heavy.
 */
const PILL = "h-11 sm:h-9 shrink-0 rounded-full border border-ink-warm/12 shadow-rest";

/** The label recipe already established across this page. */
const PILL_LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.16em]";

/** Connection state, visible in every state of the page rather than only inside
 *  the composer — which is where it used to live, and therefore vanished the
 *  moment you posted and spent the rest of your session voting blind. */
function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        PILL,
        PILL_LABEL,
        "flex items-center gap-1.5 px-3",
        connected
          ? "border-leaf/25 bg-leaf/10 text-leaf-deep"
          : "border-vermilion/30 bg-vermilion/10 text-vermilion-deep",
      )}
      role="status"
    >
      {connected ? (
        <>
          {/* The only thing on this page permitted to loop forever. Leaf, not
              vermilion — vermilion is reserved for the two states that are
              genuinely wrong: a dropped socket, and the character counter
              running out. */}
          <span className="relative flex size-1.5 shrink-0">
            <span className="pk-breathe absolute inline-flex size-full rounded-full bg-leaf" />
            <span className="relative inline-flex size-1.5 rounded-full bg-leaf" />
          </span>
          <span className="hidden sm:inline">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="size-3 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Reconnecting</span>
        </>
      )}
    </span>
  );
}

/* ------------------------------- empty state ------------------------------- */

/**
 * Nothing has been said yet, so the lamp is unlit and the pookalam is only
 * beginning. It lights on mount — once — which makes the empty state the first
 * appearance of the motif rather than an apology for missing content.
 */
function EmptyWall({ onStart, canPost }: { onStart: () => void; canPost: boolean }) {
  const { reduced, spring } = useMotionPrefs();
  const [lit, setLit] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => setLit(true), 900);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  return (
    <div className="flex flex-col items-center py-12 text-center sm:py-16">
      <div className="relative mb-8 flex h-32 w-52 items-end justify-center">
        <motion.div
          className="absolute bottom-0 left-1/2 size-40 -translate-x-1/2"
          initial={reduced ? false : { scale: 0.4, opacity: 0, rotate: -40 }}
          animate={{ scale: 1, opacity: 0.9, rotate: 0 }}
          transition={{ duration: 1.4, ease: EASE_OUT_EXPO }}
        >
          <PookalamMandala className="size-full" />
        </motion.div>

        {/* No ambient float. An `Infinity` repeat is a JavaScript animation
            that never stops paying for itself; the flame's CSS flicker carries
            the life here on its own. */}
        <div className="relative z-10 -mb-2">
          <Nilavilakku lit={lit} className="h-28" />
        </div>
      </div>

      <h2 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-[-0.025em] text-ink-warm">
        The celebration starts with you
      </h2>
      <p className="mx-auto mt-2.5 max-w-sm text-[15px] leading-[1.55] text-ink-soft">
        {canPost
          ? "No name suggestions yet — share the first one and get the pookalam growing."
          : "No responses to show right now. Yours will appear here as the room fills up."}
      </p>

      {/* Offered only when there is actually a composer to send them to. */}
      {canPost && (
        <motion.button
          type="button"
          onClick={onStart}
          whileTap={reduced ? undefined : { scale: 0.96 }}
          transition={spring}
          className={cn(
            "group relative mt-7 flex items-center gap-2 rounded-full border border-amber-deep",
            "bg-festival-gold px-7 py-3.5 text-sm font-bold text-ink-warm shadow-rest",
            "transition-transform duration-200 hover:-translate-y-0.5",
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-glow transition-opacity duration-200 group-hover:opacity-100"
          />
          <span className="relative">Share the first response</span>
        </motion.button>
      )}
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function PublicSpeakingPage() {
  const { reduced, spring, snappy } = useMotionPrefs();

  const [messages, setMessages] = useState<SpeakingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Mirrors the server's has_posted; never the sole authority for it.
  const [hasPosted, setHasPosted] = useState(false);
  // True when the server said has_posted at join time — a returning visitor —
  // so the notice can thank them instead of confirming a submission they made
  // in some earlier session.
  const [postedEarlier, setPostedEarlier] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingStopRef = useRef<number | undefined>(undefined);
  const typingSentRef = useRef(false);

  /* ------------------------------ presentation ----------------------------- */

  const [historyLoading, setHistoryLoading] = useState(false);
  const [submittedOpen, setSubmittedOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sending, setSending] = useState(false);
  /** Ids of cards that arrived over the socket a moment ago. */
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  /** Ids with a vote in flight — the button is inert until the server answers. */
  const [pendingVotes, setPendingVotes] = useState<ReadonlySet<string>>(() => new Set());
  /** Bumped per message when the server rejects a vote, to trigger the shake. */
  const [rejections, setRejections] = useState<Record<string, number>>({});
  /**
   * Announcements for screen readers.
   *
   * Deliberately only the acting user's own results. Putting `aria-live` on
   * every card's count, as a literal reading of the spec would, turns a busy
   * room into a hundred unsolicited announcements a minute.
   */
  const [announcement, setAnnouncement] = useState("");

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
      setHistoryLoading(true);
      try {
        setMessages(byNewest(await publicSpeakingApi.messages()));
      } finally {
        setHistoryLoading(false);
      }
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
    setHistoryLoading(true);
    void publicSpeakingApi
      .messages()
      .then((rows) => setMessages(byNewest(rows)))
      // Without this the rejection was unhandled and the page fell straight
      // through to "No responses yet" — telling someone the room is empty
      // when the truth is that we could not read it.
      .catch((error) => toast.error(parseApiError(error).message))
      .finally(() => setHistoryLoading(false));
  }, [stateQuery.data]);

  /* ------------------------------ vote plumbing ---------------------------- */

  const voteTimers = useRef(new Map<string, number>());
  /**
   * The in-flight set, mirrored into a ref.
   *
   * `vote` must not change identity when a vote starts or finishes: it is the
   * `onUpvote` prop on every card, and a new function each time would defeat
   * the memoisation entirely and re-render the whole wall on every tap — the
   * exact cost the memo was added to remove.
   */
  const pendingRef = useRef(pendingVotes);
  useEffect(() => {
    pendingRef.current = pendingVotes;
  }, [pendingVotes]);

  /** Kept above the socket handlers, which restore it when a post is refused. */
  const lastDraft = useRef("");

  const clearPending = useCallback((messageId: string) => {
    const timer = voteTimers.current.get(messageId);
    if (timer) {
      window.clearTimeout(timer);
      voteTimers.current.delete(messageId);
    }
    setPendingVotes((current) => {
      if (!current.has(messageId)) return current;
      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
  }, []);

  useEffect(() => {
    const timers = voteTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  /* -------------------------------- socket -------------------------------- */

  const freshTimers = useRef(new Map<string, number>());

  const handleMessage = useCallback((incoming: SpeakingMessage) => {
    setMessages((current) =>
      current.some((message) => message.id === incoming.id)
        ? current
        : byNewest([...current, incoming]),
    );

    // A card that landed while you were watching announces itself, once.
    setFresh((current) => new Set(current).add(incoming.id));
    const timer = window.setTimeout(() => {
      setFresh((current) => {
        if (!current.has(incoming.id)) return current;
        const next = new Set(current);
        next.delete(incoming.id);
        return next;
      });
      freshTimers.current.delete(incoming.id);
    }, FRESH_MS);
    freshTimers.current.set(incoming.id, timer);
  }, []);

  useEffect(() => {
    const timers = freshTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  /**
   * A vote changes a count, not a position — the feed is in time order, so
   * there is nothing to re-sort. The ranking modal sorts its own copy.
   *
   * Frames are coalesced into one state write per 120ms window. A popular
   * response during a live talk produces bursts of `upvote` frames, and
   * applying each one separately meant a render per frame; last-write-wins per
   * message id is correct here because every frame carries the server's
   * absolute count rather than a delta.
   */
  const voteQueue = useRef(new Map<string, { count: number; mine?: boolean }>());
  const voteFlush = useRef<number | undefined>(undefined);

  const handleUpvote = useCallback(
    (messageId: string, count: number, mine?: boolean) => {
      // `mine` only ever arrives on the voter's own ack; a broadcast landing
      // afterwards must not erase it.
      const queued = voteQueue.current.get(messageId);
      voteQueue.current.set(messageId, { count, mine: mine ?? queued?.mine });

      if (mine !== undefined) clearPending(messageId);

      if (voteFlush.current !== undefined) return;
      voteFlush.current = window.setTimeout(() => {
        voteFlush.current = undefined;
        const batch = voteQueue.current;
        voteQueue.current = new Map();

        setMessages((current) =>
          current.map((message) => {
            const patch = batch.get(message.id);
            return patch
              ? {
                  ...message,
                  upvote_count: patch.count,
                  has_upvoted: patch.mine ?? message.has_upvoted,
                }
              : message;
          }),
        );
      }, VOTE_BATCH_MS);
    },
    [clearPending],
  );

  useEffect(
    () => () => {
      if (voteFlush.current !== undefined) window.clearTimeout(voteFlush.current);
    },
    [],
  );

  const { status, typingNames, sendMessage, sendUpvote, sendTyping } = useSpeakingSocket({
    enabled: joined,
    onMessage: handleMessage,
    onUpvote: handleUpvote,
    onPosted: useCallback((messageId: string | undefined) => {
      setHasPosted(true);
      setSending(false);
      setSubmittedOpen(true);
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
      setSending(false);
      // A rejection that means "you already answered" locks the composer in
      // place — no refresh — so a stale tab stops offering an input the server
      // will never accept.
      if (alreadyPosted) {
        setHasPosted(true);
        setPostedEarlier(true);
        toast.error("You have already submitted your response.");
        return;
      }
      // Hand the words back. The draft is cleared optimistically on send, and
      // losing a thousand characters to a rate limit is not a cost anyone
      // should pay for an animation.
      setDraft((current) => current || lastDraft.current);
      toast.error(message);
    }, []),
    // An optimistic vote the server refused: land the UI back on exactly what
    // the database holds, then explain.
    onVoteError: useCallback(
      (messageId: string, count: number, hasUpvoted: boolean, message: string) => {
        clearPending(messageId);
        voteQueue.current.delete(messageId);
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId
              ? { ...item, upvote_count: count, has_upvoted: hasUpvoted }
              : item,
          ),
        );
        setRejections((current) => ({
          ...current,
          [messageId]: (current[messageId] ?? 0) + 1,
        }));
        toast.error(message);
      },
      [clearPending],
    ),
  });

  const connected = status === "connected";

  // Optimistic voting: paint the vote before the network answers. Guards run
  // against a ref so the callback never goes stale mid-render.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

      // One vote in flight per message. The lock is released by the ack, the
      // error frame, or the timeout below — never left hanging.
      if (pendingRef.current.has(messageId)) return;
      setPendingVotes((current) => new Set(current).add(messageId));
      const timer = window.setTimeout(() => clearPending(messageId), VOTE_TIMEOUT_MS);
      voteTimers.current.set(messageId, timer);

      // A queued frame for this message is now stale — the local truth below
      // supersedes it until the server answers.
      voteQueue.current.delete(messageId);

      // Toggle, Reddit-style: painted optimistically in whichever direction,
      // reconciled by upvote_ack, rolled back by upvote_error.
      navigator.vibrate?.(target.has_upvoted ? 8 : 15);
      const adding = !target.has_upvoted;
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId
            ? {
                ...item,
                has_upvoted: !item.has_upvoted,
                upvote_count: item.upvote_count + (item.has_upvoted ? -1 : 1),
              }
            : item,
        ),
      );
      setAnnouncement(
        `${adding ? "Vote added" : "Vote removed"}. ${
          target.upvote_count + (adding ? 1 : -1)
        } votes.`,
      );
      sendUpvote(messageId);
    },
    [sendUpvote, status, clearPending],
  );

  useChatViewport();

  /* -------------------------------- scrolling ------------------------------ */

  // Newest-first means every arrival changes the head, so following it blindly
  // would yank anyone who had scrolled down to read. Follow only when they are
  // already parked at the top — the same courtesy a chat log extends to its
  // bottom edge.
  const headId = messages[0]?.id;
  useEffect(() => {
    if (!headId) return;
    const list = listRef.current;
    if (!list || list.scrollTop > FOLLOW_THRESHOLD_PX) return;
    list.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [headId, reduced]);

  /**
   * Drives the header's shadow and its 64 → 56px shrink.
   *
   * The window on this route never scrolls — the shell is pinned to the visual
   * viewport and only the feed moves — so this listens to the feed instead.
   * Coalesced to one read per frame, and `passive` so it can never delay a
   * scroll.
   *
   * The two thresholds are not a rounding detail, they are the whole reason
   * this works: shrinking the header makes the scroller 8px taller, which can
   * push `scrollTop` back under a single threshold and un-shrink it, which
   * makes it shorter again — a header that flickers forever at one scroll
   * position. Entering at 32px and leaving at 8px puts that feedback loop out
   * of reach.
   */
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      const y = root.scrollTop;
      setScrolled((current) => (current ? y > 8 : y > 32));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    read();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
    // Re-attaches once the loader lifts and this tree actually mounts — while
    // the query is pending `listRef` is still null, because the loader is what
    // is on screen.
  }, [joined, historyLoading]);

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
    if (!text || status !== "connected" || hasPosted || sending) return;
    lastDraft.current = text;
    setSending(true);
    sendMessage(text);
    setDraft("");
    window.clearTimeout(typingStopRef.current);
    if (typingSentRef.current) {
      sendTyping(false);
      typingSentRef.current = false;
    }
  };

  // If neither `posted` nor `error` ever arrives, the button must not stay
  // spinning for the rest of the session.
  useEffect(() => {
    if (!sending) return;
    const timer = window.setTimeout(() => setSending(false), 8000);
    return () => window.clearTimeout(timer);
  }, [sending]);

  useEffect(() => () => window.clearTimeout(typingStopRef.current), []);

  const typingLabel = useMemo(() => {
    if (typingNames.length === 0) return null;
    if (typingNames.length === 1) return `${typingNames[0]} is typing…`;
    return `${typingNames.length} people are typing…`;
  }, [typingNames]);

  const focusComposer = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  /* -------------------------------- render -------------------------------- */

  /**
   * The loader is a fallback, never a gate.
   *
   * It shows for exactly as long as the query takes and not one millisecond
   * longer. An earlier version also waited for the animation's own last beat,
   * which meant a page sitting behind a flower for up to 2.6s — on a database
   * that already costs ~80ms a query from here, and ~730ms on a cold
   * connection. Ceremony does not get to bill the user for time the data
   * wasn't taking anyway; the story simply plays as far as it gets.
   */
  if (discussionQuery.isPending) {
    return <PookalamLoader />;
  }

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
  const remaining = MAX_LENGTH - draft.length;

  return (
    /**
     * `reducedMotion="user"` is the belt to the braces of `useMotionPrefs`.
     *
     * Explicit gating covers the animations this code writes; it cannot cover
     * `layout`, which Framer drives internally and which otherwise slides
     * every card on the wall regardless of the visitor's preference. With this
     * set, Framer drops transform animations of its own accord and keeps
     * opacity — exactly the reduced-motion contract — for everything in the
     * subtree, including anything added later that forgets to ask.
     */
    <MotionConfig reducedMotion="user">
      <div
        className="theme-pookalam fixed inset-x-0 flex flex-col overflow-hidden"
        style={chatSurfaceStyle}
      >
        <BackgroundStage />

        {/* Only the acting user's own results are announced. */}
        <span aria-live="polite" className="sr-only">
          {announcement}
        </span>

        {/* -------------------------------- header ------------------------------- */}
        <header
          className="relative z-20 shrink-0"
          style={{
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
          }}
        >
          {/* "Content is passing under this edge" — a pre-rendered shadow whose
              opacity is the only thing that ever moves. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-300",
              scrolled ? "opacity-100" : "opacity-0",
            )}
            style={{ boxShadow: "0 10px 26px rgba(169,122,6,0.16)" }}
          />

          {/*
            Three zones: back | brand | status.

            Full-bleed rather than the old `max-w-3xl`, so the bar's left edge
            lines up with the full-width banner underneath it instead of
            floating in a 768px column over it.

            Height is declared, not emergent: 56px on mobile always, 64px on
            desktop shrinking to 56px once the feed is scrolled. The transition
            is on `height` alone — one reflow per state change, not per frame.
          */}
          <nav
            aria-label="Discussion"
            className={cn(
              "relative border-b border-ink-warm/[0.07] transition-[height] duration-300 ease-out",
              "h-14",
              scrolled ? "sm:h-14" : "sm:h-16",
            )}
            /* Translucent cream, deliberately without `backdrop-filter`. The
               bar does not overlap the feed — it is a flex sibling above its
               own scroll container — so a blur would sample nothing but the
               static background gradient behind it: visually identical to a
               flat tint, and a full-width re-blur every frame anything moved.
               The glass look, none of the glass cost. */
            style={{ backgroundColor: "rgba(255, 251, 240, 0.92)" }}
          >
            <div className="flex h-full items-center gap-2 px-3 sm:gap-2.5 sm:px-5">
              {/* ---------------------------- back ---------------------------- */}
              {/*
                Standalone, far left, and the only link in this bar.

                It used to be fused into the logo pill — one element that meant
                both "leave" and "Ekaton". That was done to avoid two screen
                reader stops pointing at the same route; splitting them is
                better on both counts, because the wordmark beside it is now
                plain text rather than a second link to the same place.
              */}
              <motion.div
                initial={reduced ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: DURATION.entrance, ease: EASE_OUT_EXPO }}
              >
                <Link
                  to="/home"
                  aria-label="Go back"
                  className={cn(
                    PILL,
                    PILL_LABEL,
                    "group flex items-center gap-2 bg-kasavu px-3 text-ink-warm sm:px-3.5",
                    "transition-[transform,background-color,border-color] duration-200 ease-out",
                    "hover:border-amber-deep/40 hover:bg-festival-gold/20 hover:-translate-y-px",
                    "active:scale-95",
                  )}
                >
                  <ArrowLeft
                    className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover:-translate-x-[3px]"
                    aria-hidden="true"
                  />
                  {/* Icon-only below `sm`; the pill keeps its 44px height, so
                      the target never shrinks with the label. */}
                  <span className="hidden sm:inline">Back</span>
                </Link>
              </motion.div>

              {/* ---------------------------- brand --------------------------- */}
              {/* Deliberately not a link. The control beside it already goes
                  home, and two adjacent links to one route is a tab stop and a
                  screen reader announcement nobody needs. */}
              <motion.div
                className="flex min-w-0 items-center gap-2"
                initial={reduced ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.entrance, delay: 0.07, ease: EASE_OUT_EXPO }}
              >
                <LogoMark className="size-7 shrink-0" />
                <span className="hidden text-[15px] font-black uppercase leading-none tracking-[-0.02em] text-ink-warm sm:inline">
                  Ekaton
                </span>
              </motion.div>

              {/* ---------------------------- status -------------------------- */}
              <motion.div
                className="ml-auto flex min-w-0 items-center gap-2"
                initial={reduced ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.entrance, delay: 0.14, ease: EASE_OUT_EXPO }}
              >
                {joined && <ConnectionPill connected={connected} />}

                {joined && displayName && (
                  <span
                    className={cn(
                      PILL,
                      "flex min-w-0 items-center gap-2 bg-kasavu pl-1.5 pr-1.5 sm:pr-3",
                    )}
                  >
                    {/* An initial block rather than a generic mask icon: below
                        `sm` the icon carried no information at all, where the
                        first letter of the handle at least identifies you. */}
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-festival-gold/35 text-[11px] font-black uppercase text-ink-warm sm:size-6"
                    >
                      {displayName.charAt(0)}
                    </span>
                    <span
                      className={cn(PILL_LABEL, "hidden max-w-36 truncate text-ink-soft sm:inline")}
                    >
                      {displayName}
                    </span>
                    <span className="sr-only sm:hidden">You are {displayName}</span>
                  </span>
                )}

                {/* Primary action in this cluster, and now present at every
                    breakpoint — it used to disappear below `sm` in favour of a
                    separately styled button floating over the feed, which was
                    two controls for one job. */}
                <motion.button
                  type="button"
                  onClick={() => setRankingOpen(true)}
                  whileTap={reduced ? undefined : { scale: 0.95 }}
                  whileHover={reduced ? undefined : { scale: 1.03 }}
                  transition={snappy}
                  aria-label="Responses ranked by votes"
                  className={cn(
                    PILL,
                    PILL_LABEL,
                    "group flex items-center gap-2 bg-festival-gold/25 px-3 text-ink-warm sm:px-3.5",
                    "transition-[background-color,border-color] duration-200 ease-out",
                    "hover:border-amber-deep/50 hover:bg-festival-gold/55",
                  )}
                >
                  <Trophy
                    className="size-4 shrink-0 transition-transform duration-200 ease-out group-hover:-rotate-[10deg] sm:size-3.5"
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">Ranking</span>
                </motion.button>
              </motion.div>
            </div>
          </nav>

          {/* The question is the event, never scrolled away. The real banner
              artwork replaces the hand-built version — it already bakes in the
              title/topic/how-it-works copy, so none of that is rendered as text
              here. That does mean this banner is static: it won't reflect a
              future discussion.title/topic change the way the old JSX version
              did, since the words are pixels now, not props.

              The artwork itself is untouched. What is new is the stage around
              it: a gold hairline, a soft glow beneath, and an entrance that
              makes it the first thing to arrive. */}
          <motion.div
            className="relative overflow-hidden border-y border-amber-deep/25 bg-festival-gold"
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.entrance, ease: EASE_OUT_EXPO }}
          >
            <img
              src={onamBanner}
              alt={`${discussion.title}: ${discussion.topic}`}
              width={BANNER.width}
              height={BANNER.height}
              /* Explicit intrinsic size reserves the box before the bytes land,
                 so the banner can never push the feed down as it decodes; it is
                 the largest paint on the page, hence the priority hint. */
              fetchPriority="high"
              decoding="async"
              /* The banner is a fixed ~6.7:1 strip — squeezed to a phone's full
                 width at its natural ratio, the text shrinks to ~50px tall and
                 becomes unreadable. Below `sm`, crop to a shorter box instead:
                 object-cover zooms into the centred text/badge/pill band and
                 lets the boat and sadhya art at the edges run off-canvas, which
                 reads far better on a phone than the whole strip shrunk down.
                 From `sm` up there's enough width to show the full artwork.
                 Capped at its own intrinsic width so an ultra-wide display gets
                 a centred poster rather than an upscaled, softened one. */
              className="mx-auto block h-24 w-full max-w-[2172px] object-cover object-center sm:h-auto"
            />
            {/* Soft warmth falling out of the bottom edge, tying the artwork to
                the page rather than letting it sit on top as a sticker. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -bottom-px h-6 bg-gradient-to-b from-transparent to-amber-deep/25"
            />
          </motion.div>

          {/* Kasavu accent — the sari-border gold line, once, under the banner.
              The single hard gold detail the background system allows itself;
              a sibling of the banner block, which itself stays untouched. */}
          <div aria-hidden="true" className="pk-kasavu-line" />
        </header>

        {/* --------------------------------- feed --------------------------------- */}
        <main className="relative flex min-h-0 flex-1 flex-col">
          {/* The mobile Ranking button used to float here, over the feed.
              Removed: Ranking is now in the navbar at every breakpoint, and two
              differently-styled controls for one action was the problem rather
              than the fix. Its departure also retires the `pt-8` offset the
              list carried purely to clear it. */}
          <div
            ref={listRef}
            className="scroll-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
          >
            {/* pt-3: the gap between the banner and the first row is dead
                space; the kasavu line already marks the transition. */}
            {/* One width rail, shared with the notice and the composer below.
                3xl up to laptop; wider from `lg` so a desktop reads as a
                desktop rather than a stretched phone column. */}
            <div className="mx-auto w-full max-w-3xl px-4 pb-5 pt-3 sm:px-6 lg:max-w-5xl xl:max-w-6xl">
              {!joined ? (
                /* ----------------------------- join gate ---------------------------- */
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.entrance, ease: EASE_OUT_EXPO }}
                  className="flex flex-col items-center gap-7 py-12 text-center sm:py-16"
                >
                  <div className="relative flex size-36 items-center justify-center">
                    <motion.div
                      className="absolute inset-0"
                      initial={reduced ? false : { scale: 0.5, opacity: 0, rotate: -50 }}
                      animate={{ scale: 1, opacity: 0.85, rotate: 0 }}
                      transition={{ duration: 1.3, ease: EASE_OUT_EXPO }}
                    >
                      <PookalamMandala className="size-full" />
                    </motion.div>
                    <motion.span
                      className="relative flex size-14 items-center justify-center rounded-full border-2 border-ink-warm bg-cream"
                      initial={reduced ? false : { scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ ...spring, delay: 0.3 }}
                    >
                      <VenetianMask className="size-7" aria-hidden="true" />
                    </motion.span>
                  </div>

                  <div>
                    <h2 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-[-0.025em] text-ink-warm">
                      Join anonymously
                    </h2>
                    <p className="mx-auto mt-2.5 max-w-xs text-[15px] leading-[1.55] text-ink-soft">
                      No account, no email. You'll be given a random name for this
                      session — share one response, then vote.
                    </p>
                  </div>

                  <motion.button
                    type="button"
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    whileTap={reduced ? undefined : { scale: 0.96 }}
                    transition={spring}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-full border border-amber-deep",
                      "bg-festival-gold px-8 py-3.5 text-sm font-bold text-ink-warm shadow-rest",
                      "transition-transform duration-200 hover:-translate-y-0.5",
                      "disabled:pointer-events-none disabled:opacity-60",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-glow transition-opacity duration-200 group-hover:opacity-100"
                    />
                    <span className="relative">
                      {joinMutation.isPending ? "Joining…" : "Join discussion"}
                    </span>
                  </motion.button>
                </motion.div>
              ) : historyLoading && messages.length === 0 ? (
                /* Skeletons, not a spinner — and not the empty state, which is
                   what used to flash here over a wall that was already full. */
                <div>
                  <StorySkeleton />
                </div>
              ) : messages.length === 0 ? (
                <EmptyWall onStart={focusComposer} canPost={!hasPosted} />
              ) : (
                <motion.ul
                  variants={listContainer}
                  initial="hidden"
                  animate="show"
                  className="flex list-none flex-col gap-2"
                >
                  <AnimatePresence>
                    {messages.map((message, index) => (
                      <StoryCard
                        key={message.id}
                        message={message}
                        index={index}
                        onUpvote={vote}
                        pending={pendingVotes.has(message.id)}
                        rejectedNonce={rejections[message.id] ?? 0}
                        fresh={fresh.has(message.id)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </div>
          </div>

          {/* --------------------- composer, or the posted notice -------------------- */}
          {/*
            Once posted, the mobile bottom edge becomes a native-feeling stack:
            the slim confirmation directly above the app's own BottomNav.

            The nav is the same component every AppLayout page mounts — this
            route lives outside AppLayout with the full-bleed chat screens, and
            that exclusion is correct for the *composer* state, where a fixed
            tab bar and the keyboard would fight over the same edge. In the
            posted state there is no input on the page at all, so the reason to
            exclude it is gone — and without it the only way off this page on a
            phone was the Back pill in the header. Mounting it here, in this
            state only, is what keeps the keyboard case impossible rather than
            merely handled.
          */}
          {joined && hasPosted && (
            <>
              <div
                className="pk-surface relative z-10 shrink-0 border-t border-ink-warm/[0.08] md:pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--chat-keyboard-inset,0px)))]"
                style={{
                  // Sides only. The bottom inset belongs to whichever element
                  // actually meets the home indicator: below `md` that is the
                  // nav (which pads for it itself), from `md` this bar — the
                  // class above. Keeping it inline here too would pad the strip
                  // twice on phones.
                  paddingLeft: "env(safe-area-inset-left)",
                  paddingRight: "env(safe-area-inset-right)",
                }}
                role="status"
              >
                <motion.div
                  /* Slides up only in the session where submission actually
                     happened. Arriving on the page already-posted renders the
                     bar simply *there* — re-playing an entrance on every visit
                     made a day-old fact look like breaking news. */
                  initial={reduced || postedEarlier ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.entrance, ease: EASE_OUT_EXPO }}
                  className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2.5 px-4 py-2.5 md:gap-3 md:px-6 md:py-4 lg:max-w-5xl xl:max-w-6xl"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-leaf/25 bg-leaf/10 text-leaf-deep md:size-9">
                    <CheckCircle2 className="size-4 md:size-5" aria-hidden="true" />
                  </span>
                  {/* One quiet line on phones, where the nav below already
                      carries the visual weight. */}
                  <p className="min-w-0 truncate text-[12.5px] font-medium text-ink-warm md:hidden">
                    {postedEarlier
                      ? "You already suggested a name — vote for your favourites!"
                      : "Name submitted — vote for your favourites!"}
                  </p>
                  <div className="hidden min-w-0 text-left md:block">
                    <p className="font-display text-[15px] font-extrabold tracking-[-0.01em] text-ink-warm">
                      {postedEarlier
                        ? "You already suggested a name for our Onam celebration."
                        : "Your name suggestion has been submitted."}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-soft">
                      {postedEarlier
                        ? "Thank you for taking part — now vote for the names you love."
                        : "Now vote for the names you love."}
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* In-flow stand-in for the fixed nav, so the notice rests on the
                  nav's top edge instead of underneath it. Deliberately not a
                  transformed wrapper around the nav itself: a transform would
                  turn the wrapper into the fixed element's containing block and
                  unpin it from the viewport. */}
              <div
                aria-hidden="true"
                className="h-[calc(4.25rem+env(safe-area-inset-bottom))] shrink-0 md:hidden"
              />
              <BottomNav />
            </>
          )}

          {joined && !hasPosted && (
            <div
              className="pk-surface relative z-10 shrink-0 border-t border-ink-warm/[0.08]"
              style={composerPaddingStyle}
            >
              <div className="mx-auto w-full max-w-3xl px-4 pb-3 pt-2 sm:px-6 lg:max-w-5xl xl:max-w-6xl">
                <div className="mb-1.5 flex h-4 items-center justify-between">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                    {typingLabel ?? (connected ? "" : "Reconnecting…")}
                  </p>
                  {/* Only once it starts to matter — a counter that is present
                      from the first keystroke reads as a limit being enforced
                      rather than an allowance being offered. */}
                  <AnimatePresence>
                    {draft.length >= COUNTER_FROM && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "font-mono text-[10px] font-bold tabular-nums",
                          remaining <= 40 ? "text-vermilion-deep" : "text-ink-soft",
                        )}
                      >
                        {remaining}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <form onSubmit={submit} className="flex items-end gap-2">
                  <div
                    className={cn(
                      "group relative flex flex-1 items-end rounded-pk-md border border-ink-warm/12 bg-cream",
                      "transition-colors duration-200 focus-within:border-amber-deep",
                    )}
                  >
                    {/* Focus glow, crossfaded. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-pk-md opacity-0 shadow-glow transition-opacity duration-200 group-focus-within:opacity-100"
                    />
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={draft}
                      onChange={(event) => handleDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) submit(event);
                      }}
                      /* Short enough to hold one line in the composer's single-
                         line rest height on a phone — the longer sentence
                         wrapped and clipped mid-word ("celebration…" sliced at
                         the bottom edge), which read as a rendering bug. */
                      placeholder="Suggest a name for Onam…"
                      aria-label="Your answer"
                      autoFocus={!COARSE_POINTER}
                      enterKeyHint="send"
                      /* 16px minimum — iOS zooms on focus below that. */
                      className="relative max-h-40 min-h-[3rem] w-full resize-none rounded-pk-md bg-transparent px-4 py-3 text-base text-ink-warm outline-none placeholder:text-ink-soft/85"
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={!draft.trim() || !connected || sending}
                    aria-label="Send"
                    whileTap={reduced ? undefined : { scale: 0.94 }}
                    transition={snappy}
                    className={cn(
                      "group relative flex h-[3rem] w-[3.25rem] shrink-0 items-center justify-center",
                      "rounded-pk-md border border-amber-deep bg-festival-gold text-ink-warm shadow-rest",
                      "transition-[transform,opacity] duration-200 hover:-translate-y-0.5",
                      "disabled:pointer-events-none disabled:opacity-45",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-pk-md opacity-0 shadow-glow transition-opacity duration-200 group-hover:opacity-100"
                    />
                    {sending ? (
                      // Three petal dots rather than a spinner — the wait belongs
                      // to the same family as everything else on the page.
                      <span className="relative flex items-center gap-1" aria-hidden="true">
                        {[0, 1, 2].map((dot) => (
                          <motion.span
                            key={dot}
                            className="block size-1.5 rounded-full bg-ink-warm"
                            animate={reduced ? undefined : { opacity: [0.25, 1, 0.25] }}
                            transition={{
                              duration: 0.9,
                              repeat: Infinity,
                              delay: dot * 0.15,
                              ease: "easeInOut",
                            }}
                          />
                        ))}
                      </span>
                    ) : (
                      <SendHorizonal className="relative size-4" aria-hidden="true" />
                    )}
                  </motion.button>
                </form>
              </div>
            </div>
          )}
        </main>

        <RankingModal
          open={rankingOpen}
          onClose={() => setRankingOpen(false)}
          messages={messages}
          onUpvote={vote}
          pendingVotes={pendingVotes}
          rejections={rejections}
        />

        <SubmittedDialog open={submittedOpen} onClose={() => setSubmittedOpen(false)} />
      </div>
    </MotionConfig>
  );
}
