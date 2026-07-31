import { useState } from "react";
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
