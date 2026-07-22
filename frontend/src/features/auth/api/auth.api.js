import userApi from "@/services/userApi";

export const verifyEmailApi = (payload) =>
  userApi.post("accounts/check-email/", payload);

export const setPasswordApi = (payload) =>
  userApi.post("/accounts/set-password/", payload);

export const loginApi = (payload) => userApi.post("accounts/login/", payload);
export const logoutApi = (payload) => userApi.post("accounts/logout/", payload);

export const forgetPasswordApi = (payload) =>
  userApi.post("accounts/forget-password/", payload);

export const resendPasswordResetApi = (payload) =>
  userApi.post("accounts/resend-password-reset/", payload);
