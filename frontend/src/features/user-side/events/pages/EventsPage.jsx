import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  MessageSquare,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useEventsStore } from "../store/events.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { ROUTES } from "@/app/router/rootPaths";

// ── Banner options (matches backend EventBanner choices) ─────────────────────
const BANNERS = [
  { value: "banner_1", img: "/images/event/event1.jpg" },
  { value: "banner_2", img: "/images/event/event2.jpg" },
  { value: "banner_3", img: "/images/event/event3.jpg" },
  { value: "banner_4", img: "/images/event/event4.jpg" },
  { value: "banner_5", img: "/images/event/event5.jpg" },
  { value: "banner_6", img: "/images/event/event1.jpg" },
];

// ── Validation schema ─────────────────────────────────────────────────────────
const eventSchema = yup.object({
  name: yup.string().trim().required("Event name is required"),
  description: yup.string().trim().required("Description is required"),
  venue: yup.string().trim().required("Venue / location is required"),
  end_time: yup
    .string()
    .required("End time is required")
    .test("future", "End time must be in the future", (val) => {
      if (!val) return false;
      return new Date(val) > new Date();
    }),
  banner: yup.string().required("Please select a banner"),
  is_anonymous_chat: yup.boolean().default(false),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusBadge(status) {
  const map = {
    active: "bg-[#CCFF00] text-black",
    ended: "bg-gray-200 text-gray-600",
    cancelled: "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100";
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────
function EventFormModal({ onClose, editEvent = null }) {
  const { createEvent, updateEvent, submitting } = useEventsStore();
  const [selectedBanner, setSelectedBanner] = useState(editEvent?.banner || "banner_1");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(eventSchema),
    defaultValues: {
      name: editEvent?.name || "",
      description: editEvent?.description || "",
      venue: editEvent?.venue || "",
      end_time: editEvent?.end_time
        ? new Date(editEvent.end_time).toISOString().slice(0, 16)
        : "",
      banner: editEvent?.banner || "banner_1",
      is_anonymous_chat: editEvent?.is_anonymous_chat ?? false,
    },
  });

  const onSubmit = async (data) => {
    // Convert local datetime to ISO string
    const payload = {
      ...data,
      end_time: new Date(data.end_time).toISOString(),
    };
    try {
      if (editEvent) {
        await updateEvent(editEvent.id, payload);
        toast.success("Event updated!");
      } else {
        await createEvent(payload);
        toast.success("Event created!");
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || "Something went wrong.";
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg border-2 border-black bg-white shadow-[6px_6px_0px_black] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black px-5 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-5" />
            <div>
              <h2 className="font-extrabold uppercase tracking-tight">
                {editEvent ? "Edit Event" : "Create New Event"}
              </h2>
              <p className="text-xs font-medium text-gray-500">
                {editEvent
                  ? "Modify your campus event details."
                  : "Quickly set up your campus event."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center border-2 border-black bg-white font-extrabold shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] active:shadow-none transition-all"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 p-6">
          {/* Banner selector */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Event Banner
            </label>
            {/* Banner preview thumbnails */}
            <div className="flex gap-2 flex-wrap">
              {BANNERS.slice(0, 3).map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => {
                    setSelectedBanner(b.value);
                    setValue("banner", b.value);
                  }}
                  className={`h-14 w-20 overflow-hidden border-2 transition-all ${
                    selectedBanner === b.value
                      ? "border-black shadow-[2px_2px_0px_black]"
                      : "border-gray-300 opacity-60"
                  }`}
                >
                  <img src={b.img} alt={b.value} className="h-full w-full object-cover" />
                </button>
              ))}
              {/* Upload placeholder */}
              <div className="flex h-14 w-20 items-center justify-center border-2 border-dashed border-gray-400 text-gray-400">
                <div className="text-center text-[10px]">
                  <div className="text-lg">↑</div>
                  Upload
                </div>
              </div>
            </div>
            {errors.banner && (
              <p className="text-xs font-bold text-red-500">{errors.banner.message}</p>
            )}
          </div>

          {/* Event Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Event Name
            </label>
            <input
              type="text"
              placeholder="e.g. Annual Networking Gala"
              className="border-2 border-black bg-white px-4 py-3 font-medium text-black focus:outline-none"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs font-bold text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Description
            </label>
            <textarea
              rows={4}
              placeholder="Tell students what this event is about..."
              className="border-2 border-black bg-white px-4 py-3 font-medium text-black focus:outline-none resize-none"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs font-bold text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Venue */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Venue / Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search for a location..."
                className="w-full border-2 border-black bg-white pl-9 pr-4 py-3 font-medium text-black focus:outline-none"
                {...register("venue")}
              />
            </div>
            {errors.venue && (
              <p className="text-xs font-bold text-red-500">{errors.venue.message}</p>
            )}
          </div>

          {/* End Time */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              End Date &amp; Time
            </label>
            <input
              type="datetime-local"
              className="border-2 border-black bg-white px-4 py-3 font-medium text-black focus:outline-none"
              {...register("end_time")}
            />
            {errors.end_time && (
              <p className="text-xs font-bold text-red-500">{errors.end_time.message}</p>
            )}
          </div>

          {/* Anonymous Chat Toggle */}
          <div className="flex items-center justify-between border-2 border-black px-4 py-3">
            <div>
              <p className="text-sm font-bold">Enable Anonymous Chat</p>
              <p className="text-xs font-medium text-gray-500">
                Allow students to discuss this event privately.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                {...register("is_anonymous_chat")}
              />
              <div className="peer h-6 w-11 rounded-full border-2 border-black bg-gray-200 peer-checked:bg-black transition-colors" />
              <div className="absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white border border-gray-400 transition-all peer-checked:left-6" />
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border-2 border-black bg-white px-4 py-3 font-extrabold uppercase tracking-wider text-black hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 border-2 border-black bg-[#FFDE00] px-4 py-3 font-extrabold uppercase tracking-wider text-black shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving…" : editEvent ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ eventName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm border-2 border-black bg-white p-6 shadow-[6px_6px_0px_black]">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="size-6 text-red-500" />
          <h2 className="text-lg font-extrabold uppercase">Delete Event?</h2>
        </div>
        <p className="mb-6 text-sm font-medium text-gray-600">
          Are you sure you want to delete{" "}
          <span className="font-bold text-black">"{eventName}"</span>? This action is
          permanent and will remove all associated chat history and registrations. This
          cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border-2 border-black bg-white px-4 py-3 font-extrabold uppercase tracking-wider hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 border-2 border-black bg-red-500 px-4 py-3 font-extrabold uppercase tracking-wider text-white shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:shadow-none transition-all disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Yes, Delete Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────────────────────────
function EventCard({ event, isOwner, onEdit, onDelete }) {
  const banner = BANNERS.find((b) => b.value === event.banner) || BANNERS[0];

  return (
    <div className="flex flex-col border-2 border-black bg-white shadow-[5px_5px_0px_black]">
      {/* Banner */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={banner.img}
          alt={event.name}
          className="h-full w-full object-cover"
        />
        {event.is_anonymous_chat && (
          <span className="absolute left-2 top-2 border-2 border-black bg-[#CCFF00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            Anonymous
          </span>
        )}
        {isOwner && (
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              onClick={() => onEdit(event)}
              className="flex size-7 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] transition-all"
            >
              <Pencil className="size-3" />
            </button>
            <button
              onClick={() => onDelete(event)}
              className="flex size-7 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] transition-all"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-extrabold uppercase leading-tight">{event.name}</h3>
          <span
            className={`shrink-0 border-2 border-black px-2 py-0.5 text-[10px] font-bold uppercase ${statusBadge(
              event.status
            )}`}
          >
            {event.status}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-xs font-medium text-gray-600">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {formatDate(event.end_time)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            {event.venue}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t-2 border-black pt-3">
          <span className="flex items-center gap-1 text-xs font-bold">
            <Users className="size-3.5" />
            {event.participant_count ?? "—"} Joining
          </span>

          <Link
            to={`/events/${event.id}/chat`}
            className="flex items-center gap-1 border-2 border-black bg-white px-3 py-1.5 text-xs font-extrabold uppercase shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] transition-all"
          >
            <MessageSquare className="size-3" />
            Chat Room
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Featured / Hero Event ─────────────────────────────────────────────────────
function HeroEvent({ event, isOwner, onEdit, onDelete }) {
  const banner = BANNERS.find((b) => b.value === event.banner) || BANNERS[0];

  return (
    <div className="mb-8 flex border-2 border-black bg-[#FFDE00] shadow-[6px_6px_0px_black] relative">
      <div className="hidden w-64 shrink-0 overflow-hidden border-r-2 border-black md:block">
        <img
          src={banner.img}
          alt={event.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-6">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-2xl font-black uppercase leading-tight">{event.name}</h2>
            {/* Owner controls */}
            {isOwner && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onEdit(event)}
                  title="Edit event"
                  className="flex size-8 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] transition-all"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => onDelete(event)}
                  title="Delete event"
                  className="flex size-8 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_black] transition-all"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-medium">
            <span className="border-2 border-black bg-white px-3 py-1">
              ⏰ Ends {formatDate(event.end_time)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-4" />
              {event.participant_count ?? "—"} students joined
            </span>
          </div>
        </div>
        <Link
          to={`/events/${event.id}/chat`}
          className="self-end border-2 border-black bg-black px-6 py-3 font-extrabold uppercase tracking-wider text-white shadow-[4px_4px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.3)] transition-all"
        >
          Join Now
        </Link>
      </div>
    </div>
  );
}

// ── Main EventsPage ───────────────────────────────────────────────────────────
const EventsPage = () => {
  const { events, loading, fetchEvents, cancelEvent, submitting } = useEventsStore();
  const user = useAuthStore((state) => state.user);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deletingEvent, setDeletingEvent] = useState(null);

  useEffect(() => {
    fetchEvents().catch(() => {});
  }, [fetchEvents]);

  const handleDelete = async () => {
    if (!deletingEvent) return;
    try {
      await cancelEvent(deletingEvent.id);
      toast.success("Event cancelled.");
      setDeletingEvent(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel event.");
    }
  };

  const activeEvents = events.filter((e) => e.status === "active");
  const heroEvent = activeEvents[0] ?? null;
  const gridEvents = activeEvents.slice(1);

  return (
    <div className="min-h-dvh bg-[#FBF9F5] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div className="border-l-4 border-black pl-4">
            <h1 className="text-4xl font-black uppercase leading-none md:text-5xl">
              Campus
              <br />
              Events
            </h1>
            <p className="mt-2 text-sm font-medium text-gray-500">
              Discover, Join, and Connect with Students.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 border-2 border-black bg-[#FFDE00] px-5 py-3 font-extrabold uppercase tracking-wider text-black shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all duration-150"
          >
            <Plus className="size-4" />
            Create Event
          </button>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-28">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Loading Events…
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && activeEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Calendar className="size-16 text-gray-300" />
            <h3 className="text-xl font-extrabold uppercase">No Events Yet</h3>
            <p className="text-sm font-medium text-gray-500">
              Be the first to create a campus event!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="border-2 border-black bg-[#FFDE00] px-6 py-3 font-extrabold uppercase shadow-[4px_4px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_black] transition-all"
            >
              Create First Event
            </button>
          </div>
        )}

        {/* Hero event */}
        {!loading && heroEvent && (
          <HeroEvent
            event={heroEvent}
            isOwner={user?.full_name === heroEvent.owner}
            onEdit={(e) => setEditingEvent(e)}
            onDelete={(e) => setDeletingEvent(e)}
          />
        )}

        {/* Events grid */}
        {!loading && gridEvents.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gridEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isOwner={user?.full_name === event.owner}
                onEdit={(e) => setEditingEvent(e)}
                onDelete={(e) => setDeletingEvent(e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {(showCreateModal || editingEvent) && (
        <EventFormModal
          editEvent={editingEvent}
          onClose={() => {
            setShowCreateModal(false);
            setEditingEvent(null);
          }}
        />
      )}

      {deletingEvent && (
        <DeleteConfirmModal
          eventName={deletingEvent.name}
          loading={submitting}
          onConfirm={handleDelete}
          onCancel={() => setDeletingEvent(null)}
        />
      )}
    </div>
  );
};

export default EventsPage;
