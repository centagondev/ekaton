import userApi from "@/services/userApi";

/** GET /api/v1/events/ — List all active events */
export const getEventsApi = () => userApi.get("events/");

/** GET /api/v1/events/<id>/ — Get a single event with participant_count */
export const getEventByIdApi = (id) => userApi.get(`events/${id}/`);

/** POST /api/v1/events/create/ — Create a new event */
export const createEventApi = (payload) => userApi.post("events/create/", payload);

/** PATCH /api/v1/events/<id>/update/ — Update an event (owner only) */
export const updateEventApi = (id, payload) =>
  userApi.patch(`events/${id}/update/`, payload);

/** DELETE /api/v1/events/<id>/cancel/ — Cancel an event (owner only) */
export const cancelEventApi = (id) => userApi.delete(`events/${id}/cancel/`);

/** POST /api/v1/events/<id>/join/ — Join an event */
export const joinEventApi = (id) => userApi.post(`events/${id}/join/`);

/** POST /api/v1/events/<id>/leave/ — Leave an event */
export const leaveEventApi = (id) => userApi.post(`events/${id}/leave/`);
