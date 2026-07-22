import { create } from "zustand";
import {
  forgetPasswordApi,
  loginApi,
  logoutApi,
  resendPasswordResetApi,
  setPasswordApi,
  verifyEmailApi,
} from "../api/auth.api";
import { storage } from "@/services/storage";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";

const storedUser = storage.get(STORAGE_KEYS.USER_PROFILE);
export const useAuthStore = create((set, get) => ({
  loading: false,
  error: null,
  user: storedUser || null,
  access: null,
  refresh: null,

  setAuth: ({ user, access, refresh }) => {
    storage.set(STORAGE_KEYS.USER_PROFILE, user);
    storage.set(STORAGE_KEYS.ACCESS_TOKEN, access);
    storage.set(STORAGE_KEYS.REFRESH_TOKEN, refresh);

    set({
      user,
      access,
      refresh,
      loading: false,
    });
  },

  clearAuth: () => {
    storage.remove(STORAGE_KEYS.USER_PROFILE);
    storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
    storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    set({
      user: null,
      access: null,
      refresh: null,
      error: null,
    });
  },

  verifyEmail: async (email) => {
    try {
      const result = await verifyEmailApi(email);

      return result;
    } catch (err) {
      console.log(err);
      throw err;
    }
  },

  setPassword: async (payload) => {
    try {
      const result = await setPasswordApi(payload);

      return result.data;
    } catch (err) {
      console.log(err);
      throw err;
    }
  },

  login: async (payload) => {
    try {
      set({ loading: true, error: null });
      const result = await loginApi(payload);
      const {
        data: { access, refresh, user },
      } = result;
      get().setAuth({
        user,
        access,
        refresh,
      });

      set({ loading: false, error: null });
      return result;
    } catch (err) {
      const message = err.response?.data?.message || "Login failed";
      console.log(message);
      set({ loading: false, error: message });

      throw err;
    }
  },

  logout: async () => {
    try {
      // const refresh = get().refresh;
      // const result = await logoutApi({refresh});
      // return result;
    } catch (err) {
      console.log(err);
    } finally {
      get().clearAuth();
    }
  },

  forgetPassword: async (payload) => {
    try {
      const result = await forgetPasswordApi(payload);
      return result;
    } catch (err) {
      console.log(err.response?.data?.message);
      throw err;
    }
  },

  resendPasswordReset: async (payload) => {
    try {
      const result = await resendPasswordResetApi(payload);

      return result;
    } catch (err) {
      console.log(err.response?.data?.message);
      throw err;
    }
  },
}));
