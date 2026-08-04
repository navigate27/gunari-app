"use client";

import type {
  CelestialGridLine,
  CompassStyleId,
  GunariInput,
  LayoutId,
  MilkyWayRing,
  ThemePalette,
  VisibleStar,
} from "../types";
import {
  elementHasConstellation,
  elementHasGrid,
  elementHasMilkyWay,
  elementHasMoon,
} from "../types";
import { THEMES } from "./themes";
import { FRAMES, drawFrame } from "./frames";
import { COMPASS_STYLES } from "./compass";
import { STAR_CHART_STYLES } from "./starChart";
import { drawWordmark } from "./wordmark";
import { drawConstellations } from "./constellations";
import { formatDateLong, formatTimeLong, formatCoordinate } from "../utils";

export const ARTWORK_W = 1080;
export const ARTWORK_H = 1920;

export interface ArtworkRenderInput {
  input: GunariInput;
  stars: VisibleStar[];
  moon?: { x: number; y: number; phase: number };
  /** Projected Milky Way polygon rings (canvas-normalized 0..1). */
  milkyWay?: MilkyWayRing[];
  /** Projected celestial grid lines (RA meridians + Dec parallels). */
  celestialGrid?: CelestialGridLine[];
  /** 0..1 opacity for the moon. Used to fade it in/out when toggling visibility. */
  moonOpacity?: number;
  /** 0..1 spin progress for the compass (0 = just changed, 1 = settled). */
  compassSpin?: number;
  /** Previous compass id during a crossfade transition. */
  compassFrom?: CompassStyleId;
  /** 0..1 progress for the layout transition (0 = just changed, 1 = settled). */
  layoutProgress?: number;
  /** Previous layout id during a layout transition. */
  layoutFrom?: LayoutId;
  /** 0..1 progress for the message transition (0 = has message, 1 = cleared). */
  messageProgress?: number;
  /** Scale factor for the star chart (pulses when magnitude slider changes). */
  chartScale?: number;
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

  // Filter stars by the magnitude limit so the slider controls how many
  // stars are visible on the chart.
  const visibleStars = stars.filter((s) => s.mag <= input.magnitude);

  const W = ARTWORK_W;
  const H = ARTWORK_H;

  // 1. Canvas background
  drawCanvasBackground(ctx, W, H, palette);

  // 2. Frame + inner canvas region
  const { inner } = drawFrame(ctx, W, H, frame, palette);

  const layout = input.layout ?? "classic";
  // 0 = has message, 1 = message cleared. Animated by the live preview so
  // position changes (title/chart/meta) slide instead of snap.
  const messageProgress =
    data.messageProgress != null
      ? data.messageProgress
      : input.message?.trim()
      ? 0
      : 1;

  // Layout-specific vertical positions for each section. During a layout
  // transition, positions interpolate from the previous layout to the new
  // one so all sections slide together.
  const pos = computeLayoutPositions(
    inner,
    layout,
    messageProgress,
    data.layoutFrom,
    data.layoutProgress ?? 1
  );

  // 3. Branding — top in poster layout, bottom in classic.
  if (layout === "poster") {
    drawWordmark(ctx, inner.x + inner.w / 2, pos.brandingY, palette);
  }

  // 4. Title + message (top in classic, below chart in poster).
  const titleY = drawTitle(ctx, inner, palette, input, pos.titleY);
  const messageY = input.message?.trim()
    ? drawMessage(ctx, inner, palette, input, titleY)
    : null;
  void messageY;

  // 5. Star chart circle
  const circle = computeCircle(
    inner,
    pos.chartTop,
    pos.chartBottom,
    input.compass,
    data.compassFrom,
    data.compassSpin ?? 1
  );
  // The chart + compass scale together around the chart center. This pulses
  // briefly when the magnitude slider changes, giving visual feedback.
  const chartScale = data.chartScale != null ? data.chartScale : 1;
  ctx.save();
  ctx.translate(circle.cx, circle.cy);
  ctx.scale(chartScale, chartScale);
  ctx.translate(-circle.cx, -circle.cy);

