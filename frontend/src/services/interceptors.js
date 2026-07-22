import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { storage } from "./storage";

export const setupInterceptors = (axiosInstance) => {
  axiosInstance.interceptors.request.use((config) => {
    const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);

    console.log("Interceptor token:", token);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(config.headers);

    return config;
  });
  axiosInstance.interceptors.response.use(
    (response) => response.data,
    (error) => {
      if (error.response?.status === 401) {
        storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
        storage.remove(STORAGE_KEYS.REFRESH_TOKEN);

        window.location.href = "/verify-email";
      }

      return Promise.reject(error);
    },
  );

  return axiosInstance;
};
