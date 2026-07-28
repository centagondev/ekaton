import { STORAGE_KEYS } from "./config";
import type { User } from "@/types/api";

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota or private-mode failures must never break the app.
    }
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
};

export function getAccessToken(): string | null {
  return storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
  return storage.get<string>(STORAGE_KEYS.REFRESH_TOKEN);
}

export function setTokens(tokens: { access?: string; refresh?: string }): void {
  if (tokens.access) storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.access);
  if (tokens.refresh) storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh);
}

export function getStoredUser(): User | null {
  return storage.get<User>(STORAGE_KEYS.USER_PROFILE);
}

export function setStoredUser(user: User): void {
  storage.set(STORAGE_KEYS.USER_PROFILE, user);
}

export function clearSession(): void {
  storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
  storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
  storage.remove(STORAGE_KEYS.USER_PROFILE);
}
