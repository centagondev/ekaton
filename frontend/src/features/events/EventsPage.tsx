import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, MapPin, Plus, Timer } from "lucide-react";
import { eventsApi } from "@/lib/api/events";
import { PageTransition, staggerContainer, staggerItem } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { EVENT_BANNER_RATIO, EventBannerArt, EventFormModal } from "./event-shared";

export function EventsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({ queryKey: ["events"], queryFn: eventsApi.list });

  const events = query.data ?? [];

  // Newest first. The list endpoint's ordering is its own business, so the
  // page sorts rather than trusting whatever order it arrives in.
  const ordered = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [events],
  );

  return (
    <PageTransition>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black leading-[0.95] tracking-tight">
            Campus
            <br />
            Events
          </h1>
          <p className="mt-3 text-sm text-muted">Discover, Join, and Connect with Students.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Create Event
        </Button>
      </div>

      {query.isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-64" />
          ))}
        </div>
      )}

      {query.isError && (
        <EmptyState
          icon={CalendarDays}
          title="Couldn't load events"
          description="Something went wrong talking to the server."
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        />
      )}

      {!query.isLoading && !query.isError && events.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Nothing happening right now"
          description="No live events at the moment. Start one and get people talking."
          action={<Button onClick={() => setCreateOpen(true)}>Host the first</Button>}
        />
      )}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {/*
          min-w-0 on each item: a grid item defaults to min-width:auto, so a
          long venue would widen its column past the grid instead of being
          truncated by the card.
        */}
        {ordered.map((event) => (
          <motion.div
            key={event.id}
            variants={staggerItem}
            whileHover={{ x: 2, y: 2 }}
            className="min-w-0"
          >
            <Link
              to={`/events/${event.id}`}
              className="flex h-full flex-col border-2 border-ink bg-surface shadow-brutal transition-shadow hover:shadow-brutal-sm"
            >
              <EventBannerArt banner={event.banner} className={EVENT_BANNER_RATIO} />
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="lime">Live</Badge>
                  {event.is_anonymous_chat && <Badge tone="lavender">Anonymous</Badge>}
                </div>
                {/*
                  Every card is the same height, so the text that varies in
                  length is capped: two lines for the name, one for the venue
                  and host. Long values are clipped, not allowed to grow a card
                  taller than its neighbours.
                */}
                <h2 className="mb-2 line-clamp-2 min-h-14 text-xl font-black leading-snug">
                  {event.name}
                </h2>
                <div className="space-y-1 font-mono text-[11px] uppercase tracking-wider text-muted">
                  <p className="flex items-center gap-1.5">
                    <Timer className="size-3.5 shrink-0" /> Ends {formatDateTime(event.end_time)}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{event.venue}</span>
                  </p>
                </div>
                <p className="mt-2 truncate text-xs font-bold uppercase tracking-wide text-muted">
                  {/* An anonymous event must not out its host. */}
                  Hosted by {event.is_anonymous_chat ? "Anonymous host" : event.owner}
                </p>
                <span className="mt-4 block border-2 border-ink py-2 text-center text-xs font-extrabold uppercase tracking-wide">
                  Chat Room
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <EventFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageTransition>
  );
}
