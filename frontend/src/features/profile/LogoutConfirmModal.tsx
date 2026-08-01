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
    <Modal open={open} onClose={onClose} title="Log out?" chrome={false} className="max-w-sm">
      <div className="p-5">
        {/* Sheet grab handle — affordance only, on the breakpoint where the
            dialog rises from the bottom edge. */}
        <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-12 bg-ink/25 sm:hidden" />

        <h2 className="text-lg font-black uppercase tracking-wide">Log out?</h2>
        <p className="mt-1 text-sm text-muted">This ends your session on this device.</p>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            <LogOut className="size-4" aria-hidden="true" /> Log out
          </Button>
        </div>
      </div>
    </Modal>
  );
}
