import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { StackEngine } from "./stackEngine";

/**
 * React shell around the stack engine.
 *
 * Holds no state and renders once: the engine owns the loop, input and
 * particles. Unmounting — which is what happens the moment matchmaking
 * navigates to a chat — calls destroy() and tears everything down.
 */
export function StackGame({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StackEngine | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new StackEngine(canvas, {
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    });
    engineRef.current = engine;

    return () => {
      engineRef.current = null;
      engine.destroy();
    };
  }, []);

  // The canvas cannot inherit the flip, so it is told about it. A run in
  // progress is untouched — only the palette it paints with changes.
  useEffect(() => {
    engineRef.current?.refreshTheme();
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "manipulation" }}
      role="img"
      aria-label="Stack mini-game — press space or tap to drop a block while you wait"
    />
  );
}
