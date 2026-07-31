import { apiGet, apiPost } from "@/lib/api/client";

/**
 * Uses the SAME shared, JWT-authenticated client as every other feature.
 *
 * Public Speaking used to have its own axios instance and its own
 * cookie/localStorage-held identity, because it was reachable without an
 * account. It now requires login like everything else, so the authenticated
 * account IS the identity — there is nothing left for a bespoke client or a
 * browser-held token to do.
 */

export interface Discussion {
  id: string;
  title: string;
  topic: string;
  is_active: boolean;
}

export interface SpeakingMessage {
  id: string;
  content: string;
  display_name: string;
  upvote_count: number;
  has_upvoted: boolean;
  /** True only on the caller's own response — voting for it is blocked. */
  is_own: boolean;
  created_at: string;
}

interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ParticipantState {
  joined: boolean;
  display_name: string | null;
  already_posted: boolean;
}

export const publicSpeakingApi = {
  discussion: () => apiGet<Discussion>("/public-speaking/"),

  /**
   * This account's participation state, straight from the database.
   *
   * Identity is `request.user` on the backend now, not a stored token, so
   * this is accurate regardless of browser, tab or incognito mode.
   */
  state: () => apiGet<ParticipantState>("/public-speaking/state/"),

  /**
   * Joining twice returns the same anonymous name and the same `has_posted`
   * state — the account is the identity, so there is no separate token to
   * hold onto between calls.
   */
  join: () =>
    apiPost<{ display_name: string; has_posted: boolean }>("/public-speaking/join/"),

  /**
   * The whole wall, not one page.
   *
   * The endpoint paginates at 10 by default, which would silently hide every
   * response past the tenth. 100 is the backend's max_page_size.
   */
  async messages(): Promise<SpeakingMessage[]> {
    const page = await apiGet<Page<SpeakingMessage>>("/public-speaking/messages/", {
      page_size: 100,
    });
    return page.results;
  },
};
