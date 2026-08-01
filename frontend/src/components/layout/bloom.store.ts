import { useCallback, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";
import { create } from "zustand";

/** The one route that gets the ceremonial entrance. */
export const BLOOM_ROUTE = "/public-speaking";

export interface BloomOrigin {
  x: number;
  y: number;
  /** Where to go once the bloom has covered the screen. */
  to: string;
}

interface BloomState {
  origin: BloomOrigin | null;
  /** Start the transition from a click point. */
  play: (origin: BloomOrigin) => void;
  /** The overlay has finished opening and unmounted itself. */
  clear: () => void;
}

/**
 * The Pookalam Bloom — state for the one ceremonial navigation in the app.
 *
 * A store rather than a context because the two things involved never share a
 * subtree in a useful way: the trigger is a link in the navbar or the bottom
 * bar, and the overlay is a fixed layer in the shell. Zustand is already the
 * app's store of record.
 */
export const useBloomStore = create<BloomState>((set) => ({
  origin: null,
  play: (origin) => set({ origin }),
  clear: () => set({ origin: null }),
}));

/**
 * Click handler for a link that should bloom instead of jumping.
 *
 * Deliberately gives up and lets the browser do its ordinary thing whenever
 * the click is not a plain left-click on a different page — a ⌘-click still
 * opens a new tab, a middle-click still does what it always did, and tapping
 * the tab you are already on does nothing rather than replaying a 1.2s
 * animation over the same content.
 */
export function useBloomLink(to: string) {
  const play = useBloomStore((state) => state.play);
  const { pathname } = useLocation();

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (pathname === to) return;

      event.preventDefault();

      // Enter on a focused link reports (0, 0); blooming out of the corner of
      // the screen for a keyboard user would look like a rendering fault.
      const keyboard = event.clientX === 0 && event.clientY === 0;
      play({
        x: keyboard ? window.innerWidth / 2 : event.clientX,
        y: keyboard ? window.innerHeight / 2 : event.clientY,
        to,
      });
    },
    [play, pathname, to],
  );
}
