import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "@/lib/config";
import type {
  ApiEnvelope,
  EventBanner,
  EventStatus,
  Gender,
  PageResult,
  ReportReason,
  User,
} from "@/types/api";

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
 * The client silently refreshes expired access tokens exactly like the product
 * client does (same 30-minute access lifetime, same /accounts/refresh/
 * endpoint, admin's own refresh token), so an admin session lasts up to the
 * 7-day refresh lifetime instead of dying at minute 30. `/admin/login/` is
 * excluded from that path, so a wrong password still surfaces its 401 in the
 * form instead of triggering a refresh attempt.
 */
const ADMIN_ACCESS_KEY = "ekaton:admin-access";
const ADMIN_REFRESH_KEY = "ekaton:admin-refresh";
const ADMIN_USER_KEY = "ekaton:admin-user";

/**
 * Fired when any portal request answers 401/403. There is no refresh flow for
 * admin sessions, so an expired token has exactly one outcome: back to the
 * login screen. AdminLayout listens and performs the SPA navigation.
 */
export const ADMIN_SESSION_EXPIRED_EVENT = "ekaton:admin-session-expired";

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

function getAdminRefreshToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_REFRESH_KEY);
  } catch {
    return null;
  }
}

/** Token-only update used by the silent refresh; the stored user is kept. */
function setAdminTokens(access: string, refresh?: string): void {
  try {
    localStorage.setItem(ADMIN_ACCESS_KEY, access);
    // ROTATE_REFRESH_TOKENS: each refresh returns a new refresh token and
    // blacklists the one just used — losing the new one here would strand
    // the session at the next refresh.
    if (refresh) localStorage.setItem(ADMIN_REFRESH_KEY, refresh);
  } catch {
    /* the session simply will not survive a reload */
  }
}

/** The admin profile captured at login, for the user menu. */
export function getAdminUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

function setAdminSession(result: AdminLoginResult): void {
  try {
    localStorage.setItem(ADMIN_ACCESS_KEY, result.access);
    localStorage.setItem(ADMIN_REFRESH_KEY, result.refresh);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(result.user));
  } catch {
    /* moderation simply will not survive a reload */
  }
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(ADMIN_ACCESS_KEY);
    localStorage.removeItem(ADMIN_REFRESH_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  } catch {
    /* nothing to clear */
  }
}

client.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

let refreshPromise: Promise<string> | null = null;

/**
 * Trade the admin refresh token for a fresh access token. Mirrors the product
 * client: bare axios, because the refresh endpoint returns raw tokens with no
 * envelope and going through `client` would recurse into the interceptor.
 * SimpleJWT's refresh view is user-agnostic — it accepts the admin's token the
 * same as any student's; IsAdminUser keeps enforcing staffness per request.
 */
async function refreshAdminAccess(): Promise<string> {
  const refresh = getAdminRefreshToken();
  if (!refresh) throw new Error("No admin refresh token");
  const { data } = await axios.post<{ access: string; refresh?: string }>(
    `${API_URL}/accounts/refresh/`,
    { refresh },
  );
  setAdminTokens(data.access, data.refresh);
  return data.access;
}

function expireAdminSession(): void {
  clearAdminSession();
  window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
}

/**
 * The only authorization check that means anything happens server-side.
 *
 * 401 (access token expired) → silently refresh once and replay the request,
 * exactly like the product client, so the session survives the 30-minute
 * access lifetime. `/admin/login/` is exempt — its 401 is "wrong password"
 * and must surface in the form, not trigger a refresh or bounce the page.
 *
 * 403 (authenticated but not staff, or staffness revoked) → no refresh can
 * fix that; the session is useless for the portal and is dropped.
 */
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as RetriableConfig | undefined;
    const status: number | undefined = error?.response?.status;
    const url: string = config?.url ?? "";
    const isLogin = url.includes("/admin/login/");

    if (status === 401 && config && !config._retried && !isLogin) {
      config._retried = true;
      try {
        refreshPromise ??= refreshAdminAccess();
        const access = await refreshPromise;
        refreshPromise = null;
        config.headers.Authorization = `Bearer ${access}`;
        return client(config);
      } catch {
        refreshPromise = null;
        expireAdminSession();
        return Promise.reject(error);
      }
    }

    // A 401 that survived a refreshed token, or a 403: the session is dead
    // for portal purposes either way.
    if ((status === 401 || status === 403) && !isLogin) {
      expireAdminSession();
    }
    return Promise.reject(error);
  },
);

