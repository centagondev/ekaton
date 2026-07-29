import axios from "axios";
import { API_URL } from "@/lib/config";
import type { ApiEnvelope, LoginResult, PageResult } from "@/types/api";

/**
 * A dedicated axios instance and dedicated storage keys — deliberately NOT the
 * product's.
 *
 * Sharing `lib/api/client` and the `access`/`refresh` keys silently fuses the
 * two sessions: a signed-in student who opens /admin and authenticates would
 * end up with the admin's bearer token while `user_profile` and the Zustand
 * store still described the student. Every subsequent request in the normal app
 * would then run as the admin behind the student's avatar, and the next
 * `bootstrap()` would overwrite the profile too. Namespacing keeps a moderation
 * session and a product session completely independent.
 *
 * It also means no refresh interceptor runs here, so a wrong password surfaces
 * its 401 directly instead of triggering a token refresh and a credential
 * replay against a throttled endpoint.
 */
const ADMIN_ACCESS_KEY = "ekaton:admin-access";
const ADMIN_REFRESH_KEY = "ekaton:admin-refresh";

const client = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_ACCESS_KEY);
  } catch {
    return null;
  }
}

function setAdminTokens(tokens: { access: string; refresh: string }): void {
  try {
    localStorage.setItem(ADMIN_ACCESS_KEY, tokens.access);
    localStorage.setItem(ADMIN_REFRESH_KEY, tokens.refresh);
  } catch {
    /* moderation simply will not survive a reload */
  }
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(ADMIN_ACCESS_KEY);
    localStorage.removeItem(ADMIN_REFRESH_KEY);
  } catch {
    /* nothing to clear */
  }
}

client.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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

/**
 * The backend caps page_size at 100. Moderation wants the whole wall in one
 * view — a demo that fills more than 100 responses would need real pagination,
 * but asking for one page of 10 (the default) silently hides everything else.
 */
const PAGE_SIZE = 100;

export const adminApi = {
  async login(credentials: { email: string; password: string }): Promise<void> {
    const { data } = await client.post<ApiEnvelope<LoginResult>>(
      "/admin/login/",
      credentials,
    );
    setAdminTokens({ access: data.data.access, refresh: data.data.refresh });
  },

  async messages({
    search,
    sort = "newest",
  }: {
    search?: string;
    sort?: AdminSort;
  }): Promise<PageResult<AdminMessage>> {
    const { data } = await client.get<ApiEnvelope<PageResult<AdminMessage>>>(
      "/public-speaking/admin/messages/",
      {
        params: {
          // Omitted rather than sent blank, so an empty box and a cleared box
          // produce the same request.
          ...(search ? { search } : {}),
          sort,
          page_size: PAGE_SIZE,
        },
      },
    );
    return data.data;
  },

  /** Cascades the message's votes away server-side. */
  async deleteMessage(id: string): Promise<void> {
    await client.delete(`/public-speaking/admin/messages/${id}/`);
  },
};
