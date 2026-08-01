import { useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CheckCircle2, Clock3, ExternalLink, Flag } from "lucide-react";
import { REPORT_REASONS } from "@/lib/api/chat";
import { parseApiError } from "@/lib/errors";
import { formatDateTime, timeAgo } from "@/lib/utils";
import type { ReportReason } from "@/types/api";
import {
  ABadge,
  AButton,
  ACard,
  AEmpty,
  AField,
  AInput,
  AModal,
  APagination,
  ASelect,
  DataTable,
  notify,
  PageEnter,
  PageHeader,
  SearchBox,
  StatCard,
  useDebouncedValue,
  type BadgeTone,
  type Column,
} from "./ui";
import { adminApi, type AdminReport, type ReportStatus } from "./api";

const REPORTS_KEY = ["admin", "reports"] as const;

const STATUS_TONES: Record<ReportStatus, BadgeTone> = {
  pending: "amber",
  reviewed: "blue",
  resolved: "green",
};

const REASON_TONES: Record<ReportReason, BadgeTone> = {
  spam: "gray",
  harassment: "red",
  abusive_language: "red",
  inappropriate_content: "amber",
  fake_identity: "violet",
  other: "gray",
};

const STATUS_OPTIONS: ReadonlyArray<{ value: ReportStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
];

function reasonLabel(reason: ReportReason): string {
  return REPORT_REASONS.find((entry) => entry.value === reason)?.label ?? reason;
}

/** Reports carry no id (see AdminReport), so rows key on what is unique. */
function reportKey(report: AdminReport): string {
  return report.id ?? `${report.room}:${report.reporter.id}:${report.created_at}`;
}

function Party({ name, email }: { name: string; email: string }) {
  return (
    <div className="min-w-0">
      <p className="max-w-44 truncate font-medium text-a-ink">{name}</p>
      <p className="max-w-44 truncate text-xs text-a-muted">{email}</p>
    </div>
  );
}

