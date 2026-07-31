import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./Field";

/** How long a blink keeps the lid shut. */
const BLINK_MS = 130;

/** Idle blinks land somewhere in this range, so two eyes on the same screen
 *  never fall into step with each other. */
const IDLE_BLINK_MIN_MS = 8000;
const IDLE_BLINK_MAX_MS = 12000;

/** How far the iris drifts toward the pointer, in viewBox units. */
const IRIS_DRIFT = 1.4;

/** Lid travel. Open parks it above the lens; closed stops just past the middle
 *  so the lash line lands across the widest part and a crescent of iris stays
 *  showing underneath — an eye resting, rather than an empty outline. */
const LID_OPEN = 0;
const LID_CLOSED = 13;

interface PasswordVisibilityToggleProps {
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Rendered size in pixels. The artwork is vector, so any size is sharp. */
  size?: number;
  className?: string;
}

/**
 * The eye that reveals a password.
 *
 * Drawn rather than imported: a rhombus lens with a square pupil, matching the
 * project's straight edges and hard contrast. Hidden, it sits almost shut with
 * the iris turned aside; revealing lifts the lid while the iris rotates level
 * and opens up, so the two states are one movement rather than two icons.
 *
 * Everything animates through transform and opacity only, so it stays on the
 * compositor and never reflows the input beside it.
 */
export function PasswordVisibilityToggle({
  visible,
  onToggle,
  disabled,
  size = 20,
  className,
}: PasswordVisibilityToggleProps) {
  const [blinking, setBlinking] = useState(false);
  const driftRef = useRef<SVGGElement>(null);

  // Idle blink. Cleared on unmount so a closed modal leaves no timer behind.
  useEffect(() => {
    if (disabled) return;

    let scheduleTimer: number;
    let openTimer: number;

    const schedule = () => {
      const delay =
        IDLE_BLINK_MIN_MS + Math.random() * (IDLE_BLINK_MAX_MS - IDLE_BLINK_MIN_MS);

      scheduleTimer = window.setTimeout(() => {
        setBlinking(true);
        openTimer = window.setTimeout(() => setBlinking(false), BLINK_MS);
        schedule();
      }, delay);
    };

    schedule();

    return () => {
      window.clearTimeout(scheduleTimer);
      window.clearTimeout(openTimer);
    };
  }, [disabled]);

  /** Nudge the iris toward the pointer by writing the style directly, which
   *  keeps a mouse move off React's render path entirely. */
  const followPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    const node = driftRef.current;
    if (!node || !visible) return;

    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width - 0.5) * 2;
    const y = ((event.clientY - box.top) / box.height - 0.5) * 2;
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));

    node.style.transform =
      `translate(${clamp(x) * IRIS_DRIFT}px, ${clamp(y) * IRIS_DRIFT}px)`;
  };

  const resetPointer = () => {
    if (driftRef.current) driftRef.current.style.transform = "translate(0px, 0px)";
  };

  const shut = !visible || blinking;

  return (
    <button
      type="button"
      onClick={onToggle}
      onPointerMove={followPointer}
      onPointerLeave={resetPointer}
      disabled={disabled}
      aria-pressed={visible}
      aria-label={visible ? "Hide password" : "Show password"}
      // -m-2 p-2 grows the tap target past 40px without moving the artwork.
      className={cn(
        "absolute right-1 top-1/2 -m-2 -translate-y-1/2 p-2",
        "text-muted transition-colors hover:text-ink disabled:opacity-40",
        className,
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="overflow-visible"
      >
        <defs>
          {/* Keeps the lid and iris inside the lens as they move. */}
          <clipPath id="ekaton-eye-lens">
            <path d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z" />
          </clipPath>
        </defs>

        <g clipPath="url(#ekaton-eye-lens)">
          <g ref={driftRef} style={{ transition: "transform 220ms ease-out" }}>
            <g
              style={{
                transformBox: "view-box",
                transformOrigin: "12px 12px",
                transform: shut ? "scale(0.72) rotate(-14deg)" : "scale(1) rotate(0deg)",
                transition: "transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1)",
              }}
            >
              <circle cx="12" cy="12" r="4.4" fill="var(--color-brand-yellow)" />
              {/* A square pupil is the piece that makes this eye ours. */}
              <rect x="10.1" y="10.1" width="3.8" height="3.8" fill="currentColor" />
              <rect x="13.1" y="8.8" width="1.5" height="1.5" fill="var(--color-surface)" />
            </g>
          </g>

          {/* The lid. Sits above the lens when open and slides down to close. */}
          <g
            style={{
              transform: `translateY(${shut ? LID_CLOSED : LID_OPEN}px)`,
              transition: "transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1)",
            }}
          >
            <rect x="-2" y="-24" width="28" height="24" fill="var(--color-surface)" />
            <rect x="-2" y="-1.6" width="28" height="1.6" fill="currentColor" />
          </g>
        </g>

        <path
          d="M12 3.5 L20.5 12 L12 20.5 L3.5 12 Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="miter"
        />
      </svg>
    </button>
  );
}

/**
 * A password field with the reveal control already wired in.
 *
 * Everything else — border, focus ring, disabled styling — comes from the
 * shared Input, so a password box stays identical to every other field.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function PasswordInput({ className, disabled, ...props }, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        disabled={disabled}
        // Room for the control, so long passwords never run underneath it.
        className={cn("pr-12", className)}
        {...props}
      />
      <PasswordVisibilityToggle
        visible={visible}
        disabled={disabled}
        onToggle={() => setVisible((value) => !value)}
      />
    </div>
  );
});
