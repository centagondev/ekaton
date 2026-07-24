import { create } from "zustand";
import {
  getEventsApi,
  getEventByIdApi,
  createEventApi,
  updateEventApi,
  cancelEventApi,
  joinEventApi,
  leaveEventApi,
} from "../api/events.api";

export const useEventsStore = create((set, get) => ({
  // ── State ─────────────────────────────────────────────────────────────
  events: [],
  currentEvent: null,
  loading: false,
  submitting: false,
  error: null,

  // ── Actions ───────────────────────────────────────────────────────────

  /** Fetch all active events */
  fetchEvents: async () => {
    try {
      set({ loading: true, error: null });
      const result = await getEventsApi();
      const events = result.data?.data ?? result.data;
      set({ events: Array.isArray(events) ? events : [], loading: false });
      return events;
    } catch (err) {
      set({ loading: false, error: err.response?.data?.message || "Failed to load events" });
      throw err;
    }
  },

  /** Fetch a single event by id */
  fetchEventById: async (id) => {
    try {
      set({ loading: true, error: null });
      const result = await getEventByIdApi(id);
      const event = result.data?.data ?? result.data;
      set({ currentEvent: event, loading: false });
      return event;
    } catch (err) {
      set({ loading: false, error: err.response?.data?.message || "Failed to load event" });
      throw err;
    }
  },

  /** Create a new event */
  createEvent: async (payload) => {
    try {
      set({ submitting: true, error: null });
      const result = await createEventApi(payload);
      const event = result.data?.data ?? result.data;
      // Prepend to list
      set((state) => ({
        events: [event, ...state.events],
        submitting: false,
      }));
      return event;
    } catch (err) {
      set({ submitting: false, error: err.response?.data?.message || "Failed to create event" });
      throw err;
    }
  },

  /** Update an event (owner only) */
  updateEvent: async (id, payload) => {
    try {
      set({ submitting: true, error: null });
      const result = await updateEventApi(id, payload);
      const updated = result.data?.data ?? result.data;
      set((state) => ({
        events: state.events.map((e) => (e.id === id ? updated : e)),
        currentEvent: state.currentEvent?.id === id ? updated : state.currentEvent,
        submitting: false,
      }));
      return updated;
    } catch (err) {
      set({ submitting: false, error: err.response?.data?.message || "Failed to update event" });
      throw err;
    }
  },

  /** Cancel an event (owner only) */
  cancelEvent: async (id) => {
    try {
      set({ submitting: true, error: null });
      await cancelEventApi(id);
      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        currentEvent: null,
        submitting: false,
      }));
    } catch (err) {
      set({ submitting: false, error: err.response?.data?.message || "Failed to cancel event" });
      throw err;
    }
  },

  /** Join an event */
  joinEvent: async (id) => {
    try {
      set({ submitting: true });
      await joinEventApi(id);
      // Refresh the current event to get updated participant_count
      await get().fetchEventById(id);
      set({ submitting: false });
    } catch (err) {
      set({ submitting: false });
      throw err;
    }
  },

  /** Leave an event */
  leaveEvent: async (id) => {
    try {
      set({ submitting: true });
      await leaveEventApi(id);
      set({ submitting: false });
    } catch (err) {
      set({ submitting: false });
      throw err;
    }
  },

  clearCurrentEvent: () => set({ currentEvent: null }),
}));
