import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  Complaint,
  ComplaintCategory,
  ComplaintComment,
  ComplaintStatus,
  CursorResult,
  PageResult,
} from "@/types/api";

export const complaintsApi = {
  list: (page = 1, pageSize = 10): Promise<PageResult<Complaint>> =>
    apiGet<PageResult<Complaint>>("/complaints/", { page, page_size: pageSize }),

  detail: (id: string): Promise<Complaint> => apiGet<Complaint>(`/complaints/${id}/`),

  create: (payload: {
    title: string;
    description: string;
    category: ComplaintCategory;
    is_anonymous: boolean;
  }): Promise<{ id: string }> => apiPost<{ id: string }>("/complaints/", payload),

  /** Owner only, within 5 minutes of creation (enforced server-side). */
  update: (
    id: string,
    payload: Partial<Pick<Complaint, "title" | "description" | "category">>,
  ): Promise<Complaint> => apiPatch<Complaint>(`/complaints/${id}/`, payload),

  remove: (id: string): Promise<null> => apiDelete<null>(`/complaints/${id}/`),

  /** Toggle — response tells you the resulting state. */
  toggleUpvote: (id: string): Promise<{ upvote: boolean }> =>
    apiPost<{ upvote: boolean }>(`/complaints/${id}/upvote/`),

  comments: (
    id: string,
    cursor?: string | null,
  ): Promise<CursorResult<ComplaintComment>> =>
    apiGet<CursorResult<ComplaintComment>>(
      `/complaints/${id}/comments/`,
      cursor ? { cursor } : undefined,
    ),

  addComment: (
    id: string,
    payload: { comment: string; is_anonymous: boolean },
  ): Promise<{ comment_id: string }> =>
    apiPost<{ comment_id: string }>(`/complaints/${id}/comments/`, payload),
};

export const COMPLAINT_CATEGORIES: ReadonlyArray<{
  value: ComplaintCategory;
  label: string;
}> = [
  { value: "general", label: "General" },
  { value: "facilities", label: "Facilities" },
  { value: "events", label: "Events" },
  { value: "academic", label: "Academic" },
  { value: "other", label: "Other" },
];

export const COMPLAINT_STATUS_META: Record<
  ComplaintStatus,
  { label: string; tone: "yellow" | "lavender" | "lime" | "danger" }
> = {
  open: { label: "Open", tone: "yellow" },
  under_review: { label: "Under review", tone: "lavender" },
  resolved: { label: "Resolved", tone: "lime" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const COMPLAINT_MAX_TITLE = 150;
export const COMPLAINT_MAX_BODY = 2000;
