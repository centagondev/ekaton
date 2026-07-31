import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { API_URL } from "../config";
import { getAccessToken, getRefreshToken, setTokens, clearSession } from "../storage";
import type { ApiEnvelope } from "@/types/api";

/** Fired when a refresh fails so the auth store can drop the session. */
export const SESSION_EXPIRED_EVENT = "ekaton:session-expired";

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

const instance: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

instance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * A 401 from these endpoints means bad credentials or a dead refresh token —
 * retrying with a new access token cannot help. Authenticated account routes
 * (me/, change-password/, logout/) must still go through the refresh path.
 */
const NO_REFRESH_PATHS = [
  "/accounts/login/",
  "/accounts/refresh/",
  "/accounts/check-email/",
  "/accounts/set-password/",
  "/accounts/reset-password/",
  "/accounts/forget-password/",
];

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("No refresh token");
  // Bare axios: the refresh endpoint returns raw tokens with no envelope,
  // and going through `instance` would recurse into this interceptor.
  const { data } = await axios.post<{ access: string; refresh?: string }>(
    `${API_URL}/accounts/refresh/`,
    { refresh },
  );
  // ROTATE_REFRESH_TOKENS: each refresh returns a new refresh token and
  // blacklists the one just used — losing the new one here would strand
  // the session at the next refresh.
  setTokens({ access: data.access, refresh: data.refresh });
  return data.access;
}

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const skipRefresh = NO_REFRESH_PATHS.some((path) => config?.url?.includes(path));

    if (status === 401 && config && !config._retried && !skipRefresh) {
      config._retried = true;
      try {
        refreshPromise ??= refreshAccessToken();
        const access = await refreshPromise;
        refreshPromise = null;
        config.headers.Authorization = `Bearer ${access}`;
        return instance(config);
      } catch {
        refreshPromise = null;
        clearSession();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

/** Unwrap the {success, message, data} envelope down to `data`. */
export async function apiGet<T>(url: string, params?: object): Promise<T> {
  const response = await instance.get<ApiEnvelope<T>>(url, { params });
  return response.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await instance.post<ApiEnvelope<T>>(url, body ?? {});
  return response.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const response = await instance.patch<ApiEnvelope<T>>(url, body);
  return response.data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await instance.delete<ApiEnvelope<T>>(url);
  return response.data.data;
}

/** Full envelope, for the few places the server `message` matters verbatim. */
export async function apiPostEnvelope<T>(
  url: string,
  body?: unknown,
): Promise<ApiEnvelope<T>> {
  const response = await instance.post<ApiEnvelope<T>>(url, body ?? {});
  return response.data;
}

export { instance as axiosInstance };
