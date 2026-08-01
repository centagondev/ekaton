import {
  forwardRef,
  memo,
  useCallback,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Input } from "./Field";

/** How long one word takes to hand over to the other. */
const SWAP_MS = 180;
const SWAP_EASE = "cubic-bezier(0.4, 0.05, 0.2, 1)";

interface PasswordVisibilityToggleProps {
  /** Whether the password is currently readable. Picks which word shows. */
  visible: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * One word, stacked on its opposite.
 *
 * Both labels live in the layout at once — the outgoing one rises and fades
 * while the incoming one comes up from below — so the pair never changes width
 * and the field cannot reflow mid-swap. SHOW and HIDE are both four characters
 * of the same monospace face, so they measure identically and the box is steady
 * even before the stacking.
 */
function Word({ shown, stacked, children }: { shown: boolean; stacked?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn("block", stacked && "absolute inset-0")}
      style={{
        opacity: shown ? 1 : 0,
        transform: `translateY(${shown ? 0 : -4}px)`,
        transition: `opacity ${SWAP_MS}ms ${SWAP_EASE}, transform ${SWAP_MS}ms ${SWAP_EASE}`,
      }}
    >
      {children}
    </span>
  );
}

/**
 * The control that reveals a password.
 *
 * A word rather than an icon: it says what it will do, which no eye can. The
 * type is the same mono uppercase the field labels use, so it reads as part of
 * the form rather than a control bolted onto it.
 *
 * The button is a full-height strip down the right end of the field. That keeps
 * the tap target comfortably past 44px and lets flex do the vertical centring,
 * instead of margin and translate having to cancel out at every font size.
 */
export const PasswordVisibilityToggle = memo(function PasswordVisibilityToggle({
  visible,
  onToggle,
  disabled,
  className,
}: PasswordVisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={visible}
      // The words are decoration for screen readers — this is the real label,
      // and it names the action rather than the state.
      aria-label={visible ? "Hide password" : "Show password"}
      // The strip runs the full height of the field, so the app's focus ring —
      // 2px outside the box — would straddle the input's border. Turning the
      // offset inward lands it neatly inside. It has to be set here rather than
      // as a utility: the global :focus-visible rule is unlayered, so it beats
      // anything Tailwind emits into @layer utilities no matter the specificity.
      style={{ outlineOffset: "-4px" }}
      className={cn(
        "absolute inset-y-0 right-0 flex items-center pl-3 pr-4",
        "font-mono text-[11px] font-bold uppercase tracking-[0.18em]",
        "text-muted transition-colors duration-200 hover:text-ink",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      <span aria-hidden="true" className="relative block">
        <Word shown={!visible}>Show</Word>
        <Word shown={visible} stacked>
          Hide
        </Word>
      </span>
    </button>
  );
});

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
  const toggle = useCallback(() => setVisible((value) => !value), []);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        disabled={disabled}
        // Room for the word, so long passwords never run underneath it. The
        // word occupies the last 50px of the field; 64px stops the text a clear
        // 14px short of it.
        className={cn("pr-16", className)}
        {...props}
      />
      <PasswordVisibilityToggle visible={visible} disabled={disabled} onToggle={toggle} />
    </div>
  );
});
