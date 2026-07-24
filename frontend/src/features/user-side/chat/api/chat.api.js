import userApi from "@/services/userApi";

export const startChatApi = () => userApi.post("/chat/start/");

export const endChatApi = (roomId) =>
  userApi.post("/chat/end/", { room_id: roomId });

export const reportUserApi = (payload) =>
  userApi.post("/chat/report/", payload);
// payload: { room_id, reason, description?, evidence_url? }
