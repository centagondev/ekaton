import { useEffect, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BadgeCheck,
  Pencil,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users as UsersIcon,
  UserX,
  Wifi,
} from "lucide-react";
import { parseApiError } from "@/lib/errors";
import { cn, initialsOf } from "@/lib/utils";
import type { Gender, User } from "@/types/api";
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
  AToggle,
  ConfirmDialog,
  DataTable,
  PageHeader,
  SearchBox,
  StatCard,
  useDebouncedValue,
  type Column,
} from "./ui";
import { adminApi, getAdminUser, type CreateUserPayload } from "./api";

const USERS_KEY = ["admin", "users"] as const;

/** Route DRF's field-keyed validation errors onto the form they belong to. */
function applyFieldErrors(
  error: unknown,
  setError: (name: never, error: { message: string }) => void,
  knownFields: string[],
): string | null {
  const parsed = parseApiError(error);
  let routed = false;
  for (const [field, message] of Object.entries(parsed.fields)) {
    if (knownFields.includes(field)) {
      setError(field as never, { message });
      routed = true;
    }
  }
  return routed ? null : parsed.message;
}

interface CreateFormValues extends CreateUserPayload {}

function CreateUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<CreateFormValues>({
    defaultValues: { full_name: "", email: "", batch: "", gender: "male" },
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateFormValues) => adminApi.users.create(payload),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(`${user.full_name} created.`);
      form.reset();
      onClose();
    },
    onError: (error) => {
      const message = applyFieldErrors(error, form.setError, [
        "full_name",
        "email",
        "batch",
        "gender",
      ]);
      if (message) toast.error(message);
    },
  });

  return (
    <AModal open={open} onClose={onClose} title="Create user">
      <form
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
        noValidate
      >
        <AField
          label="Full name"
          error={form.formState.errors.full_name?.message}
        >
          {(id) => (
            <AInput
              id={id}
              autoFocus
              placeholder="Jane Doe"
              {...form.register("full_name", {
                required: "Full name is required.",
              })}
            />
          )}
        </AField>
        <AField label="Email" error={form.formState.errors.email?.message}>
          {(id) => (
            <AInput
              id={id}
              type="email"
              placeholder="jane@campus.edu"
              {...form.register("email", { required: "Email is required." })}
            />
          )}
        </AField>
        <div className="grid grid-cols-2 gap-3">
          <AField label="Batch" error={form.formState.errors.batch?.message}>
            {(id) => (
              <AInput
                id={id}
                placeholder="2024"
                {...form.register("batch", { required: "Batch is required." })}
              />
            )}
          </AField>
          <AField label="Gender" error={form.formState.errors.gender?.message}>
            {(id) => (
              <ASelect id={id} {...form.register("gender")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </ASelect>
            )}
          </AField>
        </div>
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
          The account is created unverified with no password. The user
          activates it themselves via the email check on the login screen,
          which sends them a password-setup link.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <AButton variant="secondary" onClick={onClose}>
            Cancel
          </AButton>
          <AButton type="submit" loading={mutation.isPending}>
            Create user
          </AButton>
        </div>
      </form>
    </AModal>
  );
}

interface EditFormValues {
  full_name: string;
  batch: string;
  gender: Gender;
  profile_photo: string;
  is_verified: boolean;
}

