"use client";

/**
 * Client-side image resize via <canvas>.
 *
 * - Preserves aspect ratio
 * - Scales down so the longest edge is at most `maxLongEdge` (no upscaling)
 * - Re-encodes to JPEG at the given quality (0..1)
 * - Returns a Blob ready for upload
 *
 * Modern browsers respect EXIF orientation when decoding an <img>, so the
 * canvas inherits the correct rotation. Pure DOM API — no library.
 */
export async function resizeImage(
  file: File,
  maxLongEdge: number,
  quality: number
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = scaleTo(
      img.naturalWidth,
      img.naturalHeight,
      maxLongEdge
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D-Kontext nicht verfügbar.");
    ctx.drawImage(img, 0, 0, width, height);

    return await canvasToBlob(canvas, "image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    img.src = url;
  });
}

function scaleTo(
  w: number,
  h: number,
  maxLongEdge: number
): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxLongEdge) return { width: w, height: h };
  const scale = maxLongEdge / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Bild konnte nicht kodiert werden.")),
      type,
      quality
    );
  });
}
