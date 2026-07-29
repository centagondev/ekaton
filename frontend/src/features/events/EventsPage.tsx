import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarDays, MapPin, Plus, Timer, Users } from "lucide-react";
import { eventsApi } from "@/lib/api/events";
import { PageTransition, staggerContainer, staggerItem } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PUBLIC_SPEAKING_MODE } from "@/lib/config";
import { formatDateTime, timeUntil } from "@/lib/utils";
import { EventBannerArt, EventFormModal } from "./event-shared";

export function EventsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  // Demo visitors have no JWT, so this request would 401 — and real campus
  // events must not be shown publicly. Hook stays unconditional.
  const query = useQuery({
    queryKey: ["events"],
    queryFn: eventsApi.list,
    enabled: !PUBLIC_SPEAKING_MODE,
  });

  const events = query.data ?? [];
  const [featured, ...rest] = events;

  if (PUBLIC_SPEAKING_MODE) {
    return (
      <PageTransition>
        <ComingSoon
          icon={<CalendarDays className="size-7" />}
          title="Campus Events"
          description="Soon you'll be able to create events, drop into anonymous group chats around them, and meet the people sitting three rows behind you. Launching soon."
        />
      </PageTransition>
    );
  }

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
        <div className="space-y-6">
          <Skeleton className="h-44 w-full" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-64" />
            ))}
          </div>
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

      {featured && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            to={`/events/${featured.id}`}
            className="block border-2 border-ink bg-brand-yellow shadow-brutal transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm"
          >
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="min-w-0">
                <span className="mb-3 inline-block -rotate-1 border-2 border-ink bg-brand-lime px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.2em]">
                  ● Latest event
                </span>
                <h2 className="text-3xl font-black leading-tight sm:text-4xl">{featured.name}</h2>
                <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-3.5" /> Ends {timeUntil(featured.end_time)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {featured.venue}
                  </span>
                  {featured.is_anonymous_chat && (
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" /> Anonymous
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 border-2 border-ink bg-ink px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-white">
                Join Now
              </span>
            </div>
          </Link>
        </motion.div>
      )}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {rest.map((event) => (
          <motion.div key={event.id} variants={staggerItem} whileHover={{ x: 2, y: 2 }}>
            <Link
              to={`/events/${event.id}`}
              className="flex h-full flex-col border-2 border-ink bg-surface shadow-brutal transition-shadow hover:shadow-brutal-sm"
            >
              <EventBannerArt banner={event.banner} className="h-32" />
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="lime">Live</Badge>
                  {event.is_anonymous_chat && <Badge tone="lavender">Anonymous</Badge>}
                </div>
                <h2 className="mb-2 text-xl font-black leading-snug">{event.name}</h2>
                <div className="space-y-1 font-mono text-[11px] uppercase tracking-wider text-muted">
                  <p className="flex items-center gap-1.5">
                    <Timer className="size-3.5" /> Ends {formatDateTime(event.end_time)}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {event.venue}
                  </p>
                </div>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
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
