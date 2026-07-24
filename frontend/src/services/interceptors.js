import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { storage } from "./storage";
import axios from "axios";

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const setupInterceptors = (axiosInstance) => {
  axiosInstance.interceptors.request.use((config) => {
    const token = storage.get(STORAGE_KEYS.ACCESS_TOKEN);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  axiosInstance.interceptors.response.use(
    (response) => response.data,
    async (error) => {
      const originalRequest = error.config;

      // Only attempt refresh on 401, and not on refresh endpoint itself
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes("accounts/refresh/")
      ) {
        if (isRefreshing) {
          // Queue requests while a refresh is in progress
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return axiosInstance(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);

        if (!refreshToken) {
          // No refresh token — log out
          storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
          storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
          window.location.href = "/login";
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(
            "http://localhost:8000/api/v1/accounts/refresh/",
            { refresh: refreshToken }
          );

          const newAccessToken = response.data?.access ?? response.data?.data?.access;
          storage.set(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);

          axiosInstance.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
          storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
          window.location.href = "/login";
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
};
