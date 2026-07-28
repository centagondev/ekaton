import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  CampusEvent,
  CampusEventDetail,
  CursorResult,
  EventBanner,
  EventCreatePayload,
  EventMessage,
  EventParticipant,
} from "@/types/api";

export const eventsApi = {
  /** Plain array — only active events whose end_time is in the future. */
  list: (): Promise<CampusEvent[]> => apiGet<CampusEvent[]>("/events/"),

  detail: (id: string): Promise<CampusEventDetail> =>
    apiGet<CampusEventDetail>(`/events/${id}/`),

  create: (payload: EventCreatePayload): Promise<CampusEvent> =>
    apiPost<CampusEvent>("/events/create/", payload),

  update: (id: string, payload: Partial<EventCreatePayload>): Promise<CampusEvent> =>
    apiPatch<CampusEvent>(`/events/${id}/update/`, payload),

  cancel: (id: string): Promise<null> => apiDelete<null>(`/events/${id}/cancel/`),

  /** Assigns the anonymous display name on first join. */
  join: (id: string): Promise<EventParticipant> =>
    apiPost<EventParticipant>(`/events/${id}/join/`),

  leave: (id: string): Promise<EventParticipant> =>
    apiPost<EventParticipant>(`/events/${id}/leave/`),

  /** Cursor paginated, newest first. 404s unless you are an active participant. */
  messages: (id: string, cursor?: string | null): Promise<CursorResult<EventMessage>> =>
    apiGet<CursorResult<EventMessage>>(
      `/events/${id}/messages/`,
      cursor ? { cursor, page_size: 30 } : { page_size: 30 },
    ),

  sendMessage: (id: string, content: string): Promise<EventMessage> =>
    apiPost<EventMessage>(`/events/${id}/messages/`, { content }),
};

export const EVENT_BANNERS: readonly EventBanner[] = [
  "banner_1",
  "banner_2",
  "banner_3",
  "banner_4",
  "banner_5",
  "banner_6",
];

export const EVENT_MESSAGE_MAX = 1000;
