"use client";

import { renderArtwork, ARTWORK_W, ARTWORK_H } from "./artwork";
import type { ArtworkRenderInput } from "./artwork";

export { ARTWORK_W, ARTWORK_H };

export async function renderToCanvas(
  canvas: HTMLCanvasElement,
  data: ArtworkRenderInput,
  scale = 1
): Promise<void> {
  const width = Math.round(ARTWORK_W * scale);
  const height = Math.round(ARTWORK_H * scale);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.scale(scale, scale);
  renderArtwork(ctx, data);
}

export async function exportToPng(
  data: ArtworkRenderInput,
  width = ARTWORK_W,
  height = ARTWORK_H
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  renderArtwork(ctx, data);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareBlob(
  blob: Blob,
  filename: string,
  title?: string,
  text?: string
): Promise<boolean> {
  // Prefer the Web Share API on mobile when files are supported.
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  try {
    const file = new File([blob], filename, { type: "image/png" });
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: title || "Gunari",
        text: text || "Every night tells a story.",
      });
      return true;
    }
  } catch {
    // fall through to download
  }
  downloadBlob(blob, filename);
  return false;
}