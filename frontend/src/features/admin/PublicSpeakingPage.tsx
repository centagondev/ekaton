import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MegaphoneOff, MessagesSquare, Trash2 } from "lucide-react";
import { parseApiError } from "@/lib/errors";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import type { PageResult } from "@/types/api";
import {
  ABadge,
  AButton,
  ACard,
  AEmpty,
  ConfirmDialog,
  notify,
  PageEnter,
  PageHeader,
  RowSkeletons,
  SearchBox,
  useDebouncedValue,
} from "./ui";
import { adminApi, type AdminMessage, type AdminSort } from "./api";

const SPEAKING_KEY = ["admin", "public-speaking", "messages"] as const;

const SORTS: ReadonlyArray<{ value: AdminSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "votes", label: "Most voted" },
];

/**
 * Moderation for the public speaking wall, living inside the portal now
 * instead of on its own standalone page. Same functionality as before: read
 * the responses, delete the ones that shouldn't be on screen.
 */
export function AdminPublicSpeakingPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [sort, setSort] = useState<AdminSort>("newest");
  const [target, setTarget] = useState<AdminMessage | null>(null);

  const query = useQuery({
    queryKey: [...SPEAKING_KEY, search, sort],
    queryFn: () => adminApi.speaking.messages({ search, sort }),
    // Keeps the current rows on screen while a debounced search resolves, so
    // the list doesn't collapse into skeletons on every keystroke.
    placeholderData: keepPreviousData,
    // 404 is a real answer ("no discussion right now"), not a flaky request;
    // auth failures are already being redirected by the layout.
    retry: (failureCount, error) => {
      const { status } = parseApiError(error);
      return status !== 404 && status !== 401 && status !== 403 && failureCount < 2;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.speaking.deleteMessage(id),
    // Optimistic: the row leaves the list (and its exit animation plays) the
    // moment the admin confirms, without waiting on the network.
    onMutate: async (id) => {
      const key = [...SPEAKING_KEY, search, sort];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PageResult<AdminMessage>>(key);
      if (previous) {
        queryClient.setQueryData<PageResult<AdminMessage>>(key, {
          ...previous,
          count: Math.max(0, previous.count - 1),
          results: previous.results.filter((message) => message.id !== id),
        });
      }
      setTarget(null);
      return { key, previous };
    },
    onSuccess: () => notify.success("Message deleted."),
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      notify.error(parseApiError(error).message);
    },
    onSettled: () => {
      // Every search/sort combination is now stale, not just the visible one.
      void queryClient.invalidateQueries({ queryKey: SPEAKING_KEY });
    },
  });

  const messages = query.data?.results ?? [];
  const parsedError = query.error ? parseApiError(query.error) : null;
  const noDiscussion = parsedError?.status === 404;
  const count = query.data?.count ?? messages.length;

  return (
    <PageEnter>
      <PageHeader
        title="Public Speaking"
        description="Moderate the live discussion wall."
      />

      <ACard>
        <div className="grid grid-cols-2 gap-2 border-b border-a-line p-3 sm:flex sm:flex-wrap sm:items-center">
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search responses or names…"
            busy={query.isFetching && !query.isLoading}
            className="col-span-2 w-full lg:w-72"
          />
          <div
            role="group"
            aria-label="Sort responses"
            className="col-span-2 grid grid-cols-2 overflow-hidden rounded-lg border border-a-line-strong a-elev sm:flex"
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
                    "h-11 px-3.5 text-sm font-medium transition-colors sm:h-9",
                    index > 0 && "border-l border-a-line-strong",
                    active
                      ? "bg-a-accent-soft text-a-accent-text"
                      : "bg-a-surface text-a-muted hover:bg-a-raised",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {!query.isLoading && !parsedError && (
            <p className="col-span-2 w-full text-right text-xs text-a-muted lg:ml-auto lg:w-auto">
              {count.toLocaleString("en")} response{count === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {query.isLoading ? (
          <RowSkeletons />
        ) : noDiscussion ? (
          <AEmpty
            icon={MegaphoneOff}
            title="No discussion is running"
            description="When a public speaking session goes live, its responses appear here for moderation."
          />
        ) : parsedError ? (
          <AEmpty
            icon={MessagesSquare}
            title="Couldn't load the responses"
            description={parsedError.message}
            action={<AButton onClick={() => void query.refetch()}>Retry</AButton>}
          />
        ) : messages.length === 0 ? (
          <AEmpty
            icon={MessagesSquare}
            title={search ? "No matches" : "No responses yet"}
            description={
              search
                ? `Nothing matches “${search}”. Try a different word.`
                : "Nothing has been posted to the wall yet."
            }
          />
        ) : (
          <ul className="divide-y divide-a-line">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.li
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="flex items-start gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-medium text-a-ink">
                        {message.display_name}
                        {message.real_name && (
                          <span className="font-normal text-a-muted">
                            {" "}
                            ({message.real_name})
                          </span>
                        )}
                      </span>
                      <ABadge tone="gray">
                        <Heart className="size-3" />
                        {message.upvote_count}
                        <span className="sr-only"> votes</span>
                      </ABadge>
                      <time
                        dateTime={message.created_at}
                        title={formatDateTime(message.created_at)}
                        className="text-xs text-a-faint"
                      >
                        {timeAgo(message.created_at)}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-a-text">
                      {message.content}
                    </p>
                  </div>
                  <AButton
                    variant="ghostDanger"
                    size="sm"
                    onClick={() => setTarget(message)}
                    aria-label={`Delete response from ${message.display_name}`}
                    className="shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </AButton>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </ACard>

      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        onConfirm={() => target && deleteMutation.mutate(target.id)}
        busy={deleteMutation.isPending}
        title="Delete this message?"
        confirmLabel="Delete"
        body={
          <>
            <p>
              This permanently removes the response and every vote it received.
              It cannot be undone.
            </p>
            {target && (
              <p className="mt-3 line-clamp-4 rounded-lg bg-a-raised px-3 py-2 text-sm text-a-text">
                {target.content}
              </p>
            )}
          </>
        }
      />
    </PageEnter>
  );
}
