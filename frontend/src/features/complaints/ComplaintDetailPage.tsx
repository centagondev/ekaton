import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Pencil, Send, Timer, Trash2 } from "lucide-react";
import { complaintsApi, COMPLAINT_MAX_BODY } from "@/lib/api/complaints";
import { parseApiError } from "@/lib/errors";
import { cn, cursorFromUrl, editWindowLeft, timeAgo } from "@/lib/utils";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CategoryBadge,
  ComplaintFormModal,
  StatusBadge,
  UpvoteButton,
  forgetMyComplaint,
  isMyComplaint,
} from "./complaint-shared";

export function ComplaintDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [windowLeft, setWindowLeft] = useState(0);

  const query = useQuery({
    queryKey: ["complaints", id],
    queryFn: () => complaintsApi.detail(id),
    enabled: Boolean(id),
  });
  const complaint = query.data;

  // Ownership isn't exposed by the API; offer edit/delete only for complaints
  // created in this browser, inside the window the backend enforces anyway.
  const mine = useMemo(() => isMyComplaint(id), [id]);

  useEffect(() => {
    if (!mine || !complaint) return;
    const tick = () => setWindowLeft(editWindowLeft(complaint.created_at));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [mine, complaint]);

  const canModify = mine && windowLeft > 0;

  const deleteMutation = useMutation({
    mutationFn: () => complaintsApi.remove(id),
    onSuccess: () => {
      forgetMyComplaint(id);
      void queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast.success("Complaint deleted.");
      navigate("/complaints");
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  if (query.isLoading) {
    return (
      <PageTransition className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </PageTransition>
    );
  }

  if (query.isError || !complaint) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Complaint not found"
        description="It may have been deleted."
        action={<Button onClick={() => navigate("/complaints")}>Back to the box</Button>}
      />
    );
  }

  return (
    <PageTransition className="mx-auto max-w-3xl">
      <Link
        to="/complaints"
        className="mb-6 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Complaint box
      </Link>

      <article className="border-2 border-ink bg-surface p-6 shadow-brutal sm:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CategoryBadge category={complaint.category} />
          <StatusBadge status={complaint.status} />
          <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-muted">
            {timeAgo(complaint.created_at)}
          </span>
        </div>

        <h1 className="mb-3 text-3xl font-black leading-tight">{complaint.title}</h1>
        <p className="mb-6 whitespace-pre-wrap text-sm leading-relaxed">
          {complaint.description}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <UpvoteButton complaintId={complaint.id} count={complaint.upvote_count} />
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            by {complaint.author_name}
            {complaint.author_batch ? ` · ${complaint.author_batch}` : ""}
          </span>

          {canModify && (
            <div className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1 font-mono text-[11px] uppercase">
                <Timer className="size-3.5" />
                {Math.ceil(windowLeft / 1000)}s
              </span>
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="danger"
                aria-label="Delete complaint"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </article>

      <CommentsSection complaintId={id} />

      <ComplaintFormModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["complaints", id] });
        }}
        complaint={complaint}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this complaint?"
      >
        <p className="mb-5 text-sm text-muted">
          This permanently removes the complaint and its discussion.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </PageTransition>
  );
}

/* -------------------------------- comments -------------------------------- */

interface CommentFormValues {
  comment: string;
  is_anonymous: boolean;
}

function CommentsSection({ complaintId }: { complaintId: string }) {
  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const form = useForm<CommentFormValues>({
    defaultValues: { comment: "", is_anonymous: true },
  });
  const anonymous = form.watch("is_anonymous");

  const query = useInfiniteQuery({
    queryKey: ["complaints", complaintId, "comments"],
    queryFn: ({ pageParam }) => complaintsApi.comments(complaintId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => cursorFromUrl(lastPage.next),
  });

  const comments = query.data?.pages.flatMap((page) => page.results) ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const addMutation = useMutation({
    mutationFn: (values: CommentFormValues) =>
      complaintsApi.addComment(complaintId, {
        comment: values.comment.trim(),
        is_anonymous: values.is_anonymous,
      }),
    onSuccess: () => {
      form.reset({ comment: "", is_anonymous: anonymous });
      void queryClient.invalidateQueries({
        queryKey: ["complaints", complaintId, "comments"],
      });
      void queryClient.invalidateQueries({ queryKey: ["complaints", complaintId] });
      toast.success("Comment added.");
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  return (
    <section className="mt-10" aria-label="Comments">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black uppercase tracking-wide">
        <MessageSquare className="size-5" /> Discussion
      </h2>

      <form
        onSubmit={form.handleSubmit((values) => addMutation.mutateAsync(values).catch(() => {}))}
        className="mb-6 space-y-3 border-2 border-ink bg-surface p-4"
      >
        <Field label="Add a comment" error={form.formState.errors.comment?.message ?? null}>
          {(id) => (
            <Textarea
              id={id}
              placeholder="Say something useful…"
              className="min-h-20"
              maxLength={COMPLAINT_MAX_BODY}
              {...form.register("comment", {
                required: "Write something first.",
                maxLength: { value: COMPLAINT_MAX_BODY, message: "Max 2000 characters." },
              })}
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-3 border-2 border-ink bg-raised px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wide">Comment anonymously</span>
            <input type="checkbox" className="sr-only" {...form.register("is_anonymous")} />
            <span
              aria-hidden="true"
              className={cn(
                "relative h-5 w-10 border-2 border-ink transition-colors",
                anonymous ? "bg-brand-lime" : "bg-surface",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-3 bg-ink transition-all",
                  anonymous ? "left-[1.375rem]" : "left-0.5",
                )}
              />
            </span>
          </label>

          <Button type="submit" loading={addMutation.isPending}>
            <Send className="size-4" /> Post
          </Button>
        </div>
      </form>

      {query.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      )}

      {!query.isLoading && comments.length === 0 && (
        <p className="border-2 border-dashed border-ink/40 p-6 text-center text-sm text-muted">
          No comments yet. Start the discussion.
        </p>
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {comments.map((comment) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-2 border-ink bg-surface p-4"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide">
                  {comment.author_name}
                  {comment.author_batch && (
                    <span className="text-muted"> · {comment.author_batch}</span>
                  )}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {timeAgo(comment.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.comment}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div ref={sentinelRef} className="flex justify-center py-6">
        {isFetchingNextPage && <Spinner />}
      </div>
    </section>
  );
}
