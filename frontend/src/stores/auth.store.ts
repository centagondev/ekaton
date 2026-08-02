import { create } from "zustand";
import { authApi } from "@/lib/api/auth";
import { SESSION_EXPIRED_EVENT } from "@/lib/api/client";
import { queryClient } from "@/lib/queryClient";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setStoredUser,
  setTokens,
} from "@/lib/storage";
import type { User } from "@/types/api";

interface AuthState {
  user: User | null;
  /** False until the stored session has been validated against /me/. */
  ready: boolean;
  isAuthenticated: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User>;
  /** Adopt a user the server just returned, without re-fetching /me/. */
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  ready: false,
  isAuthenticated: Boolean(getStoredUser() && getAccessToken()),

  /** Validate the persisted session once on app start. */
  bootstrap: async () => {
    if (!getAccessToken()) {
      set({ user: null, isAuthenticated: false, ready: true });
      return;
    }
    try {
      const user = await authApi.me();
      setStoredUser(user);
      set({ user, isAuthenticated: true, ready: true });
    } catch {
      // 401s already cleared storage via the interceptor.
      set({ ready: true });
    }
  },

  login: async (email, password) => {
    const result = await authApi.login(email, password);
    setTokens({ access: result.access, refresh: result.refresh });
    setStoredUser(result.user);
    set({ user: result.user, isAuthenticated: true, ready: true });
    return result.user;
  },

  logout: async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // An already-expired refresh token can't be blacklisted — sign out anyway.
    }
    clearSession();
    // Signing out is an SPA navigation, so nothing else empties the React
    // Query cache. Left behind, it answers the next sign-in from the previous
    // user's session: `is_owner` on an event is the sharpest example — cached
    // as false for whoever browsed last, and served for a further 30s of
    // staleTime without a request, it hides the host's own Edit and Cancel
    // controls from them right after they log back in.
    queryClient.clear();
    set({ user: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    const user = await authApi.me();
    setStoredUser(user);
    set({ user, isAuthenticated: true });
    return user;
  },

  /**
   * For endpoints that already answer with the full, updated user — the
   * profile photo PATCH being the one today. Re-fetching /me/ after those
   * would only add a round trip and a second chance to fail.
   */
  setUser: (user) => {
    setStoredUser(user);
    set({ user, isAuthenticated: true });
  },

  clear: () => {
    clearSession();
    queryClient.clear();
    set({ user: null, isAuthenticated: false });
  },
}));

// A failed token refresh must drop the in-memory session too.
window.addEventListener(SESSION_EXPIRED_EVENT, () => {
  useAuthStore.getState().clear();
});
