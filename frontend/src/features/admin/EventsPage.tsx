import { useCallback, useEffect, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Pencil,
  VenetianMask,
  X,
} from "lucide-react";
import { parseApiError } from "@/lib/errors";
import { formatDateTime, initialsOf, timeAgo, timeUntil } from "@/lib/utils";
import type { EventBanner, EventStatus, User } from "@/types/api";
import {
  ABadge,
  AButton,
  ACard,
  adminListQueryOptions,
  AEmpty,
  AField,
  AInput,
  AModal,
  APagination,
  ASelect,
  ASkeleton,
  ATextarea,
  AToggle,
  ConfirmDialog,
  DataTable,
  notify,
  PageEnter,
  PageHeader,
  SearchBox,
  StatCard,
  toDatetimeLocal,
  useDebouncedValue,
  type BadgeTone,
  type Column,
} from "./ui";
import {
  adminApi,
  type AdminEvent,
  type AdminEventDetail,
  type UpdateEventPayload,
} from "./api";

const EVENTS_KEY = ["admin", "events"] as const;

/**
 * The dashboard's stats card set counts active events, so every mutation that
 * can move an event in or out of `active` re-syncs it too. Invalidation only
 * *refetches* observed queries — while the admin is on this page the dashboard
 * query is unmounted, so this costs a request only if they navigate back.
 */
const DASHBOARD_KEY = ["admin", "dashboard"] as const;

const STATUS_TONES: Record<EventStatus, BadgeTone> = {
  active: "green",
  ended: "gray",
  cancelled: "red",
};

const BANNERS: EventBanner[] = [
  "banner_1",
  "banner_2",
  "banner_3",
  "banner_4",
  "banner_5",
  "banner_6",
];

/** Labels for the backend's ordering_fields (created_at, updated_at, end_time, name). */
const ORDERINGS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "end_time", label: "Ending soonest" },
  { value: "-updated_at", label: "Recently updated" },
  { value: "name", label: "Name A–Z" },
  { value: "-name", label: "Name Z–A" },
];

function bannerLabel(banner: EventBanner): string {
  return `Banner ${banner.split("_")[1] ?? banner}`;
}

const eventRowKey = (event: AdminEvent) => event.id;

/* ------------------------------ owner picker ------------------------------ */

/**
 * Create-event needs an owner user id. There is no dedicated user-search
 * endpoint for this, and none is needed: the admin users list already supports
 * ?search= — this picker is just that endpoint behind a combobox.
 */
