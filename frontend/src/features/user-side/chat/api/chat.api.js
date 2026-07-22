import userApi from "@/services/userApi";

export const startChatApi = () => userApi.post("/chat/start/");