function ReportDetailModal({
  report,
  onClose,
}: {
  report: AdminReport | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) =>
      adminApi.reports.updateStatus(id, status),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: REPORTS_KEY });
      notify.success(`Report marked ${updated.status}.`);
      onClose();
    },
    onError: (error) => notify.error(parseApiError(error).message),
  });

  return (
    <AModal open={report !== null} onClose={onClose} title="Report details" wide>
      {report && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ABadge tone={REASON_TONES[report.reason]}>
              {reasonLabel(report.reason)}
            </ABadge>
            <ABadge tone={STATUS_TONES[report.status]} className="capitalize">
              {report.status}
            </ABadge>
            <span
              className="ml-auto text-xs text-a-muted"
              title={formatDateTime(report.created_at)}
            >
              Filed {timeAgo(report.created_at)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-a-line p-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-a-faint">
                Reported user
              </p>
              <Party
                name={report.reported_user.full_name}
                email={report.reported_user.email}
              />
            </div>
            <div className="rounded-lg border border-a-line p-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-a-faint">
                Reporter
              </p>
              <Party
                name={report.reporter.full_name}
                email={report.reporter.email}
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-a-faint">
              Description
            </p>
            <p className="whitespace-pre-wrap break-words rounded-lg bg-a-raised px-3 py-2.5 text-sm leading-relaxed text-a-text">
              {report.description?.trim() || "No description provided."}
            </p>
          </div>

          <dl className="space-y-1.5 text-sm">
            {report.evidence_url && (
              <div className="flex items-center gap-2">
                <dt className="shrink-0 text-a-muted">Evidence:</dt>
                <dd>
                  <a
                    href={report.evidence_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 font-medium text-a-accent-text hover:underline"
                  >
                    Open link <ExternalLink className="size-3" />
                  </a>
                </dd>
              </div>
            )}
            <div className="flex items-start gap-2">
              <dt className="shrink-0 text-a-muted">Chat room:</dt>
              <dd className="min-w-0 break-all font-mono text-xs text-a-text">
                {report.room}
              </dd>
            </div>
          </dl>

          {/*
            Status changes need PATCH /admin/reports/<report_id>/, and the list
            payload carries no report id today (see AdminReport in api.ts).
            The controls exist and are fully wired — they appear the moment the
            backend adds `id` to AdminReportSerializer.
          */}
          {report.id !== undefined && (
            <div className="border-t border-a-line pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-a-faint">
                Set status
              </p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <AButton
                    key={option.value}
                    variant={report.status === option.value ? "primary" : "secondary"}
                    size="sm"
                    disabled={report.status === option.value}
                    loading={
                      statusMutation.isPending &&
                      statusMutation.variables?.status === option.value
                    }
                    onClick={() =>
                      statusMutation.mutate({
                        id: report.id!,
                        status: option.value,
                      })
                    }
                  >
                    {option.label}
                  </AButton>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AModal>
  );
}

export function AdminReportsPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminReport | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, status, reason, startDate, endDate]);

  const query = useQuery({
    queryKey: [
      ...REPORTS_KEY,
      { search, status, reason, startDate, endDate, page },
    ],
    queryFn: () =>
      adminApi.reports.list({
        page,
        search: search || undefined,
        status: (status || undefined) as ReportStatus | undefined,
        reason: (reason || undefined) as ReportReason | undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const stats = query.data?.stats;
  const pageData = query.data?.reports;
  const rows = pageData?.results ?? [];

  const columns = useMemo<Array<Column<AdminReport>>>(
    () => [
      {
        key: "reported",
        header: "Reported user",
        render: (report) => (
          <Party
            name={report.reported_user.full_name}
            email={report.reported_user.email}
          />
        ),
      },
      {
        key: "reporter",
        header: "Reporter",
        render: (report) => (
          <Party
            name={report.reporter.full_name}
            email={report.reporter.email}
          />
        ),
      },
      {
        key: "reason",
        header: "Reason",
        render: (report) => (
          <ABadge tone={REASON_TONES[report.reason]}>
            {reasonLabel(report.reason)}
          </ABadge>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (report) => (
          <ABadge tone={STATUS_TONES[report.status]} className="capitalize">
            {report.status}
          </ABadge>
        ),
      },
      {
        key: "filed",
        header: "Filed",
        render: (report) => (
          <span
            className="whitespace-nowrap text-a-muted"
            title={formatDateTime(report.created_at)}
          >
            {timeAgo(report.created_at)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <PageEnter>
      <PageHeader
        title="Reports"
        description="User-filed reports from anonymous chats."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:mb-6 sm:gap-4">
        <StatCard label="Total" value={stats?.reports_count} icon={Flag} loading={query.isLoading} />
        <StatCard label="Pending" value={stats?.reports_pending_count} icon={Clock3} tone="amber" loading={query.isLoading} />
        <StatCard label="Resolved" value={stats?.reports_resolved_count} icon={CheckCircle2} tone="green" loading={query.isLoading} />
      </div>

      <ACard>
        <div className="grid grid-cols-2 gap-2 border-b border-a-line p-3 sm:flex sm:flex-wrap sm:items-end">
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search people, reason, description…"
            busy={query.isFetching && !query.isLoading}
            className="col-span-2 w-full lg:w-72"
          />
          <ASelect
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            widthClass="w-full sm:w-auto"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </ASelect>
          <ASelect
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-label="Filter by reason"
            widthClass="w-full sm:w-auto"
          >
            <option value="">All reasons</option>
            {REPORT_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </ASelect>
          <div className="col-span-2 flex w-full gap-2 sm:w-auto">
            <div className="min-w-0 flex-1">
              <AField label="From">
                {(id) => (
                  <AInput
                    id={id}
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    widthClass="w-full sm:w-auto"
                  />
                )}
              </AField>
            </div>
            <div className="min-w-0 flex-1">
              <AField label="To">
                {(id) => (
                  <AInput
                    id={id}
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    widthClass="w-full sm:w-auto"
                  />
                )}
              </AField>
            </div>
          </div>
        </div>

        {query.isError ? (
          <AEmpty
            icon={Flag}
            title="Couldn't load reports"
            description={parseApiError(query.error).message}
            action={<AButton onClick={() => void query.refetch()}>Retry</AButton>}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={reportKey}
              loading={query.isLoading}
              onRowClick={setSelected}
              empty={
                <AEmpty
                  icon={Flag}
                  title={search ? "No matching reports" : "No reports"}
                  description={
                    search
                      ? `Nothing matches “${search}”.`
                      : "Reports filed by users will appear here."
                  }
                />
              }
            />
            {pageData && (
              <APagination
                page={page}
                count={pageData.count}
                onPage={setPage}
                busy={query.isFetching}
              />
            )}
          </>
        )}
      </ACard>

      <ReportDetailModal report={selected} onClose={() => setSelected(null)} />
    </PageEnter>
  );
}