/* --------------------------------- types ---------------------------------- */
/* Every shape below was read from apps/administration (serializers, services,
   views) and apps/public_speaking/admin_views.py — nothing is speculative.  */

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  is_superuser: boolean;
  is_staff: boolean;
}

interface AdminLoginResult {
  access: string;
  refresh: string;
  user: AdminUser;
}

/** GET /admin/dashboard/ → data.statistics (cached 60s server-side). */
export interface DashboardStatistics {
  users_count: number;
  online_users_count: number;
  active_events_count: number;
  pending_reports_count: number;
  total_chats_count: number;
  total_messages_count: number;
  pending_reveal_request_count: number;
  blocked_users_count: number;
}

/** GET /admin/users/ → data.stats (always global, never filtered). */
export interface UserStats {
  users_count: number;
  active_users: number;
  blocked_users: number;
  online_users: number;
  verified_users: number;
}

export interface UserListParams {
  page?: number;
  search?: string;
  is_active?: "true" | "false";
  is_verified?: "true" | "false";
  gender?: Gender;
  batch?: string;
}

export interface CreateUserPayload {
  full_name: string;
  email: string;
  batch: string;
  gender: Gender;
}

export interface UpdateUserPayload {
  full_name?: string;
  batch?: string;
  gender?: Gender;
  profile_photo?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
}

export type ReportStatus = "pending" | "reviewed" | "resolved";

export interface ReportParty {
  id: string;
  full_name: string;
  email: string;
}

/**
 * One row from GET /admin/reports/.
 *
 * KNOWN BACKEND GAP — `id` is typed optional because AdminReportSerializer
 * does not include it, yet PATCH /admin/reports/<report_id>/ requires it. The
 * status-change action therefore has nothing to call and stays hidden. Typed
 * this way so the portal lights up the moment the backend adds "id" to the
 * serializer's fields, with zero frontend changes.
 */
export interface AdminReport {
  id?: string;
  room: string;
  reporter: ReportParty;
  reported_user: ReportParty;
  reason: ReportReason;
  description: string | null;
  evidence_url: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export interface ReportStats {
  reports_count: number;
  reports_resolved_count: number;
  reports_pending_count: number;
}

export interface ReportListParams {
  page?: number;
  search?: string;
  status?: ReportStatus;
  reason?: ReportReason;
  start_date?: string;
  end_date?: string;
}

/** One row from GET /admin/events/ (AdminEventSerializer). */
export interface AdminEvent {
  id: string;
  owner: string;
  banner: EventBanner;
  name: string;
  venue: string;
  status: EventStatus;
  is_anonymous_chat: boolean;
  end_time: string;
  participant_count: number;
  created_at: string;
}

/** GET /admin/events/<id>/ (AdminEventDetailSerializer). */
export interface AdminEventDetail extends Omit<AdminEvent, "owner"> {
  owner: { id: string; full_name: string; email: string };
  description: string;
  updated_at: string;
}

export interface EventStats {
  total_events: number;
  active_events: number;
  ended_events: number;
  cancelled_events: number;
  anonymous_events: number;
}

/** ordering must be one of the backend's ordering_fields, optionally "-". */
export interface EventListParams {
  page?: number;
  search?: string;
  status?: EventStatus;
  is_anonymous_chat?: "true" | "false";
  ordering?: string;
}

export interface CreateEventPayload {
  owner: string;
  banner: EventBanner;
  name: string;
  description: string;
  venue: string;
  end_time: string;
  is_anonymous_chat: boolean;
}

export type UpdateEventPayload = Partial<Omit<CreateEventPayload, "owner">>;

/**
 * A public-speaking response as moderation sees it. Identical to the
 * participant-facing shape — the backend reuses one serializer. has_upvoted /
 * is_own are always false for a staff caller, who never joined the discussion.
 */
export interface AdminMessage {
  id: string;
  content: string;
  display_name: string;
  /** The account behind the pseudonym — admin endpoint only; null for
      legacy participants created before login was mandatory. */
  real_name: string | null;
  upvote_count: number;
  has_upvoted: boolean;
  is_own: boolean;
  created_at: string;
}

export type AdminSort = "newest" | "votes";

/**
 * The backend caps page_size at 100. Moderation wants the whole wall in one
 * view — a discussion that fills more than 100 responses would need real
 * pagination, but asking for one page of 10 (the default) hides everything.
 */
const SPEAKING_PAGE_SIZE = 100;

/** Strip empty/undefined params so a cleared filter and no filter match. */
function compact(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== "",
    ),
  );
}

