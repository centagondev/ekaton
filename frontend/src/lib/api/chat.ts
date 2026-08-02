import { apiPost, apiPostForm } from "./client";
import { API_URL } from "../config";
import { getAccessToken } from "../storage";
import type { ReportPayload, ReportReason, StartChatResult } from "@/types/api";

export const chatApi = {
  /**
   * Matchmaking entry point AND the only way to discover a match: the backend
   * never pushes, so a waiting client must call this again until it returns
   * "matched" or "active" with a room_id.
   */
  start: (): Promise<StartChatResult> => apiPost<StartChatResult>("/chat/start/"),

  /**
   * Release the waiting-queue slot. Idempotent, and never rejects — a failed
   * leave must not surface as an error to a user who has already looked away.
   *
   * Deliberately NOT on the axios instance. This is sent while the page is
   * being hidden or unloaded, where an ordinary XHR is cancelled the moment the
   * document is torn down or the phone freezes the tab. `keepalive` hands the
   * request to the browser's network stack, which completes it independently of
   * the page — the same guarantee `sendBeacon` gives, except beacons cannot
   * carry an `Authorization` header, and this endpoint needs the JWT.
   *
   * The token is read straight from storage rather than through the refresh
   * path: awaiting a refresh is exactly the kind of async work a freezing tab
   * never gets to finish. A user who just clicked "Start chat" has a fresh
   * token by definition, and in the rare stale case the server-side liveness
   * TTL is still there as the backstop.
   */
  leaveQueue: (): void => {
    const token = getAccessToken();
    if (!token) return;

    void fetch(`${API_URL}/chat/cancel/`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: "{}",
    })
      .then((res) => {
        // Swallowed in production, but a leave that silently 404s or 401s
        // looks exactly like the feature not being implemented at all. Say so
        // in dev rather than leaving it to be diagnosed from the queue.
        if (!res.ok && import.meta.env.DEV) {
          console.warn(`[matchmaking] leave queue failed: ${res.status}`);
        }
      })
      .catch(() => {});
  },

  end: (roomId: string): Promise<null> =>
    apiPost<null>("/chat/end/", { room_id: roomId }),

  /**
   * Multipart only when a screenshot is attached — the JSON path is the one
   * every existing caller already takes, and there is no reason to move a
   * text-only report onto a heavier encoding.
   */
  report: ({ evidence_image, ...payload }: ReportPayload): Promise<null> => {
    if (!evidence_image) return apiPost<null>("/chat/report/", payload);

    const form = new FormData();
    form.append("room_id", payload.room_id);
    form.append("reason", payload.reason);
    if (payload.description) form.append("description", payload.description);
    if (payload.evidence_url) form.append("evidence_url", payload.evidence_url);
    form.append("evidence_image", evidence_image);

    return apiPostForm<null>("/chat/report/", form);
  },
};

export const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "abusive_language", label: "Abusive language" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "fake_identity", label: "Fake identity" },
  { value: "other", label: "Other" },
];
