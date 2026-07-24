import { create } from "zustand";
import { startChatApi } from "../api/chat.api";

export const useChatStore = create((set, get) => ({
  // ── Matchmaking ───────────────────────────────────────────────────────
  loading: false,
  roomId: null,
  matchStatus: null, // "waiting" | "matched" | "active" | null

  // ── Live chat ─────────────────────────────────────────────────────────
  messages: [],          // [{ id, sender, text, time, isMine }]
  partnerTyping: false,
  partnerRevealed: null, // null | { id, full_name, email, batch, profile_photo }

  // ── Reveal flow ───────────────────────────────────────────────────────
  revealState: "idle",   // "idle" | "sent" | "received" | "accepted" | "rejected"

  // ── Setters ───────────────────────────────────────────────────────────
  setRoomId: (id) => set({ roomId: id }),
  setMatchStatus: (status) => set({ matchStatus: status }),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setPartnerTyping: (val) => set({ partnerTyping: val }),

  setRevealState: (val) => set({ revealState: val }),

  setPartnerRevealed: (user) => set({ partnerRevealed: user }),

  resetChat: () =>
    set({
      roomId: null,
      matchStatus: null,
      messages: [],
      partnerTyping: false,
      partnerRevealed: null,
      revealState: "idle",
    }),

  // ── REST actions ──────────────────────────────────────────────────────
  startChat: async () => {
    try {
      set({ loading: true });
      const result = await startChatApi();
      const data = result.data?.data ?? result.data;

      set({
        loading: false,
        matchStatus: data.status,
        roomId: data.room_id ?? null,
      });

      return data;
    } catch (err) {
      set({ loading: false });
      console.error("[ChatStore] startChat error:", err);
      throw err;
    }
  },
}));