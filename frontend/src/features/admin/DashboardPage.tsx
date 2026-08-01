import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  Flag,
  MessageSquare,
  MessagesSquare,
  RefreshCw,
  UserCheck,
  UserX,
  Users,
  Wifi,
} from "lucide-react";
import { parseApiError } from "@/lib/errors";
import {
  AButton,
  ACard,
  AEmpty,
  PageEnter,
  PageHeader,
  StatCard,
  adminStatsQueryOptions,
} from "./ui";
import { adminApi } from "./api";

/**
 * Every number the backend exposes for an overview, in one place.
 *
 * Freshness comes from adminStatsQueryOptions: the endpoint is cached 60s
 * server-side, so the client matches that cadence and re-syncs on focus and
 * reconnect. Other admin pages invalidate ["admin", "dashboard"] after any
 * mutation that moves one of these counters, so returning here shows current
 * state without the manual Refresh below — which stays for the impatient.
 */
export function AdminDashboardPage() {
  const query = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminApi.dashboard(),
    ...adminStatsQueryOptions,
  });

  const stats = query.data;
  const { refetch } = query;

  // refetch is referentially stable, so both call sites keep one handler.
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const quickLinks = useMemo(
    () => [
      {
        to: "/admin/reports",
        label: "Review pending reports",
        count: stats?.pending_reports_count,
        icon: Flag,
      },
      {
        to: "/admin/users",
        label: "Manage users",
        count: stats?.users_count,
        icon: Users,
      },
      {
        to: "/admin/events",
        label: "Manage events",
        count: stats?.active_events_count,
        icon: CalendarDays,
      },
    ],
    [
      stats?.pending_reports_count,
      stats?.users_count,
      stats?.active_events_count,
    ],
  );

  return (
    <PageEnter>
      <PageHeader
        title="Dashboard"
        description="Platform overview at a glance."
        actions={
          <AButton
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={query.isFetching && !query.isLoading}
          >
            <RefreshCw className="size-3.5" /> Refresh
          </AButton>
        }
      />

      {query.isError ? (
        <ACard>
          <AEmpty
            icon={Wifi}
            title="Couldn't load statistics"
            description={parseApiError(query.error).message}
            action={<AButton onClick={handleRefresh}>Retry</AButton>}
          />
        </ACard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <StatCard
              label="Total users"
              value={stats?.users_count}
              icon={Users}
              loading={query.isLoading}
            />
            <StatCard
              label="Online now"
              value={stats?.online_users_count}
              icon={Wifi}
              tone="green"
              loading={query.isLoading}
            />
            <StatCard
              label="Active events"
              value={stats?.active_events_count}
              icon={CalendarDays}
              tone="violet"
              loading={query.isLoading}
            />
            <StatCard
              label="Pending reports"
              value={stats?.pending_reports_count}
              icon={Flag}
              tone="amber"
              loading={query.isLoading}
            />
            <StatCard
              label="Total chats"
              value={stats?.total_chats_count}
              icon={MessagesSquare}
              loading={query.isLoading}
            />
            <StatCard
              label="Total messages"
              value={stats?.total_messages_count}
              icon={MessageSquare}
              loading={query.isLoading}
            />
            <StatCard
              label="Pending reveals"
              value={stats?.pending_reveal_request_count}
              icon={Eye}
              tone="amber"
              loading={query.isLoading}
            />
            <StatCard
              label="Blocked users"
              value={stats?.blocked_users_count}
              icon={UserX}
              tone="red"
              loading={query.isLoading}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="group">
                <ACard className="flex items-center gap-3 p-4 transition-colors group-hover:border-a-accent/40 group-hover:bg-a-accent-soft">
                  <span className="rounded-lg bg-a-raised p-2 text-a-muted transition-colors group-hover:bg-a-accent/15 group-hover:text-a-accent-text">
                    <link.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-a-text group-hover:text-a-ink">
                    {link.label}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-a-faint transition-transform group-hover:translate-x-0.5 group-hover:text-a-accent-text" />
                </ACard>
              </Link>
            ))}
          </div>

          <ACard className="mt-5 flex items-start gap-3 p-4 sm:mt-6">
            <span className="a-chip-green rounded-lg p-2">
              <UserCheck className="size-4" />
            </span>
            <p className="text-sm leading-relaxed text-a-muted">
              Statistics are cached for 60 seconds server-side and re-sync
              when you return to this tab or hit Refresh. Message totals are an
              approximate count maintained by the database for performance —
              exact to within the last vacuum cycle.
            </p>
          </ACard>
        </>
      )}
    </PageEnter>
  );
}
