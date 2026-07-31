/**
 * Types mirror the Django backend exactly (see docs/BACKEND-CONTRACT.md).
 * Nothing here is speculative — every field was read from a serializer,
 * consumer or view.
 */

/** Standard success envelope from core/responses.py. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Page-number pagination (core/pagination.py). */
export interface PageResult<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Cursor pagination (comments, event messages) — no `count`. */
export interface CursorResult<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

/* ------------------------------- accounts ------------------------------- */

export type Gender = "male" | "female";

export interface User {
  id: string;
  full_name: string;
  email: string;
  batch: string;
  gender: Gender;
  /** URLField on the model — a URL string or null. No upload endpoint exists. */
  profile_photo: string | null;
  is_available: boolean;
  is_verified: boolean;
  is_active: boolean;
}

export interface CheckEmailResult {
  is_verified: boolean;
}

export interface LoginResult {
  access: string;
  refresh: string;
  user: User;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

/* --------------------------------- chat --------------------------------- */

/** Runtime values from matchmaking.start_chat(). */
export type MatchStatus = "waiting" | "matched" | "active";

export interface StartChatResult {
  status: MatchStatus;
  message: string;
  /** Present only for "matched" and "active". */
  room_id?: string;
}

export type ReportReason =
  | "spam"
  | "harassment"
  | "abusive_language"
  | "inappropriate_content"
  | "fake_identity"
  | "other";

export interface ReportPayload {
  room_id: string;
  reason: ReportReason;
  description?: string;
  evidence_url?: string;
}

/* -------------------------- chat websocket wire -------------------------- */

/** Profile broadcast on a successful reveal. Email is sent but NOT displayed. */
export interface RevealedUser {
  id: string;
  full_name: string;
  email: string;
  batch: string;
  profile_photo: string | null;
}

export type ChatServerEvent =
  | { type: "chat_message"; id: string; sender: string; message: string; created_at: string }
  | { type: "typing"; sender: string; is_typing: boolean }
  | { type: "reveal_request_sent"; message: string }
  | { type: "reveal_request_received"; message: string }
  | { type: "reveal_success"; message: string; user: RevealedUser }
  | { type: "reveal_rejected"; message: string }
  | { type: "chat_skipped"; message: string }
  | { type: "chat_ended"; message: string }
  | { type: "chat_timeout"; message: string }
  | { type: "error"; message: string };

export type ChatClientEvent =
  | { type: "chat_message"; message: string }
  | { type: "typing"; is_typing: boolean }
  | { type: "reveal_request" }
  | { type: "reveal_response"; status: "accepted" | "rejected" }
  | { type: "skip_chat" };

/* -------------------------------- events -------------------------------- */

export type EventBanner =
  | "banner_1"
  | "banner_2"
  | "banner_3"
  | "banner_4"
  | "banner_5"
  | "banner_6";

export type EventStatus = "active" | "ended" | "cancelled";

export interface CampusEvent {
  id: string;
  /**
   * Owner's full_name, or null for anonymous events — the backend never
   * sends the host's real name when the event is anonymous.
   */
  owner: string | null;
  /** Authoritative ownership flag; never infer this from `owner`. */
  is_owner: boolean;
  banner: EventBanner;
  name: string;
  description: string;
  venue: string;
  end_time: string;
  is_anonymous_chat: boolean;
  status: EventStatus;
  created_at: string;
}

export interface CampusEventDetail extends CampusEvent {
  participant_count: number;
  /**
   * The caller's own active participation, or null when they have not joined.
   *
   * Authoritative: this is how the chat tells its own messages apart from
   * everyone else's. Never rely on the browser's memory of a past join for
   * that — it is empty on a second device or after site data is cleared.
   */
  my_participant: { id: string; display_name: string } | null;
}

export interface EventParticipant {
  /** EventParticipant id — matches participant.id in WS presence payloads. */
  id: string;
  /** Anonymous alias for anonymous events, otherwise the user's full name. */
  display_name: string;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
}

/** The short quote carried by a reply. Truncated server-side. */
export interface EventMessageQuote {
  id: string;
  sender_name: string;
  content: string;
}

export interface EventMessage {
  id: string;
  sender_name: string;
  content: string;
  created_at: string;
  /** Null when the message is not a reply, or the original is gone. */
  reply_to: EventMessageQuote | null;
}

export interface EventCreatePayload {
  banner: EventBanner;
  name: string;
  description: string;
  venue: string;
  end_time: string;
  is_anonymous_chat: boolean;
}

/* ------------------------- events websocket wire ------------------------- */

export interface PresenceParticipant {
  id: string;
  /** Alias for anonymous events; null for public ones. */
  anonymous_name: string | null;
  /**
   * Resolved name (alias for anonymous events, real name for public ones).
   * Optional: presence payloads do not currently carry it, so the UI reads it
   * when present and falls back to `anonymous_name`.
   */
  display_name?: string | null;
}

/**
 * Live event messages arrive as {type:"message", message:{...}}.
 * Errors arrive as `{ error }` with no `type` key.
 */
export type EventServerEvent =
  | { type: "message"; message: EventMessage }
  | { type: "history"; messages: EventMessage[] }
  | { type: "presence.online_users"; count: number; participants: PresenceParticipant[] }
  | { type: "presence.joined"; participant: PresenceParticipant }
  | { type: "presence.left"; participant: PresenceParticipant }
  | { type: "typing.started"; participant: PresenceParticipant }
  | { type: "typing.stopped"; participant: PresenceParticipant }
  | { type: "event.closed"; reason: string }
  | { type: "pong" }
  | { type?: undefined; error: string };

/* ------------------------------- complaints ------------------------------ */

export type ComplaintCategory =
  | "general"
  | "facilities"
  | "events"
  | "academic"
  | "other";

export type ComplaintStatus = "open" | "under_review" | "resolved" | "rejected";

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  is_anonymous: boolean;
  /** "Anonymous" when is_anonymous, else the author's full name. */
  author_name: string;
  author_batch: string | null;
  created_at: string;
  comment_count: number;
  upvote_count: number;
}

export interface ComplaintComment {
  id: string;
  comment: string;
  is_anonymous: boolean;
  author_name: string;
  author_batch: string | null;
  created_at: string;
}