/* ----------------------------------- api ----------------------------------- */

export const adminApi = {
  async login(credentials: { email: string; password: string }): Promise<void> {
    const { data } = await client.post<ApiEnvelope<AdminLoginResult>>(
      "/admin/login/",
      credentials,
    );
    setAdminSession(data.data);
  },

  async dashboard(): Promise<DashboardStatistics> {
    const { data } = await client.get<
      ApiEnvelope<{ statistics: DashboardStatistics }>
    >("/admin/dashboard/");
    return data.data.statistics;
  },

  users: {
    async list(
      params: UserListParams,
    ): Promise<{ stats: UserStats; users: PageResult<User> }> {
      const { data } = await client.get<
        ApiEnvelope<{ stats: UserStats; users: PageResult<User> }>
      >("/admin/users/", { params: compact({ ...params }) });
      return data.data;
    },

    async create(payload: CreateUserPayload): Promise<User> {
      const { data } = await client.post<ApiEnvelope<User>>(
        "/admin/users/",
        payload,
      );
      return data.data;
    },

    async update(userId: string, payload: UpdateUserPayload): Promise<User> {
      const { data } = await client.patch<ApiEnvelope<User>>(
        `/admin/users/${userId}/`,
        payload,
      );
      return data.data;
    },

    /**
     * Hard delete. The backend cascades: the user's chats, messages, reports
     * and owned events all go with the account.
     */
    async delete(userId: string): Promise<void> {
      await client.delete(`/admin/users/${userId}/`);
    },
  },

  reports: {
    async list(
      params: ReportListParams,
    ): Promise<{ stats: ReportStats; reports: PageResult<AdminReport> }> {
      const { data } = await client.get<
        ApiEnvelope<{ stats: ReportStats; reports: PageResult<AdminReport> }>
      >("/admin/reports/", { params: compact({ ...params }) });
      return data.data;
    },

    /** Unreachable until the list serializer exposes `id` — see AdminReport. */
    async updateStatus(
      reportId: string,
      status: ReportStatus,
    ): Promise<AdminReport> {
      const { data } = await client.patch<ApiEnvelope<AdminReport>>(
        `/admin/reports/${reportId}/`,
        { status },
      );
      return data.data;
    },
  },

  events: {
    async list(
      params: EventListParams,
    ): Promise<{ stats: EventStats; events: PageResult<AdminEvent> }> {
      const { data } = await client.get<
        ApiEnvelope<{ stats: EventStats; events: PageResult<AdminEvent> }>
      >("/admin/events/", { params: compact({ ...params }) });
      return data.data;
    },

    async detail(eventId: string): Promise<AdminEventDetail> {
      const { data } = await client.get<ApiEnvelope<AdminEventDetail>>(
        `/admin/events/${eventId}/`,
      );
      return data.data;
    },

    async create(payload: CreateEventPayload): Promise<AdminEventDetail> {
      const { data } = await client.post<ApiEnvelope<AdminEventDetail>>(
        "/admin/events/create/",
        payload,
      );
      return data.data;
    },

    async update(
      eventId: string,
      payload: UpdateEventPayload,
    ): Promise<AdminEventDetail> {
      const { data } = await client.patch<ApiEnvelope<AdminEventDetail>>(
        `/admin/events/${eventId}/update/`,
        payload,
      );
      return data.data;
    },

    /** Backend rejects anything that is not currently active. */
    async cancel(eventId: string): Promise<void> {
      await client.delete(`/admin/events/${eventId}/cancel/`);
    },
  },

  speaking: {
    /** 404 here means "no discussion is running right now" — not an error. */
    async messages({
      search,
      sort = "newest",
    }: {
      search?: string;
      sort?: AdminSort;
    }): Promise<PageResult<AdminMessage>> {
      const { data } = await client.get<ApiEnvelope<PageResult<AdminMessage>>>(
        "/public-speaking/admin/messages/",
        { params: compact({ search, sort, page_size: SPEAKING_PAGE_SIZE }) },
      );
      return data.data;
    },

    /** Cascades the message's votes away server-side. */
    async deleteMessage(id: string): Promise<void> {
      await client.delete(`/public-speaking/admin/messages/${id}/`);
    },
  },
};
