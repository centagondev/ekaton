import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  MessageSquare,
  Clock,
  ChevronRight,
  RefreshCw,
  History,
  UserCheck,
  XCircle,
} from "lucide-react";

import { getChatHistoryApi } from "../api/chat.api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (isoString) => {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getDuration = (start, end) => {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  if (ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

const STATUS_LABEL = {
  active: { label: "ACTIVE", bg: "bg-[#CCFF00]", dot: "bg-emerald-500" },
  ended: { label: "ENDED", bg: "bg-gray-100", dot: "bg-gray-400" },
  waiting: { label: "WAITING", bg: "bg-[#FFDE00]", dot: "bg-yellow-500" },
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ onStart }) => (
  <div className="flex flex-col items-center gap-6 py-20 text-center">
    <div className="border-2 border-black bg-[#E8EBFF] p-6 shadow-[5px_5px_0px_black]">
      <MessageSquare size={48} strokeWidth={2.5} />
    </div>
    <div>
      <h2 className="text-xl font-black uppercase tracking-wide">
        No Conversations Yet
      </h2>
      <p className="mt-2 text-sm font-medium text-gray-500">
        Your anonymous chats will appear here after you end a session.
      </p>
    </div>
    <button
      id="history-start-chat-btn"
      onClick={onStart}
      className="border-2 border-black bg-[#FFDE00] px-8 py-3 font-extrabold uppercase tracking-wider shadow-[5px_5px_0px_black] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_black] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none"
    >
      Start a Chat
    </button>
  </div>
);

// ─── Error State ──────────────────────────────────────────────────────────────

const ErrorState = ({ onRetry }) => (
  <div className="flex flex-col items-center gap-5 py-20 text-center">
    <div className="border-2 border-black bg-red-50 p-6 shadow-[5px_5px_0px_black]">
      <XCircle size={48} className="text-red-600" strokeWidth={2.5} />
    </div>
    <div>
      <h2 className="text-xl font-black uppercase tracking-wide">
        Failed to Load History
      </h2>
      <p className="mt-2 text-sm font-medium text-gray-500">
        Couldn't fetch your past conversations. Please try again.
      </p>
    </div>
    <button
      id="history-retry-btn"
      onClick={onRetry}
      className="flex items-center gap-2 border-2 border-black bg-white px-6 py-3 font-bold uppercase tracking-wider shadow-[4px_4px_0px_black] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black]"
    >
      <RefreshCw size={16} />
      Retry
    </button>
  </div>
);

// ─── Skeleton Card ────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="animate-pulse border-2 border-black bg-white shadow-[4px_4px_0px_black]">
    <div className="flex items-center gap-4 p-4">
      <div className="h-12 w-12 border-2 border-black bg-[#E8EBFF]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 bg-gray-200" />
        <div className="h-3 w-1/2 bg-gray-100" />
      </div>
      <div className="h-6 w-16 bg-gray-100" />
    </div>
  </div>
);

// ─── Chat History Card ────────────────────────────────────────────────────────

