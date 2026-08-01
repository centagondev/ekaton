import { apiGet, apiPatchForm, apiPost, apiPostEnvelope } from "./client";
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

  /**
   * The one profile route that does not live under /accounts/: it moved to the
   * users app, so it is mounted at /api/v1/users/. Everything else here is
   * still an accounts route.
   */
  me: (): Promise<User> => apiGet<User>("/users/me/"),

  /**
   * Upload a new profile photo. Multipart only — the backend hands the file to
   * Cloudinary and returns the refreshed user carrying the hosted URL, so the
   * response alone is enough to update the session.
   */
  updateProfilePhoto: (file: File): Promise<User> => {
    const form = new FormData();
    form.append("profile_photo", file);
    return apiPatchForm<User>("/users/me/", form);
  },

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
