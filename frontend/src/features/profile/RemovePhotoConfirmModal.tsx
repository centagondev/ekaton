import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * Confirmation for clearing the profile photo.
 *
 * Built to match LogoutConfirmModal exactly, because it is the same kind of
 * moment: a destructive action that cannot be undone. `chrome={false}` is the
 * accessibility part of that — the shared Modal focuses its first focusable
 * element, and owning the header puts CANCEL first in the DOM so focus and
 * Enter land on the safe choice. Escape and the backdrop still cancel.
 */
export function RemovePhotoConfirmModal({
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
    <Modal
      open={open}
      // Dismissing mid-request would hide the progress, so it waits — same
      // guard the upload dialog uses.
      onClose={loading ? () => {} : onClose}
      title="Remove photo?"
      chrome={false}
      size="sm"
    >
      <div className="p-5 pt-4 sm:p-6">
        {/* Sheet grab handle — affordance only, on the breakpoint where the
            dialog rises from the bottom edge. */}
        <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-10 bg-ink/25 sm:hidden" />

        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-danger text-white"
          >
            <Trash2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-black uppercase leading-tight tracking-wide">
              Remove photo?
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Your current profile photo will be permanently deleted and your initials
              will be shown instead. You can upload a new one at any time.
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
            {!loading && <Trash2 className="size-4" aria-hidden="true" />}
            Remove photo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
