import userApi from "@/services/userApi";

export const verifyEmailApi = (payload) => userApi.post("accounts/check-email/", payload);

export const setPasswordApi = (payload) =>
  userApi.post("/accounts/set-password/", payload);