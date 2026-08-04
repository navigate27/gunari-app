"use client";

import type {
  GunariInput,
  ThemePalette,
  VisibleStar,
} from "../types";
import { THEMES } from "./themes";
import { FRAMES, drawFrame } from "./frames";
import { COMPASS_STYLES } from "./compass";
import { STAR_CHART_STYLES } from "./starChart";
import { drawWordmark } from "./wordmark";
import { formatDateLong, formatTimeLong, formatCoordinate } from "../utils";

export const ARTWORK_W = 1080;
export const ARTWORK_H = 1920;

export interface ArtworkRenderInput {
  input: GunariInput;
  stars: VisibleStar[];
  moon?: { x: number; y: number; phase: number };
  /** 0..1 opacity for the moon. Used to fade it in/out when toggling visibility. */
  moonOpacity?: number;
}

export function renderArtwork(
  ctx: CanvasRenderingContext2D,
  data: ArtworkRenderInput
): void {
  const { input, stars, moon } = data;
  const palette = THEMES[input.theme];
  const frame = FRAMES[input.frame];
  const compass = COMPASS_STYLES[input.compass];
  const chartStyle = STAR_CHART_STYLES[input.starChart];

  const W = ARTWORK_W;
  const H = ARTWORK_H;

  // 1. Canvas background
  drawCanvasBackground(ctx, W, H, palette);

  // 2. Frame + inner canvas region
  const { inner } = drawFrame(ctx, W, H, frame, palette);

  // 3. Title block (top)
  const titleY = drawTitle(ctx, inner, palette, input);

  // 4. Message (optional, under title)
  const messageY = input.message?.trim()
    ? drawMessage(ctx, inner, palette, input, titleY)
    : null;

  // 5. Star chart circle (center)
  const circle = computeCircle(inner, messageY != null);
  drawChartSurfaceBorder(ctx, circle, palette);
  // Always pass the moon through; visibility is controlled by moonOpacity
  // (0 hides it). This lets the live preview animate the fade in/out.
  const moonOpacity =
    data.moonOpacity != null
      ? data.moonOpacity
      : input.moon === false
      ? 0
      : 1;
  chartStyle.render(
    ctx,
    circle.cx,
    circle.cy,
    circle.rInner,
    stars,
    palette,
    moon,
    moonOpacity
  );
  // 6. Compass ring (surrounds chart)
  if (input.compass !== "blank") {
    compass.draw(
      ctx,
      circle.cx,
      circle.cy,
      circle.rOuter,
      circle.rInner,
      palette
    );
  } else {
    // Even with compass blank, draw a hairline ring around the chart for definition.
    ctx.save();
    ctx.strokeStyle = palette.compass;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(circle.cx, circle.cy, circle.rInner, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 7. Metadata (date, time, location) — bottom area
  drawMetadata(ctx, inner, palette, input);

  // 8. Wordmark — bottom center
  drawWordmark(ctx, inner.x + inner.w / 2, inner.y + inner.h - 36, palette);
}

function drawCanvasBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  palette: ThemePalette
) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, palette.canvas.top);
  g.addColorStop(1, palette.canvas.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Subtle vignette
  const v = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.2,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.75
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, palette.light ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  inner: { x: number; y: number; w: number; h: number },
  palette: ThemePalette,
  input: GunariInput
): number {
  if (!input.title?.trim()) return inner.y + inner.h * 0.08;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.title;
  const titleSize = inner.w * 0.085;
  ctx.font = `500 ${Math.round(titleSize)}px "Cormorant Garamond", serif`;
  const lines = wrapLines(ctx, input.title.trim(), inner.w * 0.82);
  let y = inner.y + inner.h * 0.12;
  const lh = titleSize * 1.15;
  for (const line of lines) {
    ctx.fillText(line, inner.x + inner.w / 2, y);
    y += lh;
  }
  // Underline accent
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const underW = Math.min(inner.w * 0.18, 220);
  ctx.moveTo(inner.x + inner.w / 2 - underW / 2, y + 4);
  ctx.lineTo(inner.x + inner.w / 2 + underW / 2, y + 4);
  ctx.stroke();
  ctx.restore();
  return y + 24;
}

function drawMessage(
  ctx: CanvasRenderingContext2D,
  inner: { x: number; y: number; w: number; h: number },
  palette: ThemePalette,
  input: GunariInput,
  afterTitleY: number
): number {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.message;
  const size = inner.w * 0.034;
  ctx.font = `300 italic ${Math.round(size)}px "Cormorant Garamond", serif`;
  const lines = wrapLines(ctx, input.message!.trim(), inner.w * 0.78);
  let y = afterTitleY + size * 0.8;
  const lh = size * 1.35;
  for (const line of lines) {
    ctx.fillText(line, inner.x + inner.w / 2, y);
    y += lh;
  }
  ctx.restore();
  return y;
}

function computeCircle(
  inner: { x: number; y: number; w: number; h: number },
  hasMessage: boolean
): { cx: number; cy: number; rOuter: number; rInner: number } {
  const cx = inner.x + inner.w / 2;
  // Vertical center: pull up slightly when message present so layout breathes.
  const top = inner.y + inner.h * (hasMessage ? 0.30 : 0.24);
  const bottom = inner.y + inner.h * 0.82;
  const available = bottom - top;
  const rOuter = Math.min(inner.w * 0.42, available * 0.48);
  const rInner = rOuter * 0.92;
  const cy = (top + bottom) / 2;
  return { cx, cy, rOuter, rInner };
}

function drawChartSurfaceBorder(
  ctx: CanvasRenderingContext2D,
  circle: { cx: number; cy: number; rOuter: number; rInner: number },
  palette: ThemePalette
) {
  ctx.save();
  ctx.strokeStyle = palette.compass;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(circle.cx, circle.cy, circle.rOuter, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMetadata(
  ctx: CanvasRenderingContext2D,
  inner: { x: number; y: number; w: number; h: number },
  palette: ThemePalette,
  input: GunariInput
) {
  const date = parseDateInput(input.date, input.time);
  if (!date) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.meta;

  const size = inner.w * 0.026;
  ctx.font = `400 ${Math.round(size)}px "Geist", sans-serif`;
  const cx = inner.x + inner.w / 2;
  const yBase = inner.y + inner.h * 0.92;

  const dateStr = formatDateLong(date).toUpperCase();
  const timeStr = formatTimeLong(date).toUpperCase();
  ctx.fillText(`${dateStr}  ·  ${timeStr}`, cx, yBase, inner.w * 0.9);

  ctx.globalAlpha = 0.85;
  ctx.font = `300 ${Math.round(size * 0.92)}px "Geist", sans-serif`;
  const locStr = input.location.label?.trim()
    ? input.location.label.toUpperCase()
    : `${formatCoordinate(input.location.lat, "lat")}  ${formatCoordinate(
        input.location.lng,
        "lng"
      )}`;
  ctx.fillText(locStr, cx, yBase + size * 1.8, inner.w * 0.9);

  ctx.restore();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function parseDateInput(date: string, time: string): Date | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (time || "21:00").split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh || 21, mm || 0));
}