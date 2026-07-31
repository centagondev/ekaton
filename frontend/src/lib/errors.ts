import { AxiosError } from "axios";

export interface ParsedApiError {
  status: number;
  message: string;
  /** Field-keyed validation messages, e.g. { email: "Enter a valid email." } */
  fields: Record<string, string>;
  isOffline: boolean;
}

/**
 * The backend mixes error shapes:
 *   - envelope:  { success: false, message, data: null }   (login 401, some chat 404s)
 *   - raw DRF:   { detail } | { field: [...] } | [ "..." ]
 * Everything is normalized here so components never branch on shape.
 */
export function parseApiError(error: unknown): ParsedApiError {
  const axiosError = error as AxiosError<unknown>;

  if (!axiosError?.response) {
    return {
      status: 0,
      message: navigator.onLine
        ? "Cannot reach the server. Please try again."
        : "You are offline. Check your connection.",
      fields: {},
      isOffline: !navigator.onLine,
    };
  }

  const status = axiosError.response.status;
  const data = axiosError.response.data;
  const fields: Record<string, string> = {};
  let message: string | null = null;

  if (Array.isArray(data)) {
    message = data.join(" ");
  } else if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    if (record.success === false && record.message && typeof record.message === "object") {
      // A few endpoints (e.g. reset-password) put field-keyed validation
      // errors INSIDE the envelope's `message`, e.g.
      // { success: false, message: { password: ["Too common."] }, data: null }.
      // Walking `record.message` itself — instead of falling through to the
      // generic branch below, which would walk the OUTER envelope — is what
      // matters here: the outer branch would hit `success: false` first and
      // display the literal string "false" as the error.
      for (const [key, value] of Object.entries(record.message as Record<string, unknown>)) {
        fields[key] = Array.isArray(value) ? value.join(" ") : String(value);
      }
      message = fields.password ?? Object.values(fields)[0] ?? null;
    } else if (record.success === false && typeof record.message === "string") {
      message = record.message;
    } else if (typeof record.detail === "string") {
      message = record.detail;
    } else {
      for (const [key, value] of Object.entries(record)) {
        const text = Array.isArray(value) ? value.join(" ") : String(value);
        if (key === "detail" || key === "non_field_errors") {
          message ??= text;
        } else {
          fields[key] = text;
        }
      }
      message ??= Object.values(fields)[0] ?? null;
    }
  }

  if (!message) {
    message =
      status === 429
        ? "You're doing that too fast. Please wait a moment."
        : status === 401
          ? "Your session has expired. Please log in again."
          : status === 403
            ? "You don't have permission to do that."
            : status === 404
              ? "Not found."
              : "Something went wrong. Please try again.";
  }

  return { status, message, fields, isOffline: false };
}

/** DRF throttle bodies carry the wait time: "…available in N seconds." */
export function retryAfterMs(message: string, fallback = 15_000): number {
  const match = /available in (\d+) second/.exec(message);
  return match ? Number(match[1]) * 1000 + 750 : fallback;
}