  // The instrument compass has its own gold inner ring and floating outer
  // labels — skip the faint outer chart border there so labels truly float.
  if (input.compass !== "instrument") {
    drawChartSurfaceBorder(ctx, circle, palette);
  }
  // Always pass the moon through; visibility is controlled by moonOpacity
  // (0 hides it). This lets the live preview animate the fade in/out.
  const showMoon = elementHasMoon(input.elements);
  const moonOpacity =
    data.moonOpacity != null
      ? data.moonOpacity
      : showMoon
      ? 1
      : 0;
  chartStyle.render(
    ctx,
    circle.cx,
    circle.cy,
    circle.rInner,
    visibleStars,
    palette,
    moon,
    moonOpacity
  );

  // 5b. Milky Way overlay (optional, drawn on top of the chart as a faint
  // haze of isophote polygons).
  if (elementHasMilkyWay(input.elements) && data.milkyWay) {
    drawMilkyWay(ctx, circle.cx, circle.cy, circle.rInner, data.milkyWay, palette);
  }

  // 5c. Celestial grid overlay (optional, RA meridians + Dec parallels).
  if (elementHasGrid(input.elements) && data.celestialGrid) {
    drawCelestialGrid(ctx, circle.cx, circle.cy, circle.rInner, data.celestialGrid, palette);
  }

  // 5d. Constellation overlay (optional, drawn on top of the chart).
  if (elementHasConstellation(input.elements)) {
    drawConstellations(ctx, circle.cx, circle.cy, circle.rInner, visibleStars, palette);
  }

  // 6. Compass ring (surrounds chart)
  // During a style change, the old compass spins out (rotate + fade out)
  // while the new one spins in (rotate + fade in) for a smooth crossfade.
  const spin = data.compassSpin != null ? data.compassSpin : 1;
  const fromId = data.compassFrom;
  const inTransition = fromId != null && spin < 1;

  // Offscreen canvas for compositing compasses with a fade alpha. The compass
  // draw functions set their own globalAlpha internally (0.4, 0.7, 1, etc.),
  // which would override any fade alpha set on the main context. Rendering to
  // an offscreen first lets those internal alphas apply normally, then we
  // composite the result with the fade alpha on top.
  const offscreen = getCompassOffscreen(circle.rOuter);
  const octx = offscreen.getContext("2d");

  const drawCompassWith = (
    style: typeof compass,
    alpha: number,
    angle: number
  ) => {
    if (!octx) return;
    // Render the compass to the offscreen at full strength.
    octx.globalAlpha = 1;
    octx.clearRect(0, 0, offscreen.width, offscreen.height);
    style.draw(octx, offscreen.width / 2, offscreen.height / 2, circle.rOuter, circle.rInner, palette);
    // Composite onto the main canvas with rotation + fade alpha.
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(circle.cx, circle.cy);
    ctx.rotate(angle);
    ctx.drawImage(offscreen, -offscreen.width / 2, -offscreen.height / 2);
    ctx.restore();
  };

