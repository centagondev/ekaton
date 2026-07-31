import { useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Heart, MegaphoneOff, MessagesSquare, Trash2 } from "lucide-react";
import { parseApiError } from "@/lib/errors";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import {
  ABadge,
  AButton,
  ACard,
  AEmpty,
  ConfirmDialog,
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
  const search = useDebouncedValue(searchInput.trim(), 300);
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
    onSuccess: () => {
      // Every search/sort combination is now stale, not just the visible one.
      void queryClient.invalidateQueries({ queryKey: SPEAKING_KEY });
      toast.success("Message deleted.");
      setTarget(null);
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const messages = query.data?.results ?? [];
  const parsedError = query.error ? parseApiError(query.error) : null;
  const noDiscussion = parsedError?.status === 404;
  const count = query.data?.count ?? messages.length;

  return (
    <>
      <PageHeader
        title="Public Speaking"
        description="Moderate the live discussion wall."
      />

      <ACard>
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3">
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search responses or names…"
            busy={query.isFetching && !query.isLoading}
            className="w-full sm:w-72"
          />
          <div
            role="group"
            aria-label="Sort responses"
            className="flex overflow-hidden rounded-lg border border-gray-300 shadow-sm"
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
                    "h-9 px-3.5 text-sm font-medium transition-colors",
                    index > 0 && "border-l border-gray-300",
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "bg-white text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {!query.isLoading && !parsedError && (
            <p className="ml-auto text-xs text-gray-500">
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
          <ul className="divide-y divide-gray-100">
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
                      <span className="text-sm font-medium text-gray-900">
                        {message.display_name}
                      </span>
                      <ABadge tone="gray">
                        <Heart className="size-3" />
                        {message.upvote_count}
                        <span className="sr-only"> votes</span>
                      </ABadge>
                      <time
                        dateTime={message.created_at}
                        title={formatDateTime(message.created_at)}
                        className="text-xs text-gray-400"
                      >
                        {timeAgo(message.created_at)}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
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
              <p className="mt-3 line-clamp-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {target.content}
              </p>
            )}
          </>
        }
      />
    </>
  );
}
