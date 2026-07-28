import { apiPost } from "./client";
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

  report: (payload: ReportPayload): Promise<null> =>
    apiPost<null>("/chat/report/", payload),
};

export const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "abusive_language", label: "Abusive language" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "fake_identity", label: "Fake identity" },
  { value: "other", label: "Other" },
];
