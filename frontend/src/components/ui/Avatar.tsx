import { useEffect, useState } from "react";
import { cn, initialsOf } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  /**
   * A failure belongs to one URL, not to the component.
   *
   * Without this reset, the flag was permanent: uploading a new photo swapped
   * `src` but kept `broken`, so the avatar stayed on its initials and the new
   * photo never appeared. That is reachable on every upload after the first —
   * the backend deletes the old Cloudinary asset before storing the new one, so
   * the URL still on screen starts 404ing mid-upload, trips `onError`, and the
   * component never recovers.
   */
  useEffect(() => setBroken(false), [src]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden border-2 border-ink bg-brand-lavender font-black text-ink",
        className,
      )}
    >
      {src && !broken ? (
        <img
          // Remount on a new URL so the browser never paints the previous
          // photo while the next one decodes.
          key={src}
          src={src}
          alt=""
          loading="lazy"
          // Many image hosts (googleusercontent, Instagram CDN, …) answer 403
          // to requests carrying a foreign Referer. Admin-entered photo URLs
          // point at exactly such hosts, so avatars request with no referrer —
          // otherwise the load fails and the fallback silently hides the photo.
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}
