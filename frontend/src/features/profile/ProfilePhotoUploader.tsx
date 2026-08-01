import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/lib/api/auth";
import { parseApiError } from "@/lib/errors";
import { IMAGE_ACCEPT, MAX_IMAGE_LABEL, validateImageFile } from "@/lib/images";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/Button";
import { ImageViewer } from "@/components/ui/ImageViewer";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { cn, initialsOf } from "@/lib/utils";

/**
 * Resolve once the browser has the bitmap in hand — or once it has given up.
 *
 * Swapping straight from the local preview to the Cloudinary URL would blank
 * the frame for as long as that first fetch takes, which reads as a failed
 * upload. Waiting here means the crossfade only ever runs between two images
 * that are both ready to paint.
 */
function preloadImage(src: string | null): Promise<void> {
  if (!src) return Promise.resolve();

  return new Promise((resolve) => {
    const image = new Image();
    // Same reasoning as Avatar: photo hosts 403 requests with a foreign Referer.
    image.referrerPolicy = "no-referrer";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

/**
 * The profile photo, as its own control.
 *
 * Tapping the photo views it full-screen; the camera badge is what opens the
 * picker. Those were the same gesture before, so there was no way to simply
 * look at your own photo. A chosen file is previewed in a confirm dialog and
 * only uploaded once the user commits.
 *
 * Everything is stacked inside one fixed-size box, so nothing on the page
 * moves while an upload runs.
 */
export function ProfilePhotoUploader() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(false);
  /**
   * The `disabled` attributes below already block a second click, but state
   * updates are async and a file input can fire again before React commits.
   * This ref is what actually makes a duplicate upload impossible.
   */
  const inFlight = useRef(false);

  /**
   * The live object URL, mirrored outside state.
   *
   * Object URLs are document-lifetime handles, so each one needs an explicit
   * revoke. Keeping the current handle in a ref means revoking never has to
   * happen inside a state updater, which React is free to run twice.
   */
  const pendingUrlRef = useRef<string | null>(null);

  const clearPending = useCallback(() => {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    pendingUrlRef.current = null;
    setPending(null);
  }, []);

  useEffect(
    () => () => {
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    },
    [],
  );

  // Read through a ref so the guard below keeps a stable identity: Modal keys
  // its focus and scroll-lock effect on `onClose`, and a fresh closure every
  // render would re-run it on every keystroke of state.
  const uploadingRef = useRef(uploading);
  uploadingRef.current = uploading;

  /** Dismissing mid-upload would hide the progress, so it waits. */
  const closePending = useCallback(() => {
    if (!uploadingRef.current) clearPending();
  }, [clearPending]);

  const openPicker = () => inputRef.current?.click();

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clearing the value is what lets the same file be picked twice in a row —
    // without it, re-selecting after a rejection fires no change event at all.
    event.target.value = "";
    if (!file || inFlight.current) return;

    const problem = validateImageFile(file, "Profile photo");
    if (problem) {
      toast.error(problem);
      return;
    }

    // Replace any earlier choice rather than leaking its blob.
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    const url = URL.createObjectURL(file);
    pendingUrlRef.current = url;
    setPending({ file, url });
  };

  const upload = async () => {
    if (!pending || inFlight.current) return;

    inFlight.current = true;
    setUploading(true);

    try {
      const updated = await authApi.updateProfilePhoto(pending.file);
      // Have the hosted image decoded before it replaces the preview, so the
      // swap is a crossfade rather than a blank frame.
      await preloadImage(updated.profile_photo);
      // The PATCH response is the refreshed profile — adopting it directly is
      // what makes the new photo appear everywhere at once, with no /me/ round
      // trip and no page reload.
      setUser(updated);

      toast.success("Profile photo updated.");
      clearPending();
    } catch (error) {
      toast.error(parseApiError(error).message);
    } finally {
      inFlight.current = false;
      setUploading(false);
    }
  };

  const photo = user?.profile_photo ?? null;

  return (
    <div className="relative size-20 shrink-0 sm:size-24">
      <button
        type="button"
        onClick={() => (photo ? setViewing(true) : openPicker())}
        aria-label={photo ? "View profile photo" : "Upload a profile photo"}
        className={cn(
          "group relative block size-20 overflow-hidden border-2 border-ink bg-brand-lavender sm:size-24",
          "text-2xl font-black text-ink shadow-brutal transition-all duration-150 select-none sm:text-3xl",
          // The system's press signature, matched to Button and ActionRow.
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm",
          "active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        )}
      >
        {/* Initials sit underneath as the permanent base layer, so a crossfade
            never exposes a hole. */}
        <span className="absolute inset-0 grid place-items-center">
          {initialsOf(user?.full_name)}
        </span>

        <AnimatePresence initial={false}>
          {photo && (
            <motion.img
              key={photo}
              src={photo}
              alt=""
              referrerPolicy="no-referrer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </AnimatePresence>
      </button>

      {/* The edit affordance is its own control, always visible — a hover-only
          overlay is invisible on touch, and it used to be the only way in. */}
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        aria-label={photo ? "Change profile photo" : "Upload a profile photo"}
        className={cn(
          "absolute -bottom-1.5 -right-1.5 grid size-8 place-items-center",
          "border-2 border-ink bg-brand-yellow text-ink transition-all duration-150",
          "hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-brand-lime",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        {uploading ? <Spinner className="size-4" /> : <Camera className="size-4" />}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        // The buttons above are the controls; the input must not be a second
        // tab stop announcing the same action.
        tabIndex={-1}
        disabled={uploading}
        onChange={handleFile}
      />

      <ImageViewer
        open={viewing && Boolean(photo)}
        src={photo}
        alt={`${user?.full_name ?? "Your"} profile photo`}
        caption={user?.full_name ?? undefined}
        onClose={() => setViewing(false)}
      />

      {/* --------------------------- confirm upload -------------------------- */}
      <Modal open={pending !== null} onClose={closePending} title="New profile photo">
        <div className="space-y-5">
          <div className="relative mx-auto aspect-square w-full max-w-64 overflow-hidden border-2 border-ink bg-raised">
            {pending && (
              <img src={pending.url} alt="Selected photo" className="size-full object-cover" />
            )}
            <AnimatePresence>
              {uploading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 grid place-items-center gap-3 bg-ink/70 text-white"
                >
                  <Spinner className="size-8" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-xs text-muted">
            {uploading
              ? "Uploading…"
              : `JPG, JPEG, PNG or WEBP · ${MAX_IMAGE_LABEL} max`}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={openPicker}
              disabled={uploading}
            >
              <RefreshCw className="size-4" />
              Choose another
            </Button>
            <Button type="button" onClick={() => void upload()} loading={uploading}>
              {!uploading && <Upload className="size-4" />}
              Upload photo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
