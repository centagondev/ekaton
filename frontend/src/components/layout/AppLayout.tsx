import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/** Shell for authenticated routes. Full-bleed screens (chat) opt out of this. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <ErrorBoundary area="app">
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
