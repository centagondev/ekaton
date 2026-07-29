import { useQuery } from "@tanstack/react-query";
import { VenetianMask } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";
import { BackButton } from "@/components/ui/BackButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { publicSpeakingApi } from "./api";

/**
 * Read-only identity card for demo mode.
 *
 * The real ProfilePage reads the signed-in user from the auth store; demo
 * visitors have no account, so this shows the only identity they actually
 * have — the anonymous name allocated for this browser session. No editable
 * fields, no logout, no account data.
 */
export function DemoProfilePage() {
  /**
   * Read-only: /state/ resolves identity from the stored token OR the HttpOnly
   * cookie and creates nothing. The old version gated on localStorage and
   * re-POSTed /join/, so a cookie-only visitor was wrongly told they had no
   * identity — and merely opening Profile could mint one.
   */
  const identity = useQuery({
    queryKey: ["public-speaking", "state"],
    queryFn: publicSpeakingApi.state,
    retry: false,
  });

  return (
    <PageTransition className="mx-auto w-full max-w-2xl">
      <BackButton fallback="/public-speaking" label="Back" className="mb-6" />

      {!identity.isLoading && !identity.data?.joined ? (
        <EmptyState
          title="No identity yet"
          description="Join the discussion and you'll be given an anonymous name for this session."
        />
      ) : (
        <section
          className="border-2 border-ink bg-surface p-6 shadow-brutal sm:p-8"
          aria-label="Your anonymous identity"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center border-2 border-ink bg-brand-lavender">
              <VenetianMask className="size-8" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                You are
              </p>
              <p className="truncate text-2xl font-black uppercase leading-tight">
                {identity.isLoading ? "…" : (identity.data?.display_name ?? "Anonymous")}
              </p>
            </div>
          </div>

          <p className="mt-6 border-t-2 border-ink pt-5 text-sm text-muted">
            This name is yours for as long as this browser tab is open. Nobody —
            including us — can link it back to you. It is released when the
            session ends.
          </p>
        </section>
      )}
    </PageTransition>
  );
}
