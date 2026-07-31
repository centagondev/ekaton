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
import { AButton, ACard, AEmpty, PageHeader, StatCard } from "./ui";
import { adminApi } from "./api";

/**
 * Every number the backend exposes for an overview, in one place. The stats
 * endpoint is cached for 60 seconds server-side, so refetching more often
 * than that only returns the same payload — staleTime mirrors the cache.
 */
export function AdminDashboardPage() {
  const query = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => adminApi.dashboard(),
    staleTime: 60_000,
    retry: 1,
  });

  const stats = query.data;

  const quickLinks = [
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
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Platform overview at a glance."
        actions={
          <AButton
            variant="secondary"
            size="sm"
            onClick={() => void query.refetch()}
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
            action={
              <AButton onClick={() => void query.refetch()}>Retry</AButton>
            }
          />
        </ACard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {quickLinks.map((link) => (
              <Link key={link.to} to={link.to} className="group">
                <ACard className="flex items-center gap-3 p-4 transition-colors group-hover:border-blue-300 group-hover:bg-blue-50/40">
                  <span className="rounded-lg bg-gray-100 p-2 text-gray-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                    <link.icon className="size-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {link.label}
                  </span>
                  <ArrowRight className="size-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </ACard>
              </Link>
            ))}
          </div>

          <ACard className="mt-6 flex items-start gap-3 p-4">
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <UserCheck className="size-4" />
            </span>
            <p className="text-sm leading-relaxed text-gray-500">
              Statistics refresh every 60 seconds. Message totals are an
              approximate count maintained by the database for performance —
              exact to within the last vacuum cycle.
            </p>
          </ACard>
        </>
      )}
    </>
  );
}
