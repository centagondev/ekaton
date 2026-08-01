/**
 * Client-side image upload rules.
 *
 * These mirror `core/validators.py` on the backend, which stays the authority —
 * checking here only buys the user an instant answer instead of a round trip
 * that ends in a 400. Keep the two in step.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * JPG and JPEG share the `image/jpeg` type, so four accepted extensions map to
 * three MIME types.
 */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * For the `accept` attribute. The extensions are listed alongside the MIME
 * types because some Android pickers filter on extension alone.
 */
export const IMAGE_ACCEPT = [...ACCEPTED_IMAGE_TYPES, ".jpg", ".jpeg", ".png", ".webp"].join(",");

export const UNSUPPORTED_IMAGE_TYPE_MESSAGE =
  "Only JPG, JPEG, PNG, and WEBP images are allowed.";

/** "1.4 MB" — for size limits and error copy, never precise enough to matter. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** "2 MB" — the limit itself, which is always a whole number of megabytes. */
export const MAX_IMAGE_LABEL = `${MAX_IMAGE_BYTES / (1024 * 1024)} MB`;

/**
 * A human-readable reason the file is unusable, or null when it is fine.
 *
 * `label` names the field in the size message so it reads as the specific
 * thing the user just picked ("Profile photo must be smaller than 2 MB").
 */
export function validateImageFile(file: File, label = "Image"): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return UNSUPPORTED_IMAGE_TYPE_MESSAGE;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${label} must be smaller than ${MAX_IMAGE_LABEL}.`;
  }
  return null;
}
