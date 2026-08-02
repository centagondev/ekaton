import { QueryClient } from "@tanstack/react-query";

/**
 * The app's single React Query cache.
 *
 * Declared here rather than inline in main.tsx so that code outside the React
 * tree can reach it — specifically the auth store, which has to empty the
 * cache when a session ends. Every cached response was fetched as one
 * particular user and answers questions about them ("is this my event?"), so
 * carrying it across a sign-out would hand the next person to use the browser
 * the previous person's answers.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
