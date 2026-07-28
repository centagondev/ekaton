import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

/**
 * StrictMode is intentionally omitted: its dev-only double-invoked effects
 * open and immediately close the chat WebSocket, and the backend ends a
 * private room permanently on any disconnect.
 */
createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary area="root">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
    <Toaster
      position="top-center"
      theme="light"
      toastOptions={{
        className:
          "!rounded-none !border-2 !border-[#0a0a0a] !bg-white !text-[#0a0a0a] !shadow-[4px_4px_0px_#0a0a0a] !font-sans",
      }}
    />
  </QueryClientProvider>,
);
