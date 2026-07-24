import userApi from "@/services/userApi";

/** GET /api/v1/accounts/me/ — Fetch current user's profile */
export const getMeApi = () => userApi.get("accounts/me/");

/**
 * PATCH /api/v1/users/me/ — Update name, batch, is_available
 * NOTE: This endpoint is planned but not yet implemented in the backend.
 * The UI shows the form; it will work once the backend is ready.
 */
export const updateMeApi = (payload) => userApi.patch("users/me/", payload);

/** POST /api/v1/accounts/change-password/ — Change authenticated user's password */
export const changePasswordApi = (payload) =>
  userApi.post("accounts/change-password/", payload);

