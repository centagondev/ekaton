import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ekaton:theme";

/** Matches the transition in index.css (.theme-flip), plus a frame of slack. */
const FLIP_MS = 240;

/** Keeps the iOS/Android browser chrome in step with the canvas. */
const THEME_COLOR: Record<Theme, string> = {
  light: "#fbf9f5",
  dark: "#12120f",
};

/**
 * The live theme, cached in module scope so a render never touches
 * localStorage — `useSyncExternalStore` calls the getter on every render, and
 * a synchronous storage read there would be paid by every subscriber.
 */
let current: Theme | null = null;
const listeners = new Set<() => void>();

/**
 * The persisted choice, or light.
 *
 * `prefers-color-scheme` is deliberately not consulted anywhere in this
 * module: the theme is a decision the user makes in their profile, not one
 * the device makes for them. A first-time visitor on a phone in dark mode
 * gets exactly the same light theme as everyone else.
 */
export function getTheme(): Theme {
  if (current === null) {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* private mode / blocked storage — light is the answer either way */
    }
    current = stored === "dark" ? "dark" : "light";
  }
  return current;
}

function paint(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Set inline as well as in CSS: the inline script in index.html runs before
  // the stylesheet exists, and this keeps the two from disagreeing afterwards.
  // `only` is what makes it an opt-out from platform auto-darkening rather
  // than just a hint — see the note in styles/index.css.
  root.style.colorScheme = theme === "dark" ? "only dark" : "only light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * Reconciles the DOM with the stored value at startup.
 *
 * The inline script in index.html has already done this before first paint —
 * this is the belt to its braces, and the single place the two definitions of
 * "light unless dark was chosen" have to agree.
 */
export function initTheme(): void {
  paint(getTheme());
}

let flipTimer: number | undefined;

export function setTheme(next: Theme): void {
  if (next === getTheme()) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* the choice simply won't survive a reload */
  }

  // Arm the colour transition for this flip only, then disarm it so ordinary
  // mounts stay cheap. See the .theme-flip note in styles/index.css.
  const root = document.documentElement;
  root.classList.add("theme-flip");
  window.clearTimeout(flipTimer);
  flipTimer = window.setTimeout(() => root.classList.remove("theme-flip"), FLIP_MS);

  paint(next);
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** The live theme. Every subscriber shares one value, so nothing can render
 *  a frame behind the toggle. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}
