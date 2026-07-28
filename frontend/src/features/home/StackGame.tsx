import { useEffect, useRef } from "react";
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new StackEngine(canvas, {
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    });

    return () => engine.destroy();
  }, []);

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
