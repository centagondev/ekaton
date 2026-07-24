import userApi from "@/services/userApi";

/**
 * Fetch the current number of online students.
 * Backend endpoint: GET /api/v1/users/online-count/
 * Expected response shape: { data: { online_count: number } }
 *
 * NOTE: This endpoint may not exist yet on the backend.
 * The hook that calls this function handles 404 gracefully.
 */
export const getOnlineCountApi = () => userApi.get("/users/online-count/");
