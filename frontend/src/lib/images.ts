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

/** Type check alone — for callers that compress before the size limit applies. */
export function validateImageType(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return UNSUPPORTED_IMAGE_TYPE_MESSAGE;
  }
  return null;
}

/* ---------------------------- upload compression --------------------------- */

/**
 * Ceiling on what compression will even try to decode. Far above the upload
 * limit on purpose: a 12 MB camera photo usually compresses to a couple of
 * hundred KB, so rejecting it at 2 MB would refuse work the client can do.
 */
export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;

export const SOURCE_IMAGE_TOO_LARGE_MESSAGE = `That image is too large to process. Please pick one under ${
  MAX_SOURCE_IMAGE_BYTES / (1024 * 1024)
} MB.`;

/**
 * Longest edge after resize. A profile photo renders at 96 CSS px in the app
 * and full-screen only in the viewer, so 1280 keeps it sharp on any phone
 * while cutting a camera original by an order of magnitude.
 */
const MAX_UPLOAD_DIMENSION = 1280;

/** Encoder quality — visually clean for photos at avatar/viewer sizes. */
const COMPRESS_QUALITY = 0.82;

/**
 * Files already this small upload in well under a second; re-encoding them
 * costs quality for no meaningful transfer win.
 */
const COMPRESS_SKIP_BYTES = 300 * 1024;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Decode with EXIF orientation applied, so a portrait phone photo is not
 * uploaded sideways. Falls back to an <img> for browsers whose
 * createImageBitmap lacks the orientation option.
 */
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image decode failed"));
      };
      image.src = url;
    });
  }
}

/**
 * Shrink and re-encode an image for upload, preserving aspect ratio.
 *
 * WEBP where the browser can encode it, JPEG otherwise (Safari has no WEBP
 * encoder); both are types the backend already accepts. Transparency is
 * flattened onto white so the two encoders produce the same picture. Never
 * makes things worse: any failure — decode, canvas, encoding — and any result
 * that is not actually smaller falls back to the original file untouched.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.size <= COMPRESS_SKIP_BYTES) return file;

  try {
    const source = await decodeImage(file);
    const sourceWidth =
      "naturalWidth" in source ? source.naturalWidth : source.width;
    const sourceHeight =
      "naturalHeight" in source ? source.naturalHeight : source.height;
    if (!sourceWidth || !sourceHeight) return file;

    const scale = Math.min(1, MAX_UPLOAD_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, width, height);
    if ("close" in source) source.close();

    let blob = await canvasToBlob(canvas, "image/webp", COMPRESS_QUALITY);
    // An encoder that cannot produce the requested type silently hands back
    // PNG — check the result, not just its existence.
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", COMPRESS_QUALITY);
    }
    if (!blob || !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(blob.type)) {
      return file;
    }
    if (blob.size >= file.size) return file;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
  } catch {
    return file;
  }
}
