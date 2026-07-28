type ClassValue = string | number | null | undefined | false | ClassValue[];

/** Minimal class joiner — no runtime dependency needed for this design system. */
export function cn(...parts: ClassValue[]): string {
  return parts
    .flat(Infinity as 1)
    .filter((part): part is string | number => Boolean(part))
    .join(" ");
}

export function formatTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  if (!iso) return "";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "in 2h 15m" / "ended" — events expose only end_time, never a start time. */
export function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "ended";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  return `in ${Math.floor(hours / 24)}d`;
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** Milliseconds left in the backend's 5-minute complaint edit/delete window. */
export function editWindowLeft(createdAt: string): number {
  const FIVE_MINUTES = 5 * 60 * 1000;
  return Math.max(0, FIVE_MINUTES - (Date.now() - new Date(createdAt).getTime()));
}

/** Pull the opaque cursor token out of a DRF cursor-pagination URL. */
export function cursorFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("cursor");
  } catch {
    return null;
  }
}

/** Pull the page number out of a DRF page-number pagination URL. */
export function pageFromUrl(url: string | null): number | undefined {
  if (!url) return undefined;
  try {
    return Number(new URL(url).searchParams.get("page")) || undefined;
  } catch {
    return undefined;
  }
}
