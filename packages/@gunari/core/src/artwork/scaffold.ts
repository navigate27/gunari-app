import type { SceneInput, SceneViewport } from "../scene/types";
import type { LayoutId } from "../scene/types";
import type { ThemePalette } from "../theme/theme";
import { artworkLayout, type ArtworkLayout, type FormatId } from "./formats";

export const ARTWORK_W = 1080;
export const ARTWORK_H = 1920;

/** A scene's render function, called by the scaffold inside the scene slot. */
export interface SceneRenderFn {
  (
    ctx: CanvasRenderingContext2D,
    geometry: unknown,
    palette: unknown,
    input: SceneInput,
    viewport: SceneViewport,
    w: number,
    h: number,
  ): void;
}

export interface ScaffoldMeta {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  location: string;    // human-readable label
  /** Optional coordinates line drawn under the location, e.g. "14.600°N / 120.984°E". */
  coordinates?: string;
}

export interface ScaffoldInput {
  /** Output size. Defaults to the 1080x1920 story format. */
  format?: FormatId;
  /** An explicit layout, for frames partway through a format or layout change. Overrides format and layout. */
  layoutSpec?: ArtworkLayout;
  layout: LayoutId;
  title: string;
  message?: string;
  meta: ScaffoldMeta;
  palette: ThemePalette;
  /** The scene's render function — scaffold calls it inside the scene slot. */
  scene: { render: SceneRenderFn };
  /** Opaque scene geometry, passed through to scene.render. */
  sceneGeometry: unknown;
  /** Opaque scene palette, passed through to scene.render. */
  scenePalette: unknown;
  /** The user's scene input (shape, marker, theme, labels, layout, rotation, location, zoom). */
  sceneInput: SceneInput;
  /** The scene slot's viewport (cx/cy/r in canvas-normalized 0..1). */
  sceneViewport: SceneViewport;
}

export function renderScaffold(ctx: CanvasRenderingContext2D, input: ScaffoldInput): void {
  const L = input.layoutSpec ?? artworkLayout(input.format ?? "story", input.layout);
  const { w: W, h: H } = L;
  const p = input.palette;

  drawBackground(ctx, W, H, p);
  drawFrame(ctx, L.inner, p);

  input.scene.render(
    ctx,
    input.sceneGeometry,
    input.scenePalette,
    input.sceneInput,
    input.sceneViewport,
    W,
    H,
  );

  drawTitle(ctx, L, p, input);
  if (input.message?.trim()) drawMessage(ctx, L, p, input);
  drawMetadata(ctx, L, p, input);
  drawWordmark(ctx, L, p);
}

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, p: ThemePalette): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.background.top);
  g.addColorStop(1, p.background.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawFrame(ctx: CanvasRenderingContext2D, inner: ArtworkLayout["inner"], p: ThemePalette): void {
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
  ctx.restore();
}

/** Width of `text` at `size`, with a rough fallback where text can't be measured. */
function widthOf(ctx: CanvasRenderingContext2D, text: string, size: number): number {
  return typeof ctx.measureText === "function" ? ctx.measureText(text).width : text.length * size * 0.45;
}

/**
 * Fit text into `maxW` by making it smaller, and if that isn't enough, by
 * breaking it over two lines. Never squeezes the letters.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontAt: (size: number) => string,
  size: number,
  maxW: number,
  maxLines: 1 | 2
): { lines: string[]; size: number } {
  const fits = (t: string, sz: number) => {
    ctx.font = fontAt(sz);
    return widthOf(ctx, t, sz) <= maxW;
  };

  for (let sz = size; sz >= size * 0.78; sz *= 0.95) {
    if (fits(text, sz)) return { lines: [text], size: sz };
  }
  const words = text.split(/\s+/);
  if (maxLines === 2 && words.length > 1) {
    // Split where the two halves are closest in width.
    let best = 1;
    let bestGap = Infinity;
    ctx.font = fontAt(size);
    for (let k = 1; k < words.length; k++) {
      const gap = Math.abs(
        widthOf(ctx, words.slice(0, k).join(" "), size) - widthOf(ctx, words.slice(k).join(" "), size)
      );
      if (gap < bestGap) {
        bestGap = gap;
        best = k;
      }
    }
    const lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
    for (let sz = size; sz >= size * 0.5; sz *= 0.95) {
      if (lines.every((l) => fits(l, sz))) return { lines, size: sz };
    }
    return { lines, size: size * 0.5 };
  }
  // One long word or a single-line slot: the smallest size, as a last resort.
  return { lines: [text], size: size * 0.5 };
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontAt: (size: number) => string,
  size: number,
  spot: { x: number; y: number; maxW: number },
  maxLines: 1 | 2
): void {
  const { lines, size: fitted } = fitText(ctx, text, fontAt, size, spot.maxW, maxLines);
  ctx.font = fontAt(fitted);
  const lineHeight = fitted * 1.08;
  // Keep the block centred on the spot so a second line doesn't run into its neighbours.
  const top = spot.y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, spot.x, top + i * lineHeight));
}

function drawTitle(ctx: CanvasRenderingContext2D, L: ArtworkLayout, p: ThemePalette, input: ScaffoldInput): void {
  if (!input.title?.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.title;
  drawFitted(
    ctx,
    input.title.trim(),
    (sz) => `500 ${Math.round(sz)}px "Cormorant Garamond", serif`,
    L.base * 0.085,
    L.title,
    2
  );
  ctx.restore();
}

function drawMessage(ctx: CanvasRenderingContext2D, L: ArtworkLayout, p: ThemePalette, input: ScaffoldInput): void {
  if (!input.message?.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.message;
  drawFitted(
    ctx,
    input.message.trim(),
    (sz) => `300 italic ${Math.round(sz)}px "Cormorant Garamond", serif`,
    L.base * 0.034,
    L.message,
    2
  );
  ctx.restore();
}

function drawMetadata(ctx: CanvasRenderingContext2D, L: ArtworkLayout, p: ThemePalette, input: ScaffoldInput): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.meta;
  const size = L.base * 0.026;
  ctx.font = `400 ${Math.round(size)}px "Geist", sans-serif`;
  const hasDateTime = input.meta.date?.trim() && input.meta.time?.trim();
  const text = hasDateTime
    ? `${formatMetaDate(input.meta.date, input.meta.time)}  ·  ${input.meta.location.toUpperCase()}`
    : input.meta.location.toUpperCase();
  drawFitted(ctx, text, (sz) => `400 ${Math.round(sz)}px "Geist", sans-serif`, size, L.meta, 1);
  if (input.meta.coordinates?.trim()) {
    ctx.globalAlpha = 0.8;
    ctx.font = `400 ${Math.round(L.base * 0.022)}px "Geist", sans-serif`;
    ctx.fillText(input.meta.coordinates.trim(), L.meta.x, L.meta.y + size * 1.7);
  }
  ctx.restore();
}

function drawWordmark(ctx: CanvasRenderingContext2D, L: ArtworkLayout, p: ThemePalette): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.accent;
  ctx.font = `400 ${Math.round(L.base * 0.022)}px "Geist", sans-serif`;
  ctx.globalAlpha = 0.7;
  ctx.fillText("GUNARI", L.wordmark.x, L.wordmark.y);
  ctx.restore();
}

function formatMetaDate(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date.toUpperCase();
  const [hh, mm] = (time || "21:00").split(":").map(Number);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${d} ${months[m - 1]} ${y} · ${String(hh ?? 21).padStart(2, "0")}:${String(mm ?? 0).padStart(2, "0")}`;
}