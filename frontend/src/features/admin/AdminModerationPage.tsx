import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Heart, LogOut, MessagesSquare, Search, Trash2 } from "lucide-react";
import { clearSession } from "@/lib/storage";
import { parseApiError } from "@/lib/errors";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTransition } from "@/components/layout/PageTransition";
import { adminApi, type AdminMessage, type AdminSort } from "./api";

const SEARCH_DEBOUNCE_MS = 300;

const SORTS: ReadonlyArray<{ value: AdminSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "votes", label: "Most voted" },
];

function RowSkeleton() {
  return (
    <div className="space-y-3 border-2 border-ink bg-surface p-4 sm:p-5">
      <div className="flex gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-14" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/**
 * Moderation for the public speaking wall: read the responses, delete the ones
 * that shouldn't be on screen. Nothing else — this is not an admin console.
 */
export function AdminModerationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AdminSort>("newest");
  const [target, setTarget] = useState<AdminMessage | null>(null);

  // Typing must not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useQuery({
    queryKey: ["admin", "public-speaking", "messages", search, sort],
    queryFn: () => adminApi.messages({ search, sort }),
    // Keeps the current rows on screen while a debounced search resolves, so
    // the list doesn't collapse into skeletons on every keystroke.
    placeholderData: keepPreviousData,
    // Retrying an auth failure only delays the redirect below.
    retry: (failureCount, error) => {
      const { status } = parseApiError(error);
      return status !== 401 && status !== 403 && failureCount < 2;
    },
  });

  const queryError = query.error;

  /**
   * The only authorization check that means anything.
   *
   * There is no client-side staff flag to consult — the server decides, and a
   * 401 (no/expired token) or 403 (authenticated but not staff) is that
   * decision. A non-staff token is left in place: it is still valid for the
   * rest of the app, it just isn't valid here.
   */
  useEffect(() => {
    if (!queryError) return;
    const { status } = parseApiError(queryError);
    if (status === 401 || status === 403) {
      toast.error("Admin access is required.");
      navigate("/admin", { replace: true });
    }
  }, [queryError, navigate]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteMessage(id),
    onSuccess: () => {
      // Every search/sort combination is now stale, not just the visible one.
      void queryClient.invalidateQueries({ queryKey: ["admin", "public-speaking", "messages"] });
      toast.success("Message deleted.");
      setTarget(null);
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const messages = query.data?.results ?? [];
  const parsedError = queryError ? parseApiError(queryError) : null;
  const isAuthError = parsedError?.status === 401 || parsedError?.status === 403;

  return (
    <PageTransition className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted">
            Moderation
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
            Public Speaking{" "}
            <span className="inline-block -rotate-1 bg-brand-yellow px-2">Moderation</span>
          </h1>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-9"
          onClick={() => {
            clearSession();
            navigate("/admin", { replace: true });
          }}
        >
          <LogOut className="size-3.5" /> Log out
        </Button>
      </header>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Search">
            {(id) => (
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <Input
                  id={id}
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search responses or names…"
                  className="pl-9 pr-10"
                />
                {query.isFetching && (
                  <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                )}
              </div>
            )}
          </Field>
        </div>

        <div
          role="group"
          aria-label="Sort responses"
          className="flex shrink-0 border-2 border-ink shadow-brutal-sm"
        >
          {SORTS.map((option, index) => {
            const active = sort === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setSort(option.value)}
                className={cn(
                  "min-h-9 flex-1 px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
                  index > 0 && "border-l-2 border-ink",
                  active ? "bg-brand-yellow text-ink" : "bg-surface text-muted hover:bg-raised",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {query.isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, index) => (
            <RowSkeleton key={index} />
          ))}
        </div>
      )}

      {/* An auth error is already redirecting; showing a retry here would just
          invite another 403. */}
      {parsedError && !isAuthError && (
        <EmptyState
          icon={MessagesSquare}
          title="Couldn't load the responses"
          description={parsedError.message}
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        />
      )}

      {!query.isLoading && !parsedError && messages.length === 0 && (
        <EmptyState
          icon={MessagesSquare}
          title={search ? "No matches" : "No responses yet"}
          description={
            search
              ? `Nothing matches “${search}”. Try a different word.`
              : "Nothing has been posted to the wall yet."
          }
        />
      )}

      {messages.length > 0 && (
        <>
          <p className="mb-3 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted">
            {query.data?.count ?? messages.length} response
            {(query.data?.count ?? messages.length) === 1 ? "" : "s"}
          </p>

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.article
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="border-2 border-ink bg-surface p-4 shadow-brutal-sm sm:p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="border-2 border-ink bg-brand-lavender px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.15em]">
                      {message.display_name}
                    </span>
                    <span className="flex items-center gap-1.5 border-2 border-ink bg-surface px-2 py-1 font-mono text-[10px] font-black tabular-nums">
                      <Heart aria-hidden="true" className="size-3" />
                      {message.upvote_count}
                      <span className="sr-only"> votes</span>
                    </span>
                    <time
                      dateTime={message.created_at}
                      title={formatDateTime(message.created_at)}
                      className="font-mono text-[11px] uppercase tracking-wider text-muted"
                    >
                      {timeAgo(message.created_at)}
                    </time>
                    <Button
                      variant="danger"
                      size="sm"
                      className="ml-auto min-h-9"
                      onClick={() => setTarget(message)}
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {message.content}
                  </p>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Delete this message?"
      >
        <p className="mb-4 text-sm text-muted">
          This permanently removes the response and every vote it received. It cannot be
          undone.
        </p>
        {target && (
          <p className="mb-5 line-clamp-4 border-2 border-ink bg-raised px-4 py-3 text-sm">
            {target.content}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => target && deleteMutation.mutate(target.id)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </PageTransition>
  );
}
