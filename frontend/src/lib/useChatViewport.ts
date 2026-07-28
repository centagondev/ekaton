import { useEffect, useRef } from "react";

/**
 * True on touch devices. Chat inputs skip `autoFocus` here: throwing the
 * keyboard up the instant a room opens covers the conversation you just
 * joined, which no native messenger does.
 */
export const COARSE_POINTER =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Pins a full-screen chat surface to the *visual* viewport.
 *
 * `100dvh` is not enough on its own. Android Chrome only shrinks it once
 * `interactive-widget=resizes-content` is set (see index.html), and iOS Safari
 * never shrinks it at all — there the keyboard overlays the layout viewport and
 * scrolls the page underneath it, which is what pushes the composer and Send
 * button out of sight.
 *
 * `visualViewport` reports the genuinely visible box on both platforms:
 *   - `height` ends exactly where the keyboard starts.
 *   - `offsetTop` is how far iOS slid the layout viewport up; re-applying it as
 *     `top` cancels that slide, so the header stays put instead of drifting.
 *
 * Both are published as CSS custom properties so the surface can fall back to
 * `100dvh` when the API is missing (older Firefox), rather than collapsing.
 *
 * @param onViewportChange Ran after each update — used to re-pin the transcript
 *   to the newest message as the keyboard animates in.
 */
export function useChatViewport(onViewportChange?: () => void) {
  // Held in a ref so a caller passing an inline arrow does not resubscribe the
  // listeners on every render.
  const callbackRef = useRef(onViewportChange);
  callbackRef.current = onViewportChange;

  useEffect(() => {
    // The page itself must never scroll: only the transcript does. Without this
    // iOS bounces the whole document when you drag past the last message.
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousOverscroll = body.style.overscrollBehavior;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const viewport = window.visualViewport;
    const root = document.documentElement;

    const restore = () => {
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscroll;
      root.style.removeProperty("--chat-viewport-height");
      root.style.removeProperty("--chat-viewport-offset");
      root.style.removeProperty("--chat-keyboard-inset");
    };

    if (!viewport) return restore;

    let frame = 0;

    const apply = () => {
      // resize and scroll both fire in bursts while the keyboard animates;
      // coalescing to one write per frame keeps it from thrashing layout.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--chat-viewport-height", `${viewport.height}px`);
        root.style.setProperty("--chat-viewport-offset", `${viewport.offsetTop}px`);
        // How much of the window the keyboard is covering. The composer
        // subtracts this from its safe-area padding: the home indicator only
        // needs clearing while it is actually visible, and padding it out from
        // under an open keyboard is exactly the stray gap that makes mobile
        // web chat feel broken.
        const keyboard = Math.max(
          0,
          window.innerHeight - viewport.height - viewport.offsetTop,
        );
        root.style.setProperty("--chat-keyboard-inset", `${keyboard}px`);
        callbackRef.current?.();
      });
    };

    apply();
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      restore();
    };
  }, []);
}

/**
 * Inline style for the root element of a chat screen. Kept next to the hook so
 * the variable names can never drift apart.
 */
export const chatSurfaceStyle = {
  top: "var(--chat-viewport-offset, 0px)",
  height: "var(--chat-viewport-height, 100dvh)",
} as const;

/**
 * Bottom padding for a chat composer: clears the iOS home indicator, but
 * collapses to zero once the keyboard is covering that strip.
 */
export const composerPaddingStyle = {
  paddingBottom:
    "max(0px, calc(env(safe-area-inset-bottom) - var(--chat-keyboard-inset, 0px)))",
  // Landscape on a notched phone eats into one side of the viewport.
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
} as const;
