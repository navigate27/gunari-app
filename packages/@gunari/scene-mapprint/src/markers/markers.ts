import type { MarkerStyleId } from "@gunari/core";

export interface MarkerPalette {
  marker: string;
  markerSymbol: string;
  light: boolean;
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function easeOutBounce(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

/** Mix a #rrggbb colour toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const target = amount >= 0 ? 255 : 0;
  const k = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * k);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Pin proportions, in units of r. The tip sits at the origin and the body rises above it. */
const BODY_R = 0.75;
const BODY_CY = -1.55;

/**
 * Draw the pin: a soft ground shadow, a gradient teardrop whose TIP sits on
 * (x, y), and a highlight. The symbol is drawn separately on the body.
 * `progress` (0..1) drops the pin in from above with a small bounce.
 */
export function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  palette: MarkerPalette,
  progress = 1
): void {
  const t = clamp01(progress);
  if (t <= 0) return;
  const lift = (1 - easeOutBounce(t)) * r * 5;

  // Ground shadow under the tip, tightening as the pin lands.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.32);
  const sr = r * 0.7 * (0.45 + 0.55 * t);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
  sg.addColorStop(0, "rgba(0,0,0,0.38)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.globalAlpha = t;
  ctx.beginPath();
  ctx.arc(0, 0, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y - lift);
  ctx.globalAlpha = clamp01(t * 4);

  const grad = ctx.createLinearGradient(0, -2.3 * r, 0, 0);
  grad.addColorStop(0, shade(palette.marker, 0.22));
  grad.addColorStop(0.55, palette.marker);
  grad.addColorStop(1, shade(palette.marker, -0.14));

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-0.12 * r, -0.55 * r, -BODY_R * r, -0.95 * r, -BODY_R * r, BODY_CY * r);
  ctx.arc(0, BODY_CY * r, BODY_R * r, Math.PI, 0, false);
  ctx.bezierCurveTo(BODY_R * r, -0.95 * r, 0.12 * r, -0.55 * r, 0, 0);
  ctx.closePath();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = r * 0.35;
  ctx.shadowOffsetY = r * 0.12;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Specular highlight along the upper left of the body.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, BODY_CY * r, BODY_R * r * 0.82, Math.PI * 1.08, Math.PI * 1.55, false);
  ctx.stroke();
  ctx.restore();
}

type Symbol = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: MarkerPalette) => void;

function withBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  progress: number,
  paint: (cx: number, cy: number) => void
): void {
  const t = clamp01(progress);
  const lift = (1 - easeOutBounce(t)) * r * 5;
  ctx.save();
  ctx.globalAlpha = clamp01(t * 4);
  paint(x, y - lift + BODY_CY * r);
  ctx.restore();
}

const drawSolid: Symbol = (ctx, cx, cy, r, palette) => {
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
};

const drawRing: Symbol = (ctx, cx, cy, r, palette) => {
  ctx.strokeStyle = palette.markerSymbol;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
  ctx.stroke();
};

const drawHeart: Symbol = (ctx, cx, cy, r, palette) => {
  const s = r * 0.34;
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.95);
  ctx.bezierCurveTo(cx - s * 1.35, cy + s * 0.1, cx - s * 1.05, cy - s * 0.95, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 1.05, cy - s * 0.95, cx + s * 1.35, cy + s * 0.1, cx, cy + s * 0.95);
  ctx.closePath();
  ctx.fill();
};

const drawStar: Symbol = (ctx, cx, cy, r, palette) => {
  const outer = r * 0.4;
  const inner = outer * 0.42;
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
};

export interface MarkerStyle {
  id: MarkerStyleId;
  /** Draws the pin with its tip on (x, y). `progress` animates the drop-in. */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    palette: MarkerPalette,
    progress?: number
  ): void;
}

function makeMarker(id: MarkerStyleId, symbol: Symbol): MarkerStyle {
  return {
    id,
    draw(ctx, x, y, r, palette, progress = 1) {
      drawPin(ctx, x, y, r, palette, progress);
      withBody(ctx, x, y, r, progress, (cx, cy) => symbol(ctx, cx, cy, r, palette));
    },
  };
}

export const MARKERS: Record<MarkerStyleId, MarkerStyle> = {
  solid: makeMarker("solid", drawSolid),
  ring: makeMarker("ring", drawRing),
  heart: makeMarker("heart", drawHeart),
  star: makeMarker("star", drawStar),
};

/** Pin geometry exported so hit-testing can match what is drawn (body centre above the tip, in units of r). */
export const PIN_BODY = { radius: BODY_R, centerY: BODY_CY } as const;
