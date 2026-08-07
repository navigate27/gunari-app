/**
 * Convert a canvas to a PNG Blob. Used by the Next.js app's "Generate"
 * button for download. Resolves with the blob; rejects on toBlob failure.
 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("canvas.toBlob returned null"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

/**
 * Convert a canvas to a PNG data URL. Useful for tests and for
 * `Img.src = url` style previews.
 */
export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}