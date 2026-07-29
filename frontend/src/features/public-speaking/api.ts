import axios from "axios";
import { API_URL } from "@/lib/config";
import type { ApiEnvelope } from "@/types/api";

/**
 * A separate axios instance, on purpose.
 *
 * The shared client in lib/api/client.ts attaches a JWT and runs a refresh /
 * session-expiry interceptor. Demo visitors have no account, so borrowing it
 * would fire spurious "session expired" events and log nobody out of nothing.
 * This one carries only the anonymous session header.
 */
const client = axios.create({
  baseURL: `${API_URL}/public-speaking`,
  headers: { "Content-Type": "application/json" },
  // Lets the backend's HttpOnly participant cookie ride along, so even a tab
  // with cleared storage resolves to the same participant.
  withCredentials: true,
});

/**
 * The participant identity, in localStorage.
 *
 * This was sessionStorage once, and that was the root of the "new tab = new
 * participant" hole: sessionStorage is per-tab and dies with it, so every new
 * tab, window or restart minted a fresh identity with a fresh one-message
 * allowance. localStorage is per-origin and persistent — one browser, one
 * participant, across refreshes, tabs and restarts. The backend's HttpOnly
 * cookie backs this up for the storage-cleared case; incognito gets separate
 * storage AND cookies, which is the accepted "new participant" boundary.
 */
const SESSION_KEY = "ekaton:speaking-session";

/** Pre-fix key — promote any identity minted under the old scheme. */
const LEGACY_SESSION_KEY = SESSION_KEY;

export function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    // A tab that joined before this fix holds its token in sessionStorage;
    // promoting it keeps that identity instead of minting a second one.
    const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (legacy) {
      localStorage.setItem(SESSION_KEY, legacy);
      return legacy;
    }
    return null;
  } catch {
    // Storage can throw (some private modes); the cookie still identifies us.
    return null;
  }
}

function rememberSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {
    /* the HttpOnly cookie is the fallback identity */
  }
}

client.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) config.headers["X-Speaking-Session"] = token;
  return config;
});

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
  async discussion(): Promise<Discussion> {
    const { data } = await client.get<ApiEnvelope<Discussion>>("/");
    return data.data;
  },

  /**
   * This browser's participation state, straight from the database.
   *
   * Resolved from the stored token or the HttpOnly cookie, so the composer is
   * rendered correctly on first paint — a participant who already posted never
   * sees an input they cannot use. Creates nothing.
   */
  async state(): Promise<ParticipantState> {
    const { data } = await client.get<ApiEnvelope<ParticipantState>>("/state/");
    return data.data;
  },

  /**
   * Joining twice with a stored token returns the same anonymous name AND the
   * server's view of whether this participant has already posted. That flag is
   * why a refresh cannot re-open a composer the server would reject.
   */
  async join(): Promise<{ display_name: string; has_posted: boolean }> {
    const { data } = await client.post<
      ApiEnvelope<{ session_token: string; display_name: string; has_posted: boolean }>
    >("/join/", { session_token: getSessionToken() ?? "" });
    rememberSessionToken(data.data.session_token);
    return {
      display_name: data.data.display_name,
      has_posted: data.data.has_posted,
    };
  },

  async messages(): Promise<SpeakingMessage[]> {
    const { data } = await client.get<ApiEnvelope<Page<SpeakingMessage>>>("/messages/");
    return data.data.results;
  },
};
