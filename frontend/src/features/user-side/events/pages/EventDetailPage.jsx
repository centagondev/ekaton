import { useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Calendar, MapPin, Users, MessageSquare, ArrowLeft, Eye, EyeOff } from "lucide-react";

import { useEventsStore } from "../store/events.store";
import { useAuthStore } from "@/features/auth/store/auth.store";

const BANNERS = [
  { value: "banner_1", img: "/images/event/event1.jpg" },
  { value: "banner_2", img: "/images/event/event2.jpg" },
  { value: "banner_3", img: "/images/event/event3.jpg" },
  { value: "banner_4", img: "/images/event/event4.jpg" },
  { value: "banner_5", img: "/images/event/event5.jpg" },
  { value: "banner_6", img: "/images/event/event1.jpg" },
];

function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentEvent: event, loading, submitting, fetchEventById, joinEvent, leaveEvent, clearCurrentEvent } =
    useEventsStore();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (id) fetchEventById(id).catch(() => toast.error("Failed to load event."));
    // Clear currentEvent on unmount to avoid stale data flash on next visit
    return () => clearCurrentEvent();
  }, [id, fetchEventById, clearCurrentEvent]);

  const handleJoin = async () => {
    try {
      await joinEvent(id);
      toast.success("You joined the event!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not join event.");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveEvent(id);
      toast.success("You left the event.");
      navigate("/events");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not leave event.");
    }
  };

  const banner = BANNERS.find((b) => b.value === event?.banner) || BANNERS[0];
  const isOwner = user?.full_name === event?.owner;

  if (loading || !event) {
    return (
      <div className="min-h-dvh bg-[#FBF9F5] px-4 py-10 md:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="h-64 animate-pulse border-2 border-black bg-gray-200" />
          <div className="mt-6 space-y-4">
            <div className="h-8 w-1/2 animate-pulse bg-gray-200" />
            <div className="h-4 w-full animate-pulse bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#FBF9F5] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-4xl">
        {/* Back link */}
        <Link
          to="/events"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          All Events
        </Link>

        {/* Banner */}
        <div className="relative h-56 overflow-hidden border-2 border-black shadow-[5px_5px_0px_black]">
          <img
            src={banner.img}
            alt={event.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-4 left-4 flex gap-2">
            {event.is_anonymous_chat && (
              <span className="border-2 border-black bg-[#CCFF00] px-3 py-1 text-xs font-bold uppercase">
                Anonymous Chat
              </span>
            )}
            <span
              className={`border-2 border-black px-3 py-1 text-xs font-bold uppercase ${
                event.status === "active"
                  ? "bg-[#CCFF00] text-black"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {event.status}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left — info */}
          <div className="border-2 border-black bg-white p-6 shadow-[5px_5px_0px_black]">
            <h1 className="text-2xl font-black uppercase leading-tight md:text-3xl">
              {event.name}
            </h1>

            <div className="mt-4 flex flex-col gap-2 text-sm font-medium text-gray-600">
              <span className="flex items-center gap-2">
                <Calendar className="size-4 shrink-0" />
                Ends {formatDate(event.end_time)}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" />
                {event.venue}
              </span>
              <span className="flex items-center gap-2">
                <Users className="size-4 shrink-0" />
                {event.participant_count ?? "—"} participants
              </span>
              <span className="flex items-center gap-2">
                {event.is_anonymous_chat ? (
                  <EyeOff className="size-4 shrink-0" />
                ) : (
                  <Eye className="size-4 shrink-0" />
                )}
                {event.is_anonymous_chat ? "Anonymous chat" : "Identity-revealed chat"}
              </span>
            </div>

            <div className="mt-4 border-t-2 border-black pt-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">
                About
              </h2>
              <p className="text-sm font-medium leading-relaxed text-gray-700">
                {event.description}
              </p>
            </div>

            <div className="mt-4 border-t-2 border-black pt-4">
              <p className="text-xs font-medium text-gray-500">
                Organized by{" "}
                <span className="font-bold text-black">{event.owner}</span>
              </p>
            </div>
          </div>

          {/* Right — actions */}
          <div className="flex flex-col gap-4">
            {/* Join / Leave */}
            {event.status === "active" && (
              <div className="border-2 border-black bg-white p-5 shadow-[5px_5px_0px_black]">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest">
                  Participation
                </h3>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleJoin}
                    disabled={submitting || isOwner}
                    className="border-2 border-black bg-[#FFDE00] px-6 py-3 font-extrabold uppercase tracking-wider text-black shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Joining…" : "Join Event"}
                  </button>
                  <button
                    onClick={handleLeave}
                    disabled={submitting || isOwner}
                    className="border-2 border-black bg-white px-6 py-3 font-extrabold uppercase tracking-wider text-black hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Leaving…" : "Leave Event"}
                  </button>
                </div>
                {isOwner && (
                  <p className="mt-3 text-xs font-medium text-gray-500">
                    You own this event.
                  </p>
                )}
              </div>
            )}

            {/* Chat Room */}
            <div className="border-2 border-black bg-[#E8EBFF] p-5 shadow-[5px_5px_0px_black]">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-widest">
                Group Chat
              </h3>
              <p className="mb-3 text-xs font-medium text-gray-600">
                {event.is_anonymous_chat
                  ? "Chat anonymously with event participants."
                  : "Chat with other participants by name."}
              </p>
              <Link
                to={`/events/${id}/chat`}
                className="flex items-center justify-center gap-2 border-2 border-black bg-black px-4 py-3 font-extrabold uppercase tracking-wider text-white shadow-[4px_4px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.3)] transition-all"
              >
                <MessageSquare className="size-4" />
                Enter Chat Room
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;