  if (input.compass !== "blank") {
    // Sine/cosine crossfade: both compasses stay more opaque through the
    // middle so the background doesn't bleed through and wash out the fade.
    const oldAlpha = Math.cos(spin * Math.PI / 2);
    const newAlpha = Math.sin(spin * Math.PI / 2);
    if (inTransition && fromId !== "blank") {
      // Old compass: fade out + rotate 0 → 180°
      drawCompassWith(COMPASS_STYLES[fromId], oldAlpha, spin * Math.PI);
    }
    if (inTransition) {
      // New compass: fade in + rotate 180° → 0°
      drawCompassWith(compass, newAlpha, (1 - spin) * Math.PI);
    } else {
      compass.draw(ctx, circle.cx, circle.cy, circle.rOuter, circle.rInner, palette);
    }
  } else {
    // Switching to blank — still spin out the old compass if transitioning.
    if (inTransition && fromId !== "blank") {
      drawCompassWith(COMPASS_STYLES[fromId], Math.cos(spin * Math.PI / 2), spin * Math.PI);
    }
    // Hairline ring around the chart for definition.
    ctx.save();
    ctx.strokeStyle = palette.compass;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(circle.cx, circle.cy, circle.rInner, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // End chart + compass scale transform.
  ctx.restore();

  // 7. Metadata (date, time, location) — bottom area
  drawMetadata(ctx, inner, palette, input, pos.metaY);

  // 8. Wordmark — bottom center in classic layout
  if (layout === "classic") {
    drawWordmark(ctx, inner.x + inner.w / 2, pos.brandingY, palette);
  }
}

interface LayoutPositions {
  titleY: number;
  chartTop: number;
  chartBottom: number;
  metaY: number;
  brandingY: number;
}

function computeLayoutPositions(
  inner: { x: number; y: number; w: number; h: number },
  layout: LayoutId,
  messageProgress: number,
  fromLayout?: LayoutId,
  progress = 1
): LayoutPositions {
  const target = rawLayoutPositions(inner, layout, messageProgress);
  if (!fromLayout || progress >= 1) return target;
  const from = rawLayoutPositions(inner, fromLayout, messageProgress);
  const e = easeInOutCubic(progress);
  return {
    titleY: lerp(from.titleY, target.titleY, e),
    chartTop: lerp(from.chartTop, target.chartTop, e),
    chartBottom: lerp(from.chartBottom, target.chartBottom, e),
    metaY: lerp(from.metaY, target.metaY, e),
    brandingY: lerp(from.brandingY, target.brandingY, e),
  };
}

function rawLayoutPositions(
  inner: { x: number; y: number; w: number; h: number },
  layout: LayoutId,
  messageProgress: number
): LayoutPositions {
  if (layout === "poster") {
    const chartBottom = 0.62;
    // With message (p=0): title hugs chart, meta sits low.
    // No message (p=1): title + meta pushed 20% further from chart, then
    // title nudged 20% of the way toward meta to group them.
    const withMsgTitle = chartBottom + 0.084;
    const withMsgMeta = chartBottom + 0.28;
    const noMsgTitleGap = 0.084 * 1.2;
    const noMsgMetaGap = 0.202 * 1.2;
    const noMsgTitle =
      chartBottom + noMsgTitleGap + (noMsgMetaGap - noMsgTitleGap) * 0.2;
    const noMsgMeta = chartBottom + noMsgMetaGap;
    return {
      brandingY: inner.y + inner.h * 0.06,
      chartTop: inner.y + inner.h * 0.14,
      chartBottom: inner.y + inner.h * chartBottom,
      titleY: inner.y + inner.h * lerp(withMsgTitle, noMsgTitle, messageProgress),
      metaY: inner.y + inner.h * lerp(withMsgMeta, noMsgMeta, messageProgress),
    };
  }
  return {
    titleY: inner.y + inner.h * lerp(0.156, 0.176, messageProgress),
    chartTop: inner.y + inner.h * lerp(0.3, 0.24, messageProgress),
    chartBottom: inner.y + inner.h * 0.82,
    metaY: inner.y + inner.h * 0.88,
    brandingY: inner.y + inner.h - 100,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
  input: GunariInput,
  startY: number
): number {
  if (!input.title?.trim()) return startY;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.title;
  const titleSize = inner.w * 0.085;
  ctx.font = `500 ${Math.round(titleSize)}px "Cormorant Garamond", serif`;
  const lines = wrapLines(ctx, input.title.trim(), inner.w * 0.82);
  let y = startY;
  const lh = titleSize * 1.15;
  for (const line of lines) {
    ctx.fillText(line, inner.x + inner.w / 2, y);
    y += lh;
  }
  // Underline accent — only when there's a message below to separate from
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const underW = Math.min(inner.w * 0.18, 220);
  ctx.moveTo(inner.x + inner.w / 2 - underW / 2, y + 4);
  ctx.lineTo(inner.x + inner.w / 2 + underW / 2, y + 4);
  if (input.message?.trim()) {
    ctx.stroke();
  }
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

function compassBandRatio(id: CompassStyleId): number {
  // The instrument compass is a triple-ring scientific layout that needs
  // more radial room than the minimal hairline ring.
  return id === "instrument" ? 0.80 : 0.92;
}

function computeCircle(
  inner: { x: number; y: number; w: number; h: number },
  chartTop: number,
  chartBottom: number,
  compassId: CompassStyleId,
  fromId: CompassStyleId | undefined,
  spin: number
): { cx: number; cy: number; rOuter: number; rInner: number } {
  const cx = inner.x + inner.w / 2;
  const top = chartTop;
  const bottom = chartBottom;
  const available = bottom - top;
  const rOuter = Math.min(inner.w * 0.42, available * 0.48);
  // Interpolate the band ratio during a compass transition so the chart
  // and compass band scale smoothly instead of snapping.
  const newRatio = compassBandRatio(compassId);
  const inTransition = fromId != null && spin < 1;
  const ratio = inTransition
    ? compassBandRatio(fromId!) + (newRatio - compassBandRatio(fromId!)) * spin
    : newRatio;
  const rInner = rOuter * ratio;
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

/**
 * Draw the Milky Way as filled isophote polygons. Level 1 is the faintest
 * outer contour, level 5 is the brightest core. Opacity scales with level so
 * the band has depth. Drawn on top of the chart with low alpha so stars
 * remain visible through the haze.
 */
function drawMilkyWay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rings: MilkyWayRing[],
  palette: ThemePalette
): void {
  ctx.save();
  // Clip to the chart circle so polygons don't bleed outside.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = palette.star;
  // Draw faintest first so brighter levels layer on top.
  const sorted = [...rings].sort((a, b) => a.level - b.level);
  for (const ring of sorted) {
    // Level 1 (faintest) → 0.067, Level 5 (brightest) → 0.192
    const alpha = (0.03 + (ring.level / 5) * 0.13) * 1.2;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    const p0 = ring.points[0];
    ctx.moveTo(cx + (p0.x - 0.5) * 2 * r, cy + (p0.y - 0.5) * 2 * r);
    for (let i = 1; i < ring.points.length; i++) {
      const p = ring.points[i];
      ctx.lineTo(cx + (p.x - 0.5) * 2 * r, cy + (p.y - 0.5) * 2 * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw the celestial grid — RA meridians and Dec parallels — as faint
 * polylines clipped to the chart circle. The lines are pre-projected in
 * computeSky; here we just stroke them.
 */
function drawCelestialGrid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lines: CelestialGridLine[],
  palette: ThemePalette
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = palette.compass;
  ctx.lineWidth = 0.8;
  ctx.lineCap = "round";

  for (const line of lines) {
    // Dec 0° (celestial equator) slightly stronger as a reference line.
    ctx.globalAlpha = (line.type === "dec" && line.value === 0 ? 0.35 : 0.18) * 1.95;
    ctx.beginPath();
    const p0 = line.points[0];
    ctx.moveTo(cx + (p0.x - 0.5) * 2 * r, cy + (p0.y - 0.5) * 2 * r);
    for (let i = 1; i < line.points.length; i++) {
      const p = line.points[i];
      ctx.lineTo(cx + (p.x - 0.5) * 2 * r, cy + (p.y - 0.5) * 2 * r);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawMetadata(
  ctx: CanvasRenderingContext2D,
  inner: { x: number; y: number; w: number; h: number },
  palette: ThemePalette,
  input: GunariInput,
  yBase: number
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

// Reusable offscreen canvas for compositing compasses with a fade alpha.
// Sized to fit the compass (2 * rOuter + padding for cardinal labels).
let compassOffscreen: HTMLCanvasElement | null = null;
function getCompassOffscreen(rOuter: number): HTMLCanvasElement {
  const size = Math.ceil(rOuter * 2 + 60);
  if (!compassOffscreen) {
    compassOffscreen = typeof document !== "undefined" ? document.createElement("canvas") : null;
  }
  if (compassOffscreen) {
    if (compassOffscreen.width !== size) {
      compassOffscreen.width = size;
      compassOffscreen.height = size;
    }
  }
  return compassOffscreen as HTMLCanvasElement;
}