import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Megaphone, MessageSquare, Plus } from "lucide-react";
import { complaintsApi } from "@/lib/api/complaints";
import { pageFromUrl, timeAgo } from "@/lib/utils";
import { PUBLIC_SPEAKING_MODE } from "@/lib/config";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { Spinner } from "@/components/ui/Spinner";
import {
  CategoryBadge,
  ComplaintFormModal,
  StatusBadge,
  UpvoteButton,
} from "./complaint-shared";

export function ComplaintsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Demo visitors have no JWT, so this request would 401 — and real complaints
  // must not be shown publicly. Hook stays unconditional.
  const query = useInfiniteQuery({
    queryKey: ["complaints", "feed"],
    queryFn: ({ pageParam }) => complaintsApi.list(pageParam, 10),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => pageFromUrl(lastPage.next),
    enabled: !PUBLIC_SPEAKING_MODE,
  });

  const complaints = query.data?.pages.flatMap((page) => page.results) ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Infinite scroll.
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (PUBLIC_SPEAKING_MODE) {
    return (
      <PageTransition>
        <ComingSoon
          icon={<Megaphone className="size-7" />}
          title="Complaint Box"
          description="Soon you'll be able to post complaints anonymously, upvote the ones that matter, and discuss them in the comments — no name attached, ever. Launching soon."
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Speak up, stay unknown
          </p>
          <h1 className="text-4xl font-black uppercase tracking-tight">
            Complaint{" "}
            <span className="inline-block -rotate-1 bg-brand-lime px-2">box</span>
          </h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New complaint
        </Button>
      </div>

      {query.isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      )}

      {query.isError && (
        <EmptyState
          icon={Megaphone}
          title="Couldn't load the feed"
          description="Something went wrong talking to the server."
          action={<Button onClick={() => void query.refetch()}>Retry</Button>}
        />
      )}

      {!query.isLoading && !query.isError && complaints.length === 0 && (
        <EmptyState
          icon={Megaphone}
          title="No complaints yet"
          description="The box is empty. Got something on your mind? Post the first one."
          action={<Button onClick={() => setCreateOpen(true)}>Write the first</Button>}
        />
      )}

      <div className="space-y-4">
        {complaints.map((complaint, index) => (
          <motion.article
            key={complaint.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(index % 10, 5) * 0.04 }}
          >
            <Link
              to={`/complaints/${complaint.id}`}
              className="block border-2 border-ink bg-surface p-5 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <CategoryBadge category={complaint.category} />
                <StatusBadge status={complaint.status} />
                <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-muted">
                  {timeAgo(complaint.created_at)}
                </span>
              </div>
              <h2 className="mb-1 text-xl font-black leading-snug">{complaint.title}</h2>
              <p className="mb-4 line-clamp-2 text-sm text-muted">{complaint.description}</p>
              <div className="flex items-center gap-3">
                <UpvoteButton complaintId={complaint.id} count={complaint.upvote_count} />
                <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                  <MessageSquare className="size-4" />
                  {complaint.comment_count}
                </span>
                <span className="ml-auto text-xs font-bold uppercase tracking-wide text-muted">
                  {complaint.author_name}
                  {complaint.author_batch ? ` · ${complaint.author_batch}` : ""}
                </span>
              </div>
            </Link>
          </motion.article>
        ))}
      </div>

      <div ref={sentinelRef} className="flex justify-center py-8">
        {isFetchingNextPage && <Spinner />}
        {!hasNextPage && complaints.length > 0 && (
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            That's everything
          </p>
        )}
      </div>

      <ComplaintFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageTransition>
  );
}