const HistoryCard = ({ room }) => {
  const status = STATUS_LABEL[room.status] ?? STATUS_LABEL.ended;
  const duration = getDuration(room.created_at, room.closed_at);
  const shortId = room.id?.slice(0, 8)?.toUpperCase() ?? "—";

  return (
    <div
      id={`history-card-${room.id}`}
      className="group border-2 border-black bg-white shadow-[4px_4px_0px_black] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black]"
    >
      <div className="flex items-center gap-4 p-4">
        {/* Avatar */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black bg-[#E8EBFF]">
          <MessageSquare size={22} strokeWidth={2.5} />
          {/* Online dot if active */}
          {room.status === "active" && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-black uppercase tracking-wide text-sm">
              {room.reveal_completed ? "Revealed Stranger" : "Anonymous Stranger"}
            </p>
            {room.reveal_completed && (
              <span className="flex items-center gap-0.5 border border-black bg-[#CCFF00] px-1.5 py-0.5 text-[10px] font-bold uppercase shadow-[1px_1px_0px_black]">
                <UserCheck size={10} />
                Revealed
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <Clock size={11} />
            {formatDate(room.created_at)} · {formatTime(room.created_at)}
            {duration && (
              <span className="text-gray-400">· {duration}</span>
            )}
          </p>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            ID: {shortId}
          </p>
        </div>

        {/* Status badge */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`flex items-center gap-1.5 border border-black px-2 py-1 text-[10px] font-bold uppercase tracking-widest shadow-[1px_1px_0px_black] ${status.bg}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Arrow */}
        <ChevronRight
          size={18}
          className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-1"
        />
      </div>
    </div>
  );
};

// ─── Stats Bar ────────────────────────────────────────────────────────────────

const StatsBar = ({ rooms }) => {
  const total = rooms.length;
  const revealed = rooms.filter((r) => r.reveal_completed).length;
  const ended = rooms.filter((r) => r.status === "ended").length;

  const stats = [
    { label: "Total Chats", value: total, bg: "bg-[#E8EBFF]" },
    { label: "Identities Revealed", value: revealed, bg: "bg-[#CCFF00]" },
    { label: "Ended", value: ended, bg: "bg-gray-100" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`border-2 border-black ${s.bg} p-3 shadow-[3px_3px_0px_black] text-center`}
        >
          <p className="text-2xl font-black">{s.value}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 leading-tight mt-0.5">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
};

// ─── HistoryPage ──────────────────────────────────────────────────────────────

const HistoryPage = () => {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getChatHistoryApi();
      // Support both { data: [...] } and { data: { results: [...] } } (paginated)
      const payload = res.data?.data ?? res.data;
      const list = Array.isArray(payload)
        ? payload
        : payload?.results ?? [];
      setRooms(list);
    } catch (err) {
      console.error("[HistoryPage] fetch error:", err);
      // If the endpoint doesn't exist yet (404), show empty rather than error
      if (err?.response?.status === 404) {
        setRooms([]);
      } else {
        setError(true);
        toast.error("Could not load chat history.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="min-h-dvh bg-[#FBF9F5]">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="border-b-2 border-black bg-white px-4 py-5 shadow-[0_3px_0_black] sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="border-2 border-black bg-[#FFDE00] p-2 shadow-[3px_3px_0px_black]">
                <History size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wide">
                  Chat History
                </h1>
                <p className="text-xs font-medium text-gray-500">
                  Your past anonymous conversations
                </p>
              </div>
            </div>

            {/* Refresh */}
            <button
              id="history-refresh-btn"
              onClick={fetchHistory}
              disabled={loading}
              className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-xs font-bold uppercase shadow-[3px_3px_0px_black] transition-all duration-150 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_black] disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && <ErrorState onRetry={fetchHistory} />}

        {/* Empty */}
        {!loading && !error && rooms.length === 0 && (
          <EmptyState onStart={() => navigate("/connecting")} />
        )}

        {/* List */}
        {!loading && !error && rooms.length > 0 && (
          <>
            <StatsBar rooms={rooms} />

            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
                {rooms.length} conversation{rooms.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {rooms.map((room) => (
                <HistoryCard key={room.id} room={room} />
              ))}
            </div>
          </>
        )}

        {/* CTA */}
        {!loading && !error && (
          <div className="mt-8 border-2 border-black bg-white p-5 shadow-[4px_4px_0px_black]">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black uppercase tracking-wide">
                  Ready for a new chat?
                </p>
                <p className="text-sm font-medium text-gray-500">
                  Start an anonymous conversation with a random student.
                </p>
              </div>
              <button
                id="history-new-chat-btn"
                onClick={() => navigate("/connecting")}
                className="shrink-0 border-2 border-black bg-[#FFDE00] px-6 py-2.5 font-extrabold uppercase tracking-wider shadow-[4px_4px_0px_black] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
              >
                New Chat →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
