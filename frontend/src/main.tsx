import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import App from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { queryClient } from "./lib/queryClient";
import { initTheme, useTheme } from "./lib/theme";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

// index.html already stamped the theme before the first paint; this is the
// same decision made once more from the module that owns it.
initTheme();

/**
 * Toasts render outside the app tree, so they subscribe to the theme
 * themselves. The frame is the product's brutalist one either way — only the
 * tokens behind it move.
 */
function AppToaster() {
  const theme = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={theme}
      // Every toast gets a ✕ so it can be dismissed on the spot rather than
      // waited out. Auto-dismiss is untouched — this is a second way to close,
      // not a replacement. sonner skips the button on `toast.custom`, so the
      // admin cards keep the ✕ they draw themselves instead of growing two.
      // It is squared off to match the brutalist frame in index.css.
      closeButton
      toastOptions={{
        className:
          "!rounded-none !border-2 !border-ink !bg-surface !text-ink !shadow-[4px_4px_0px_var(--ek-shadow)] !font-sans",
      }}
    />
  );
}

/**
 * StrictMode is intentionally omitted: its dev-only double-invoked effects
 * open and immediately close the chat WebSocket, and the backend ends a
 * private room permanently on any disconnect.
 */
createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    {/* The CSS media query in index.css cannot reach Framer's JS-driven
        animations; reducedMotion="user" is what actually honours the OS
        setting for the transitions, bubbles and looping indicators. */}
    <MotionConfig reducedMotion="user">
      <ErrorBoundary area="root">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </MotionConfig>
    <AppToaster />
  </QueryClientProvider>,
);
