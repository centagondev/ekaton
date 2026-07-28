import { create } from "zustand";

interface UiState {
  authModalOpen: boolean;
  /** Where to send the user after a successful login. */
  redirectAfterAuth: string | null;
  openAuthModal: (redirectTo?: string | null) => void;
  closeAuthModal: () => void;
}

/**
 * Auth is a modal, never a page — so any surface (nav button, route guard,
 * "Start chat") can raise it without navigating away from the user's context.
 */
export const useUiStore = create<UiState>((set) => ({
  authModalOpen: false,
  redirectAfterAuth: null,
  openAuthModal: (redirectTo = null) =>
    set({ authModalOpen: true, redirectAfterAuth: redirectTo }),
  closeAuthModal: () => set({ authModalOpen: false }),
}));
