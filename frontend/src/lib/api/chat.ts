import { apiPost, apiPostForm } from "./client";
import type { ReportPayload, ReportReason, StartChatResult } from "@/types/api";

export const chatApi = {
  /**
   * Matchmaking entry point AND the only way to discover a match: the backend
   * never pushes, so a waiting client must call this again until it returns
   * "matched" or "active" with a room_id.
   */
  start: (): Promise<StartChatResult> => apiPost<StartChatResult>("/chat/start/"),

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
