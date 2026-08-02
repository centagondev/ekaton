import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarX2,
  LogIn,
  MapPin,
  MessageSquare,
  Pencil,
  Timer,
  Users,
  VenetianMask,
} from "lucide-react";
import { eventsApi } from "@/lib/api/events";
import { parseApiError } from "@/lib/errors";
import { cursorFromUrl, formatDateTime, timeUntil } from "@/lib/utils";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventBannerArt, EventFormModal, rememberEventIdentity } from "./event-shared";
import type { EventStatus } from "@/types/api";

const STATUS_META: Record<EventStatus, { label: string; tone: "lime" | "neutral" | "danger" }> = {
  active: { label: "Live", tone: "lime" },
  ended: { label: "Ended", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export function EventDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** Non-anonymous events reveal your real name, so they ask first. */
  const [confirmIdentity, setConfirmIdentity] = useState(false);

  const detail = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsApi.detail(id),
    enabled: Boolean(id),
  });

  const event = detail.data;
  const isActive =
    event?.status === "active" && new Date(event.end_time).getTime() > Date.now();
  // Authoritative flag from the API. The old `owner === user.full_name`
  // comparison broke for duplicate names, and cannot work at all now that
  // anonymous events hide the owner's real name.
  const isOwner = Boolean(event?.is_owner);

  /**
   * Membership probe: the messages endpoint 404s unless you are an active
   * participant — there is no dedicated "am I joined?" endpoint.
   */
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
  /** Membership still being probed — neither "joined" nor "not joined" yet. */
  const historyLoading = !joined && !notJoined && Boolean(isActive);

  /**
   * This page exists only to help you decide whether to join. Once you are a
   * participant it has nothing left to say, so it steps aside rather than
   * making you click through a page you have already read.
   *
   * The owner is the exception, and has to be: Edit and Cancel render here and
   * nowhere else in the app. Redirecting the host into their own chat room
   * meant that from the moment they joined — which is every visit after the
   * first, on every device and after every fresh login — there was no route
   * left to their own controls. Hosting is a reason to stay on this page, not
   * to be sent past it.
   */
  useEffect(() => {
    if (joined && isActive && !isOwner) navigate(`/events/${id}/chat`, { replace: true });
  }, [joined, isActive, isOwner, id, navigate]);

  const joinMutation = useMutation({
    mutationFn: () => eventsApi.join(id),
    onSuccess: (participant) => {
      rememberEventIdentity(id, participant);
      void queryClient.invalidateQueries({ queryKey: ["events", id] });
      toast.success(
        event?.is_anonymous_chat && participant.display_name
          ? `You're in as "${participant.display_name}"`
          : "You're in!",
      );
      // Joining IS the intent to chat — go straight there.
      navigate(`/events/${id}/chat`, { replace: true });
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      // "You have already joined this event." — already in, so proceed.
      if (parsed.message.toLowerCase().includes("already joined")) {
        navigate(`/events/${id}/chat`, { replace: true });
        return;
      }
      toast.error(parsed.message);
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
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => eventsApi.cancel(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event cancelled.");
      navigate("/events");
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  if (detail.isLoading) {
    return (
      <PageTransition className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </PageTransition>
    );
  }

  if (detail.isError || !event) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="Event not found"
        description="It may have been removed."
        action={<Button onClick={() => navigate("/events")}>Back to events</Button>}
      />
    );
  }

  const statusMeta = STATUS_META[event.status];

  return (
    <PageTransition>
      <BackButton fallback="/events" label="All events" className="mb-6" />

      <div className="mx-auto max-w-3xl">
        <div className="border-2 border-ink bg-surface shadow-brutal">
          <EventBannerArt banner={event.banner} natural />
          <div className="p-6 sm:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
              {event.is_anonymous_chat && (
                <Badge tone="lavender">
                  <VenetianMask className="size-3" /> Anonymous chat
                </Badge>
              )}
              <Badge tone="neutral">
                <Users className="size-3" /> {event.participant_count} joined
              </Badge>
            </div>

            <h1 className="mb-3 text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              {event.name}
            </h1>
            <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed">
              {event.description}
            </p>

            <div className="mb-6 space-y-2 font-mono text-xs uppercase tracking-wider text-muted">
              <p className="flex items-center gap-2">
                <MapPin className="size-4" /> {event.venue}
              </p>
              <p className="flex items-center gap-2">
                <Timer className="size-4" /> Ends {formatDateTime(event.end_time)} (
                {timeUntil(event.end_time)})
              </p>
              {/* Anonymity has to hold here too — the host is a participant. */}
              <p>Hosted by {event.is_anonymous_chat ? "Anonymous host" : event.owner}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              {isActive && (notJoined || historyLoading) && (
                <Button
                  size="lg"
                  onClick={() =>
                    // Anonymous events carry no disclosure risk, so they skip
                    // the prompt entirely.
                    event.is_anonymous_chat
                      ? joinMutation.mutate()
                      : setConfirmIdentity(true)
                  }
                  loading={joinMutation.isPending || historyLoading}
                >
                  <LogIn className="size-4" /> Join event
                </Button>
              )}
              {/* The way back into a room you are already in. Only the host
                  ever sees it — everyone else is redirected above before this
                  renders — but it is keyed on membership rather than on
                  ownership, because "already joined" is what it acts on. */}
              {isActive && joined && (
                <Button size="lg" onClick={() => navigate(`/events/${id}/chat`)}>
                  <MessageSquare className="size-4" /> Open chat
                </Button>
              )}
              {isOwner && isActive && (
                <>
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    <Pencil className="size-4" /> Edit
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                    <CalendarX2 className="size-4" /> Cancel event
                  </Button>
                </>
              )}
            </div>

            {!isActive && (
              <p className="mt-4 border-2 border-ink bg-raised px-4 py-3 text-sm text-muted">
                This event is over — the room is closed.
              </p>
            )}
          </div>
        </div>
      </div>

      <EventFormModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["events", id] });
        }}
        event={event}
      />

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel this event?">
        <p className="mb-5 text-sm text-muted">
          This closes the event for everyone and can't be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
            Keep it running
          </Button>
          <Button variant="danger" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
            Cancel event
          </Button>
        </div>
      </Modal>

      {/* Joining a public event exposes your real name — asked once, here,
          rather than as a separate page. */}
      <Modal
        open={confirmIdentity}
        onClose={() => setConfirmIdentity(false)}
        title="This event is not anonymous"
      >
        <p className="mb-2 text-sm">
          Other participants will be able to see your{" "}
          <span className="bg-brand-yellow px-1 font-bold">real identity</span> in this
          chat.
        </p>
        <p className="mb-5 text-sm text-muted">
          Your name will be shown on every message you send. Are you sure you want to
          join?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmIdentity(false)}>
            Cancel
          </Button>
          <Button
            loading={joinMutation.isPending}
            onClick={() => {
              setConfirmIdentity(false);
              joinMutation.mutate();
            }}
          >
            <LogIn className="size-4" /> Join event
          </Button>
        </div>
      </Modal>

      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave this event?">
        <p className="mb-5 text-sm text-muted">
          You can rejoin later{event.is_anonymous_chat ? " — you'll keep the same alias" : ""}.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button variant="danger" loading={leaveMutation.isPending} onClick={() => leaveMutation.mutate()}>
            Leave
          </Button>
        </div>
      </Modal>
    </PageTransition>
  );
}