function EditUserModal({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<EditFormValues>();

  // Seed the form each time a different row is opened.
  useEffect(() => {
    if (!user) return;
    form.reset({
      full_name: user.full_name,
      batch: user.batch,
      gender: user.gender,
      profile_photo: user.profile_photo ?? "",
      is_verified: user.is_verified,
    });
  }, [user, form]);

  const mutation = useMutation({
    mutationFn: (values: EditFormValues) =>
      adminApi.users.update(user!.id, {
        full_name: values.full_name,
        batch: values.batch,
        gender: values.gender,
        // Empty input means "no photo" — the API accepts null to clear it.
        profile_photo: values.profile_photo.trim() || null,
        is_verified: values.is_verified,
      }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(`${updated.full_name} updated.`);
      onClose();
    },
    onError: (error) => {
      const message = applyFieldErrors(error, form.setError, [
        "full_name",
        "batch",
        "gender",
        "profile_photo",
      ]);
      if (message) toast.error(message);
    },
  });

  const isVerified = form.watch("is_verified");

  return (
    <AModal open={user !== null} onClose={onClose} title="Edit user">
      {user && (
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
          noValidate
        >
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {initialsOf(user.full_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {user.full_name}
              </p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>

          <AField
            label="Full name"
            error={form.formState.errors.full_name?.message}
          >
            {(id) => (
              <AInput
                id={id}
                {...form.register("full_name", {
                  required: "Full name is required.",
                })}
              />
            )}
          </AField>
          <div className="grid grid-cols-2 gap-3">
            <AField label="Batch" error={form.formState.errors.batch?.message}>
              {(id) => (
                <AInput
                  id={id}
                  {...form.register("batch", {
                    required: "Batch is required.",
                  })}
                />
              )}
            </AField>
            <AField
              label="Gender"
              error={form.formState.errors.gender?.message}
            >
              {(id) => (
                <ASelect id={id} {...form.register("gender")}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </ASelect>
              )}
            </AField>
          </div>
          <AField
            label="Profile photo URL"
            hint="Leave empty to remove the photo."
            error={form.formState.errors.profile_photo?.message}
          >
            {(id) => (
              <AInput
                id={id}
                type="url"
                placeholder="https://…"
                {...form.register("profile_photo")}
              />
            )}
          </AField>
          <AToggle
            checked={isVerified ?? false}
            onChange={(next) =>
              form.setValue("is_verified", next, { shouldDirty: true })
            }
            label="Verified account"
          />
          <div className="flex justify-end gap-2 pt-1">
            <AButton variant="secondary" onClick={onClose}>
              Cancel
            </AButton>
            <AButton type="submit" loading={mutation.isPending}>
              Save changes
            </AButton>
          </div>
        </form>
      )}
    </AModal>
  );
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [batchInput, setBatchInput] = useState("");
  const batch = useDebouncedValue(batchInput.trim());
  const [isActive, setIsActive] = useState("");
  const [isVerified, setIsVerified] = useState("");
  const [gender, setGender] = useState("");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toggling, setToggling] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  // A new filter always reads from page one.
  useEffect(() => {
    setPage(1);
  }, [search, batch, isActive, isVerified, gender]);

  const query = useQuery({
    queryKey: [...USERS_KEY, { search, batch, isActive, isVerified, gender, page }],
    queryFn: () =>
      adminApi.users.list({
        page,
        search: search || undefined,
        batch: batch || undefined,
        is_active: (isActive || undefined) as "true" | "false" | undefined,
        is_verified: (isVerified || undefined) as "true" | "false" | undefined,
        gender: (gender || undefined) as Gender | undefined,
      }),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const toggleMutation = useMutation({
    mutationFn: (user: User) =>
      adminApi.users.update(user.id, { is_active: !user.is_active }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(
        updated.is_active
          ? `${updated.full_name} reactivated.`
          : `${updated.full_name} suspended.`,
      );
      setToggling(null);
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const stats = query.data?.stats;
  const pageData = query.data?.users;
  const rows = pageData?.results ?? [];

  const deleteMutation = useMutation({
    mutationFn: (user: User) => adminApi.users.delete(user.id),
    onSuccess: (_, user) => {
      // Deleting the only row of a later page would leave the query pointed
      // at a page the backend now 404s ("Invalid page.") — step back first.
      if (rows.length === 1 && page > 1) setPage(page - 1);
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      toast.success(`${user.full_name} deleted.`);
      setDeleting(null);
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  // The backend has no self-delete guard, so the portal at least refuses the
  // obvious footgun: the signed-in admin deleting their own account.
  const myAdminId = getAdminUser()?.id;

  const columns: Array<Column<User>> = [
    {
      key: "user",
      header: "User",
      render: (user) => (
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
              user.is_active ? "bg-blue-600" : "bg-gray-400",
            )}
          >
            {initialsOf(user.full_name)}
          </span>
          <div className="min-w-0">
            <p className="max-w-48 truncate font-medium text-gray-900">
              {user.full_name}
            </p>
            <p className="max-w-48 truncate text-xs text-gray-500">
              {user.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "batch",
      header: "Batch",
      render: (user) => <span className="text-gray-600">{user.batch}</span>,
    },
    {
      key: "gender",
      header: "Gender",
      render: (user) => (
        <span className="capitalize text-gray-600">{user.gender}</span>
      ),
    },
    {
      key: "verified",
      header: "Verified",
      render: (user) =>
        user.is_verified ? (
          <ABadge tone="green">
            <BadgeCheck className="size-3" /> Verified
          </ABadge>
        ) : (
          <ABadge tone="gray">Unverified</ABadge>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (user) =>
        user.is_active ? (
          <ABadge tone="blue">Active</ABadge>
        ) : (
          <ABadge tone="red">Suspended</ABadge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      render: (user) => (
        <div className="flex justify-end gap-1">
          <AButton
            variant="ghost"
            size="sm"
            onClick={() => setEditing(user)}
            aria-label={`Edit ${user.full_name}`}
          >
            <Pencil className="size-3.5" />
          </AButton>
          <AButton
            variant={user.is_active ? "ghostDanger" : "ghostSuccess"}
            size="sm"
            onClick={() => setToggling(user)}
            aria-label={
              user.is_active
                ? `Suspend ${user.full_name}`
                : `Reactivate ${user.full_name}`
            }
          >
            {user.is_active ? (
              <ShieldBan className="size-3.5" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
          </AButton>
          {user.id !== myAdminId && (
            <AButton
              variant="ghostDanger"
              size="sm"
              onClick={() => setDeleting(user)}
              aria-label={`Delete ${user.full_name}`}
            >
              <Trash2 className="size-3.5" />
            </AButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account on the platform."
        actions={
          <AButton onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" /> New user
          </AButton>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Total" value={stats?.users_count} icon={UsersIcon} loading={query.isLoading} />
        <StatCard label="Active" value={stats?.active_users} icon={ShieldCheck} tone="green" loading={query.isLoading} />
        <StatCard label="Suspended" value={stats?.blocked_users} icon={UserX} tone="red" loading={query.isLoading} />
        <StatCard label="Online" value={stats?.online_users} icon={Wifi} tone="green" loading={query.isLoading} />
        <StatCard label="Verified" value={stats?.verified_users} icon={BadgeCheck} tone="blue" loading={query.isLoading} />
      </div>

      <ACard>
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3">
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search name, email or batch…"
            busy={query.isFetching && !query.isLoading}
            className="w-full sm:w-64"
          />
          <ASelect
            value={isActive}
            onChange={(event) => setIsActive(event.target.value)}
            aria-label="Filter by status"
            widthClass="w-auto"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Suspended</option>
          </ASelect>
          <ASelect
            value={isVerified}
            onChange={(event) => setIsVerified(event.target.value)}
            aria-label="Filter by verification"
            widthClass="w-auto"
          >
            <option value="">All verification</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </ASelect>
          <ASelect
            value={gender}
            onChange={(event) => setGender(event.target.value)}
            aria-label="Filter by gender"
            widthClass="w-auto"
          >
            <option value="">All genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </ASelect>
          <AInput
            value={batchInput}
            onChange={(event) => setBatchInput(event.target.value)}
            placeholder="Batch"
            aria-label="Filter by exact batch"
            widthClass="w-24"
          />
        </div>

        {query.isError ? (
          <AEmpty
            icon={UsersIcon}
            title="Couldn't load users"
            description={parseApiError(query.error).message}
            action={<AButton onClick={() => void query.refetch()}>Retry</AButton>}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(user) => user.id}
              loading={query.isLoading}
              empty={
                <AEmpty
                  icon={UsersIcon}
                  title={search ? "No matching users" : "No users yet"}
                  description={
                    search
                      ? `Nothing matches “${search}”.`
                      : "Created accounts will appear here."
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

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditUserModal user={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        onConfirm={() => toggling && toggleMutation.mutate(toggling)}
        busy={toggleMutation.isPending}
        tone={toggling?.is_active ? "danger" : "primary"}
        title={toggling?.is_active ? "Suspend this user?" : "Reactivate this user?"}
        confirmLabel={toggling?.is_active ? "Suspend" : "Reactivate"}
        body={
          toggling?.is_active ? (
            <p>
              <span className="font-medium text-gray-900">{toggling.full_name}</span>{" "}
              will no longer be able to sign in. Existing sessions stop working
              on their next request.
            </p>
          ) : (
            <p>
              <span className="font-medium text-gray-900">{toggling?.full_name}</span>{" "}
              will be able to sign in again.
            </p>
          )
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        busy={deleteMutation.isPending}
        title="Delete this user?"
        confirmLabel="Delete permanently"
        body={
          <>
            <p>
              <span className="font-medium text-gray-900">
                {deleting?.full_name}
              </span>{" "}
              <span className="text-gray-500">({deleting?.email})</span> will be
              permanently deleted, along with everything tied to the account —
              chats, messages, reports and any events they own.
            </p>
            <p className="mt-2 font-medium text-red-600">
              This cannot be undone. To just block access, use Suspend instead.
            </p>
          </>
        }
      />
    </>
  );
}
