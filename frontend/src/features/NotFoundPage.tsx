import { Link } from "react-router-dom";
import { PageTransition } from "@/components/layout/PageTransition";

export function NotFoundPage() {
  return (
    <PageTransition className="flex min-h-dvh items-center justify-center px-4">
      <div className="space-y-6 text-center">
        <p className="text-8xl font-black [text-shadow:6px_6px_0_var(--color-brand-yellow)]">
          404
        </p>
        <h1 className="text-2xl font-black uppercase tracking-wide">Page not found</h1>
        <Link
          to="/"
          className="inline-block border-2 border-ink bg-brand-yellow px-6 py-3 font-extrabold uppercase tracking-wide text-ink shadow-brutal transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm"
        >
          Back home
        </Link>
      </div>
    </PageTransition>
  );
}
