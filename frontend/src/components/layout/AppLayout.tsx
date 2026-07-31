import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { BottomNav } from "./BottomNav";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/** Shell for authenticated routes. Full-bleed screens (chat) opt out of this. */
export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      {/*
        viewport-fit=cover lets the page run under the notch and the home
        indicator, so the gutters take whichever is larger: the design's
        spacing, or the space the hardware needs.
      */}
      {/*
        The bottom padding clears BottomNav's 4.25rem bar plus the home
        indicator, so the last element on a page is never trapped underneath
        it. From `md` the bar is gone and the padding returns to normal.
      */}
      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom)+2rem)] pt-8 md:pb-[max(2rem,env(safe-area-inset-bottom))]"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <ErrorBoundary area="app">
          <Outlet />
        </ErrorBoundary>
      </main>

      <BottomNav />
    </div>
  );
}
