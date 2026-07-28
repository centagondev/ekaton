import { apiGet, apiPost, apiPostEnvelope } from "./client";
import type {
  ApiEnvelope,
  CheckEmailResult,
  LoginResult,
  TokenPair,
  User,
} from "@/types/api";

export const authApi = {
  /**
   * Envelope is returned whole: when the account is unverified the backend's
   * `message` must be shown to the user verbatim.
   */
  checkEmail: (email: string): Promise<ApiEnvelope<CheckEmailResult>> =>
    apiPostEnvelope<CheckEmailResult>("/accounts/check-email/", { email }),

  login: (email: string, password: string): Promise<LoginResult> =>
    apiPost<LoginResult>("/accounts/login/", { email, password }),

  logout: (refresh: string): Promise<null> =>
    apiPost<null>("/accounts/logout/", { refresh }),

  me: (): Promise<User> => apiGet<User>("/accounts/me/"),

  setPassword: (payload: {
    token: string;
    password: string;
    confirm_password: string;
  }): Promise<null> => apiPost<null>("/accounts/set-password/", payload),

  forgotPassword: (email: string): Promise<null> =>
    apiPost<null>("/accounts/forget-password/", { email }),

  resendPasswordReset: (email: string): Promise<null> =>
    apiPost<null>("/accounts/resend-password-reset/", { email }),

  resetPassword: (payload: {
    token: string;
    password: string;
    confirm_password: string;
  }): Promise<null> => apiPost<null>("/accounts/reset-password/", payload),

  /** Returns a fresh token pair so the session survives the change. */
  changePassword: (payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<TokenPair> => apiPost<TokenPair>("/accounts/change-password/", payload),
};