function OwnerPicker({
  value,
  onChange,
  error,
}: {
  value: User | null;
  onChange: (user: User | null) => void;
  error?: string | null;
}) {
  const [term, setTerm] = useState("");
  const search = useDebouncedValue(term.trim());

  const query = useQuery({
    queryKey: ["admin", "owner-search", search],
    queryFn: () => adminApi.users.list({ search: search || undefined, page: 1 }),
    // Still gated on having no owner yet: once one is picked this component
    // renders the summary card instead, and the list must not keep fetching.
    enabled: value === null,
    placeholderData: keepPreviousData,
    ...adminListQueryOptions,
  });

  const candidates = query.data?.users.results ?? [];

  if (value) {
    return (
      <AField label="Owner" error={error}>
        {() => (
          <div className="flex items-center gap-2.5 rounded-lg border border-a-line-strong bg-a-raised px-3 py-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-a-accent text-[11px] font-semibold text-white">
              {initialsOf(value.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-a-ink">
                {value.full_name}
              </p>
              <p className="truncate text-xs text-a-muted">{value.email}</p>
            </div>
            <button
              type="button"
              aria-label="Clear owner"
              onClick={() => onChange(null)}
              className="-m-1 rounded-md p-2 text-a-faint transition-colors hover:text-a-text"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
      </AField>
    );
  }

  return (
    <AField
      label="Owner"
      hint="The event is created on this user's behalf."
      error={error}
    >
      {() => (
        <div>
          <SearchBox
            value={term}
            onChange={setTerm}
            placeholder="Search users by name or email…"
            busy={query.isPlaceholderData}
          />
          <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-a-line">
            {query.isLoading ? (
              <div className="space-y-2 p-3">
                <ASkeleton className="h-4 w-2/3" />
                <ASkeleton className="h-4 w-1/2" />
              </div>
            ) : candidates.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-a-muted">
                No active users match.
              </p>
            ) : (
              candidates.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onChange(user)}
                  className="flex min-h-11 w-full items-center gap-2.5 border-b border-a-line/70 px-3 py-2 text-left transition-colors last:border-0 hover:bg-a-raised sm:min-h-0"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-a-raised text-[10px] font-semibold text-a-muted">
                    {initialsOf(user.full_name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-a-ink">
                      {user.full_name}
                    </span>
                    <span className="block truncate text-xs text-a-muted">
                      {user.email}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </AField>
  );
}

/* ------------------------------ event forms ------------------------------- */

interface EventFormValues {
  name: string;
  description: string;
  venue: string;
  end_time: string;
  banner: EventBanner;
}

function EventFields({
  form,
}: {
  form: ReturnType<typeof useForm<EventFormValues>>;
}) {
  return (
    <>
      <AField label="Name" error={form.formState.errors.name?.message}>
        {(id) => (
          <AInput
            id={id}
            placeholder="Freshers' Meetup"
            {...form.register("name", { required: "Name is required." })}
          />
        )}
      </AField>
      <AField
        label="Description"
        error={form.formState.errors.description?.message}
      >
        {(id) => (
          <ATextarea
            id={id}
            placeholder="What is this event about?"
            {...form.register("description", {
              required: "Description is required.",
            })}
          />
        )}
      </AField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AField label="Venue" error={form.formState.errors.venue?.message}>
          {(id) => (
            <AInput
              id={id}
              placeholder="Main auditorium"
              {...form.register("venue", { required: "Venue is required." })}
            />
          )}
        </AField>
        <AField label="Banner" error={form.formState.errors.banner?.message}>
          {(id) => (
            <ASelect id={id} {...form.register("banner")}>
              {BANNERS.map((banner) => (
                <option key={banner} value={banner}>
                  {bannerLabel(banner)}
                </option>
              ))}
            </ASelect>
          )}
        </AField>
      </div>
      <AField
        label="Ends at"
        error={form.formState.errors.end_time?.message}
        hint="Must be in the future — the event auto-ends at this time."
      >
        {(id) => (
          <AInput
            id={id}
            type="datetime-local"
            {...form.register("end_time", { required: "End time is required." })}
          />
        )}
      </AField>
    </>
  );
}

function applyEventFieldErrors(
  error: unknown,
  form: ReturnType<typeof useForm<EventFormValues>>,
): string | null {
  const parsed = parseApiError(error);
  let routed = false;
  for (const [field, message] of Object.entries(parsed.fields)) {
    if (["name", "description", "venue", "end_time", "banner"].includes(field)) {
      form.setError(field as keyof EventFormValues, { message });
      routed = true;
    }
  }
  return routed ? null : parsed.message;
}

function CreateEventModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [owner, setOwner] = useState<User | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);

  const form = useForm<EventFormValues>({
    defaultValues: {
      name: "",
      description: "",
      venue: "",
      end_time: "",
      banner: "banner_1",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: EventFormValues) =>
      adminApi.events.create({
        owner: owner!.id,
        name: values.name,
        description: values.description,
        venue: values.venue,
        banner: values.banner,
        end_time: new Date(values.end_time).toISOString(),
        is_anonymous_chat: anonymous,
      }),
    onSuccess: (event) => {
      notify.success(`“${event.name}” created.`);
      form.reset();
      setOwner(null);
      setAnonymous(false);
      onClose();
    },
    onError: (error) => {
      const parsed = parseApiError(error);
      if (parsed.fields.owner) {
        setOwnerError(parsed.fields.owner);
        return;
      }
      const message = applyEventFieldErrors(error, form);
      if (message) notify.error(message);
    },
    // Settled, not success: a request that failed at the transport layer may
    // still have created the event, so both paths re-sync rather than leaving
    // the table showing a list the backend no longer agrees with.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });

  const submit = form.handleSubmit((values) => {
    if (!owner) {
      setOwnerError("Pick the user who will own this event.");
      return;
    }
    setOwnerError(null);
    mutation.mutate(values);
  });

  return (
    <AModal open={open} onClose={onClose} title="Create event" wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <OwnerPicker value={owner} onChange={setOwner} error={ownerError} />
        <EventFields form={form} />
        <AToggle
          checked={anonymous}
          onChange={setAnonymous}
          label="Anonymous chat (participants get aliases)"
        />
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <AButton
            variant="secondary"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </AButton>
          <AButton
            type="submit"
            loading={mutation.isPending}
            className="w-full sm:w-auto"
          >
            Create event
          </AButton>
        </div>
      </form>
    </AModal>
  );
}

function EditEventModal({
  event,
  onClose,
}: {
  event: AdminEventDetail | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [anonymous, setAnonymous] = useState(false);
  const form = useForm<EventFormValues>();

  useEffect(() => {
    if (!event) return;
    form.reset({
      name: event.name,
      description: event.description,
      venue: event.venue,
      banner: event.banner,
      end_time: toDatetimeLocal(event.end_time),
    });
    setAnonymous(event.is_anonymous_chat);
  }, [event, form]);

  const mutation = useMutation({
    mutationFn: (values: EventFormValues) => {
      // Send only what changed — the anonymous toggle in particular is
      // rejected server-side once people have joined, so an untouched toggle
      // must not ride along and trip that validation.
      const dirty = form.formState.dirtyFields;
      const payload: UpdateEventPayload = {};
      if (dirty.name) payload.name = values.name;
      if (dirty.description) payload.description = values.description;
      if (dirty.venue) payload.venue = values.venue;
      if (dirty.banner) payload.banner = values.banner;
      if (dirty.end_time)
        payload.end_time = new Date(values.end_time).toISOString();
      if (anonymous !== event!.is_anonymous_chat)
        payload.is_anonymous_chat = anonymous;
      return adminApi.events.update(event!.id, payload);
    },
    onSuccess: (updated) => {
      notify.success(`“${updated.name}” updated.`);
      onClose();
    },
    onError: (error) => {
      const message = applyEventFieldErrors(error, form);
      if (message) notify.error(message);
    },
    // EVENTS_KEY is a prefix of the detail query's key, so this one call also
    // marks ["admin","events","detail",id] stale — reopening the detail modal
    // shows the saved values, not the copy from before the edit. A second,
    // explicit detail invalidation would only risk a duplicate request.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });

  return (
    <AModal open={event !== null} onClose={onClose} title="Edit event" wide>
      {event && (
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <EventFields form={form} />
          <AToggle
            checked={anonymous}
            onChange={setAnonymous}
            label="Anonymous chat (rejected once participants have joined)"
          />
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <AButton
              variant="secondary"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Cancel
            </AButton>
            <AButton
              type="submit"
              loading={mutation.isPending}
              className="w-full sm:w-auto"
            >
              Save changes
            </AButton>
          </div>
        </form>
      )}
    </AModal>
  );
}

/* ------------------------------ detail modal ------------------------------ */

function EventDetailModal({
  eventId,
  onClose,
  onEdit,
  onCancelEvent,
}: {
  eventId: string | null;
  onClose: () => void;
  onEdit: (event: AdminEventDetail) => void;
  onCancelEvent: (event: AdminEventDetail) => void;
}) {
  const query = useQuery({
    queryKey: [...EVENTS_KEY, "detail", eventId],
    queryFn: () => adminApi.events.detail(eventId!),
    enabled: eventId !== null,
    // Without this the single-event view inherits the student app's 30s
    // staleTime, so reopening it right after an edit shows the pre-edit
    // payload until a refetch lands — and participant_count could be stale
    // in the exact screen used to decide whether to cancel an event.
    ...adminListQueryOptions,
  });

  const event = query.data;

  return (
    <AModal open={eventId !== null} onClose={onClose} title="Event details" wide>
      {query.isLoading ? (
        <div className="space-y-3">
          <ASkeleton className="h-6 w-2/3" />
          <ASkeleton className="h-4 w-full" />
          <ASkeleton className="h-4 w-5/6" />
          <ASkeleton className="h-24 w-full" />
        </div>
      ) : query.isError ? (
        <AEmpty
          icon={CalendarDays}
          title="Couldn't load this event"
          description={parseApiError(query.error).message}
          action={<AButton onClick={() => void query.refetch()}>Retry</AButton>}
        />
      ) : event ? (
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold text-a-ink">
                {event.name}
              </h3>
              <ABadge tone={STATUS_TONES[event.status]} className="capitalize">
                {event.status}
              </ABadge>
              {event.is_anonymous_chat && (
                <ABadge tone="violet">
                  <VenetianMask className="size-3" /> Anonymous
                </ABadge>
              )}
            </div>
            <p className="mt-1 text-sm text-a-muted">
              <span className="break-words">{event.venue}</span> · {bannerLabel(event.banner)}
            </p>
          </div>

          <p className="whitespace-pre-wrap break-words rounded-lg bg-a-raised/70 px-3 py-2.5 text-sm leading-relaxed text-a-text">
            {event.description}
          </p>

          <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="shrink-0 text-a-muted">Owner</dt>
              <dd className="min-w-0 text-right font-medium text-a-ink sm:text-left">
                {event.owner.full_name}
                <span className="block break-all text-xs font-normal text-a-muted">
                  {event.owner.email}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="text-a-muted">Participants</dt>
              <dd className="font-medium text-a-ink">
                {event.participant_count}
              </dd>
            </div>
            <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="text-a-muted">Ends</dt>
              <dd className="font-medium text-a-ink">
                {formatDateTime(event.end_time)}
                {event.status === "active" && (
                  <span className="block text-xs font-normal text-a-muted">
                    {timeUntil(event.end_time)}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
              <dt className="text-a-muted">Created</dt>
              <dd className="font-medium text-a-ink">
                {formatDateTime(event.created_at)}
              </dd>
            </div>
          </dl>

          {/* The backend only lets active events be edited or cancelled. */}
          {event.status === "active" && (
            <div className="flex flex-col-reverse gap-2 border-t border-a-line pt-4 sm:flex-row sm:justify-end">
              <AButton
                variant="secondary"
                onClick={() => onEdit(event)}
                className="w-full sm:w-auto"
              >
                <Pencil className="size-3.5" /> Edit
              </AButton>
              <AButton
                variant="danger"
                onClick={() => onCancelEvent(event)}
                className="w-full sm:w-auto"
              >
                <Ban className="size-3.5" /> Cancel event
              </AButton>
            </div>
          )}
        </div>
      ) : null}
    </AModal>
  );
}

/* ---------------------------------- page ----------------------------------- */

export function AdminEventsPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [status, setStatus] = useState("");
  const [anonymous, setAnonymous] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminEventDetail | null>(null);
  const [cancelling, setCancelling] = useState<AdminEventDetail | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, status, anonymous, ordering]);

  const query = useQuery({
    queryKey: [...EVENTS_KEY, { search, status, anonymous, ordering, page }],
    queryFn: () =>
      adminApi.events.list({
        page,
        ordering,
        search: search || undefined,
        status: (status || undefined) as EventStatus | undefined,
        is_anonymous_chat: (anonymous || undefined) as
          | "true"
          | "false"
          | undefined,
      }),
    placeholderData: keepPreviousData,
    ...adminListQueryOptions,
  });

  const cancelMutation = useMutation({
    mutationFn: (event: AdminEventDetail) => adminApi.events.cancel(event.id),
    onSuccess: () => {
      notify.success("Event cancelled.");
      setCancelling(null);
      setDetailId(null);
    },
    onError: (error) => notify.error(parseApiError(error).message),
    // Cancelling drops the event out of the active count and empties its
    // participants, so the table, the stat cards above it and the dashboard
    // all re-sync — on failure too, since a timed-out cancel may still land.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });

  const { mutate: cancelEvent } = cancelMutation;

  const stats = query.data?.stats;
  const pageData = query.data?.events;
  const rows = pageData?.results ?? [];

  /**
   * Stable handlers for the four dialogs and the table.
   *
   * Not cosmetic: AModal keeps `onClose` in a useEffect dependency list (escape
   * key + body scroll lock). Inline arrows here meant every keystroke in the
   * search box re-ran that effect on any open dialog — tearing down the key
   * listener and re-measuring the scrollbar to restyle document.body each time.
   */
  const openCreate = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);
  const openDetail = useCallback((event: AdminEvent) => setDetailId(event.id), []);
  const closeDetail = useCallback(() => setDetailId(null), []);
  const startEdit = useCallback((event: AdminEventDetail) => {
    setDetailId(null);
    setEditing(event);
  }, []);
  const closeEdit = useCallback(() => setEditing(null), []);
  const startCancel = useCallback(
    (event: AdminEventDetail) => setCancelling(event),
    [],
  );
  const closeCancel = useCallback(() => setCancelling(null), []);
  const confirmCancel = useCallback(() => {
    if (cancelling) cancelEvent(cancelling);
  }, [cancelling, cancelEvent]);

  const columns = useMemo<Array<Column<AdminEvent>>>(
    () => [
      {
        key: "event",
        header: "Event",
        render: (event) => (
          <div className="min-w-0">
            <p className="max-w-56 truncate font-medium text-a-ink">
              {event.name}
            </p>
            <p className="max-w-56 truncate text-xs text-a-muted">
              {event.venue}
            </p>
          </div>
        ),
      },
      {
        key: "owner",
        header: "Owner",
        render: (event) => (
          <span className="block max-w-40 truncate text-a-text">
            {event.owner}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (event) => (
          <div className="flex items-center gap-1.5">
            <ABadge tone={STATUS_TONES[event.status]} className="capitalize">
              {event.status}
            </ABadge>
            {event.is_anonymous_chat && (
              <ABadge tone="violet">
                <VenetianMask className="size-3" />
              </ABadge>
            )}
          </div>
        ),
      },
      {
        key: "participants",
        header: "Participants",
        className: "text-right",
        render: (event) => (
          <span className="tabular-nums text-a-text">
            {event.participant_count}
          </span>
        ),
      },
      {
        key: "ends",
        header: "Ends",
        render: (event) => (
          <span
            className="whitespace-nowrap text-a-muted"
            title={formatDateTime(event.end_time)}
          >
            {event.status === "active"
              ? timeUntil(event.end_time)
              : formatDateTime(event.end_time)}
          </span>
        ),
      },
      {
        key: "created",
        header: "Created",
        render: (event) => (
          <span
            className="whitespace-nowrap text-a-muted"
            title={formatDateTime(event.created_at)}
          >
            {timeAgo(event.created_at)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <PageEnter>
      <PageHeader
        title="Events"
        description="Campus events and their chats."
        actions={
          <AButton onClick={openCreate}>
            <CalendarPlus className="size-4" /> New event
          </AButton>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total" value={stats?.total_events} icon={CalendarDays} loading={query.isLoading} />
        <StatCard label="Active" value={stats?.active_events} icon={CheckCircle2} tone="green" loading={query.isLoading} />
        <StatCard label="Ended" value={stats?.ended_events} icon={Clock3} tone="gray" loading={query.isLoading} />
        <StatCard label="Cancelled" value={stats?.cancelled_events} icon={Ban} tone="red" loading={query.isLoading} />
        <StatCard label="Anonymous" value={stats?.anonymous_events} icon={VenetianMask} tone="violet" loading={query.isLoading} />
      </div>

      <ACard>
        <div className="grid grid-cols-2 gap-2 border-b border-a-line p-3 sm:flex sm:flex-wrap sm:items-center">
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search name, venue, owner…"
            busy={query.isPlaceholderData}
            className="col-span-2 w-full lg:w-64"
          />
          <ASelect
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            widthClass="w-full sm:w-auto"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="ended">Ended</option>
            <option value="cancelled">Cancelled</option>
          </ASelect>
          <ASelect
            value={anonymous}
            onChange={(event) => setAnonymous(event.target.value)}
            aria-label="Filter by chat mode"
            widthClass="w-full sm:w-auto"
          >
            <option value="">All chat modes</option>
            <option value="true">Anonymous</option>
            <option value="false">Public</option>
          </ASelect>
          <ASelect
            value={ordering}
            onChange={(event) => setOrdering(event.target.value)}
            aria-label="Sort events"
            widthClass="w-full sm:w-auto"
            className="col-span-2 sm:ml-auto"
          >
            {ORDERINGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </ASelect>
        </div>

        {query.isError ? (
          <AEmpty
            icon={CalendarDays}
            title="Couldn't load events"
            description={parseApiError(query.error).message}
            action={<AButton onClick={() => void query.refetch()}>Retry</AButton>}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={eventRowKey}
              loading={query.isLoading}
              onRowClick={openDetail}
              empty={
                <AEmpty
                  icon={CalendarDays}
                  title={search ? "No matching events" : "No events yet"}
                  description={
                    search
                      ? `Nothing matches “${search}”.`
                      : "Created events will appear here."
                  }
                  action={
                    !search ? (
                      <AButton onClick={openCreate}>
                        <CalendarPlus className="size-4" /> New event
                      </AButton>
                    ) : undefined
                  }
                />
              }
            />
            {pageData && (
              <APagination
                page={page}
                count={pageData.count}
                onPage={setPage}
                busy={query.isPlaceholderData}
              />
            )}
          </>
        )}
      </ACard>

      <CreateEventModal open={createOpen} onClose={closeCreate} />
      <EventDetailModal
        eventId={detailId}
        onClose={closeDetail}
        onEdit={startEdit}
        onCancelEvent={startCancel}
      />
      <EditEventModal event={editing} onClose={closeEdit} />
      <ConfirmDialog
        open={cancelling !== null}
        onClose={closeCancel}
        onConfirm={confirmCancel}
        busy={cancelMutation.isPending}
        title="Cancel this event?"
        confirmLabel="Cancel event"
        body={
          <p>
            <span className="break-words font-medium text-a-ink">{cancelling?.name}</span>{" "}
            will be marked cancelled and every participant is removed. This
            cannot be undone.
          </p>
        }
      />
    </PageEnter>
  );
}
