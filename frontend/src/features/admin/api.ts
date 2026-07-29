import { apiDelete, apiGet, apiPost } from "@/lib/api/client";
import type { LoginResult, PageResult } from "@/types/api";

/**
 * A public-speaking response as moderation sees it.
 *
 * Identical to the participant-facing shape (features/public-speaking/api.ts) —
 * the backend reuses one serializer. `has_upvoted` / `is_own` are always false
 * for a staff caller, who never joined the discussion, so the UI ignores them.
 */
export interface AdminMessage {
  id: string;
  content: string;
  display_name: string;
  upvote_count: number;
  has_upvoted: boolean;
  is_own: boolean;
  created_at: string;
}

export type AdminSort = "newest" | "votes";

export const adminApi = {
  /**
   * Staff-only login. A non-staff account gets the same 401 as a wrong
   * password, so nothing here can be used to probe who is an admin.
   */
  login: (credentials: { email: string; password: string }): Promise<LoginResult> =>
    apiPost<LoginResult>("/admin/login/", credentials),

  messages: ({
    search,
    sort = "newest",
  }: {
    search?: string;
    sort?: AdminSort;
  }): Promise<PageResult<AdminMessage>> =>
    apiGet<PageResult<AdminMessage>>("/public-speaking/admin/messages/", {
      // Omitted rather than sent blank, so an empty box and a cleared box
      // produce the same request the server already has cached.
      ...(search ? { search } : {}),
      sort,
    }),

  /** Cascades the message's votes away server-side. */
  deleteMessage: (id: string): Promise<null> =>
    apiDelete<null>(`/public-speaking/admin/messages/${id}/`),
};
