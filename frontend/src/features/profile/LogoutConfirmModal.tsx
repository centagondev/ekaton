import { LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Logging out now asks first. The old page ended the session the instant the
 * button was pressed — one stray tap next to the vote you meant to cast and
 * you were back at the landing page.
 *
 * `chrome={false}` is doing accessibility work here, not styling: the shared
 * Modal focuses its first focusable element on open, and with the default
 * header that would be the ✕. Owning the header puts CANCEL first in the DOM,
 * so the safe action is what focus lands on and what Enter triggers — the
 * destructive button must be reached on purpose. Escape and the backdrop
 * still cancel, via the Modal itself.
 *
 * The width is `size="sm"`, not a `max-w-sm` in `className`: the latter capped
 * the panel at 384px on phones too, so the sheet sat as a narrow card at the
 * bottom of the screen with the scrim visible down both sides — the surface
 * appearing not to cover the sheet. Sizes are `sm:`-scoped inside Modal, so
 * the phone sheet is full-bleed and only the desktop dialog is narrow.
 */
export function LogoutConfirmModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Log out?" chrome={false} size="sm">
      <div className="p-5 pt-4 sm:p-6">
        {/* Sheet grab handle — affordance only, on the breakpoint where the
            dialog rises from the bottom edge. */}
        <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-10 bg-ink/25 sm:hidden" />

        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-danger text-white"
          >
            <LogOut className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black uppercase leading-tight tracking-wide">Log out?</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              This ends your session on this device.
            </p>
          </div>
        </div>

        {/* Full-width buttons on a phone — a thumb reaching the bottom-right
            corner is the one target a sheet should never make small. They
            return to a right-aligned pair once the sheet becomes a dialog. */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:mt-5 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            className="w-full sm:w-auto"
          >
            <LogOut className="size-4" aria-hidden="true" /> Log out
          </Button>
        </div>
      </div>
    </Modal>
  );
}
