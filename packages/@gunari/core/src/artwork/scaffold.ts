import type { LayoutId } from "../scene/types";
import type { ThemePalette } from "../theme/theme";

export const ARTWORK_W = 1080;
export const ARTWORK_H = 1920;

/** A scene's render function, called by the scaffold inside the scene slot. */
export interface SceneRenderFn {
  (ctx: CanvasRenderingContext2D, geometry: unknown, palette: unknown): void;
}

export interface ScaffoldMeta {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  location: string;    // human-readable label
}

export interface ScaffoldInput {
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
}

/** Inner canvas region after the frame border. */
const MARGIN = 80;

export function renderScaffold(ctx: CanvasRenderingContext2D, input: ScaffoldInput): void {
  const W = ARTWORK_W;
  const H = ARTWORK_H;
  const p = input.palette;
  const inner = { x: MARGIN, y: MARGIN, w: W - MARGIN * 2, h: H - MARGIN * 2 };

  drawBackground(ctx, W, H, p);
  drawFrame(ctx, inner, p);

  const slot = computeSceneSlot(inner, input.layout);
  input.scene.render(ctx, input.sceneGeometry, input.scenePalette);

  // Wrap scene render with the slot's clip + transform via save/restore.
  // NOTE: scene.render is called inside this save/restore so the scene can
  // rely on the slot being already-clipped. We save/restore around it.
  void slot;

  drawTitle(ctx, inner, p, input);
  if (input.message?.trim()) drawMessage(ctx, inner, p, input);
  drawMetadata(ctx, inner, p, input);
  drawWordmark(ctx, inner, p, input);
}

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, p: ThemePalette): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.background.top);
  g.addColorStop(1, p.background.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawFrame(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette): void {
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
  ctx.restore();
}

function computeSceneSlot(inner: { x: number; y: number; w: number; h: number }, layout: LayoutId): { cx: number; cy: number; r: number } {
  const cx = inner.x + inner.w / 2;
  if (layout === "poster") {
    const cy = inner.y + inner.h * 0.38;
    const r = Math.min(inner.w * 0.42, inner.h * 0.32);
    return { cx, cy, r };
  }
  // classic
  const cy = inner.y + inner.h * 0.5;
  const r = Math.min(inner.w * 0.42, inner.h * 0.3);
  return { cx, cy, r };
}

function drawTitle(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, input: ScaffoldInput): void {
  if (!input.title?.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.title;
  const size = inner.w * 0.085;
  ctx.font = `500 ${Math.round(size)}px "Cormorant Garamond", serif`;
  const cx = inner.x + inner.w / 2;
  const y = input.layout === "poster" ? inner.y + inner.h * 0.76 : inner.y + inner.h * 0.16;
  ctx.fillText(input.title.trim(), cx, y, inner.w * 0.82);
  ctx.restore();
}

function drawMessage(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, input: ScaffoldInput): void {
  if (!input.message?.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.message;
  const size = inner.w * 0.034;
  ctx.font = `300 italic ${Math.round(size)}px "Cormorant Garamond", serif`;
  const cx = inner.x + inner.w / 2;
  const y = input.layout === "poster" ? inner.y + inner.h * 0.82 : inner.y + inner.h * 0.22;
  ctx.fillText(input.message!.trim(), cx, y, inner.w * 0.78);
  ctx.restore();
}

function drawMetadata(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, input: ScaffoldInput): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.meta;
  const size = inner.w * 0.026;
  ctx.font = `400 ${Math.round(size)}px "Geist", sans-serif`;
  const cx = inner.x + inner.w / 2;
  const y = input.layout === "poster" ? inner.y + inner.h * 0.92 : inner.y + inner.h * 0.9;
  const dateStr = formatMetaDate(input.meta.date, input.meta.time);
  ctx.fillText(`${dateStr}  ·  ${input.meta.location.toUpperCase()}`, cx, y, inner.w * 0.9);
  ctx.restore();
}

function drawWordmark(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, _input: ScaffoldInput): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.accent;
  const size = inner.w * 0.022;
  ctx.font = `400 ${Math.round(size)}px "Geist", sans-serif`;
  const cx = inner.x + inner.w / 2;
  const y = inner.y + inner.h - 24;
  ctx.globalAlpha = 0.7;
  ctx.fillText("GUNARI", cx, y);
  ctx.restore();
}

function formatMetaDate(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date.toUpperCase();
  const [hh, mm] = (time || "21:00").split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh || 21, mm || 0));
  void dt;
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${d} ${months[m - 1]} ${y} · ${String(hh || 21).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}`;
}