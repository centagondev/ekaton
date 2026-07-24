import { create } from "zustand";
import { getMeApi, updateMeApi, changePasswordApi } from "../api/profile.api";
import { useAuthStore } from "@/features/auth/store/auth.store";

export const useProfileStore = create((set) => ({
  loading: false,
  updating: false,
  changingPassword: false,
  error: null,

  // ── Actions ───────────────────────────────────────────────────────────

  /** Fetch the current user from the API and sync into the auth store */
  fetchMe: async () => {
    try {
      set({ loading: true, error: null });
      const result = await getMeApi();
      const user = result.data?.data ?? result.data;

      // Keep the auth store's user in sync so Navbar etc. stay current
      useAuthStore.getState().setAuth({
        user,
        access: useAuthStore.getState().access,
        refresh: useAuthStore.getState().refresh,
      });

      set({ loading: false });
      return user;
    } catch (err) {
      set({ loading: false, error: err.response?.data?.message || "Failed to load profile" });
      throw err;
    }
  },

  /** PATCH /accounts/me/ — update full_name, batch, is_available */
  updateMe: async (payload) => {
    try {
      set({ updating: true, error: null });
      const result = await updateMeApi(payload);
      const user = result.data?.data ?? result.data;

      // Sync updated user back into auth store
      useAuthStore.getState().setAuth({
        user,
        access: useAuthStore.getState().access,
        refresh: useAuthStore.getState().refresh,
      });

      set({ updating: false });
      return user;
    } catch (err) {
      set({ updating: false, error: err.response?.data?.message || "Update failed" });
      throw err;
    }
  },

  /** POST /accounts/change-password/ */
  changePassword: async (payload) => {
    try {
      set({ changingPassword: true, error: null });
      const result = await changePasswordApi(payload);
      const data = result.data?.data ?? result.data;

      // Server issues new tokens on password change — keep them
      if (data?.access && data?.refresh) {
        useAuthStore.getState().setAuth({
          user: useAuthStore.getState().user,
          access: data.access,
          refresh: data.refresh,
        });
      }

      set({ changingPassword: false });
      return data;
    } catch (err) {
      set({ changingPassword: false, error: err.response?.data?.message || "Password change failed" });
      throw err;
    }
  },
}));
