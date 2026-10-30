import type { SceneInput, SceneViewport } from "../scene/types";
import type { LayoutId } from "../scene/types";
import type { ThemePalette } from "../theme/theme";
import { FORMATS, artworkLayout, type ArtworkLayout, type FormatId } from "./formats";

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
  const { w: W, h: H } = FORMATS[input.format ?? "story"];
  const p = input.palette;
  const L = artworkLayout(input.format ?? "story", input.layout);

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

function drawTitle(ctx: CanvasRenderingContext2D, L: ArtworkLayout, p: ThemePalette, input: ScaffoldInput): void {
  if (!input.title?.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.title;
  ctx.font = `500 ${Math.round(L.base * 0.085)}px "Cormorant Garamond", serif`;
  ctx.fillText(input.title.trim(), L.title.x, L.title.y, L.title.maxW);
  ctx.restore();
}

function drawMessage(ctx: CanvasRenderingContext2D, L: ArtworkLayout, p: ThemePalette, input: ScaffoldInput): void {
  if (!input.message?.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.message;
  ctx.font = `300 italic ${Math.round(L.base * 0.034)}px "Cormorant Garamond", serif`;
  ctx.fillText(input.message.trim(), L.message.x, L.message.y, L.message.maxW);
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
  ctx.fillText(text, L.meta.x, L.meta.y, L.meta.maxW);
  if (input.meta.coordinates?.trim()) {
    ctx.globalAlpha = 0.8;
    ctx.font = `400 ${Math.round(L.base * 0.022)}px "Geist", sans-serif`;
    ctx.fillText(input.meta.coordinates.trim(), L.meta.x, L.meta.y + size * 1.7, L.meta.maxW);
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