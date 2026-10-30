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

type Painter = (ctx: CanvasRenderingContext2D, r: number, palette: MarkerPalette) => void;

/**
 * A marker silhouette. Coordinates are in units of r with the anchor (the
 * spot on the ground) at the origin and the body rising above it (negative y).
 */
interface Shape {
  /** Trace the silhouette (begin the path, no fill). */
  trace: (ctx: CanvasRenderingContext2D, r: number) => void;
  /** Draw the detail on top of the filled body. */
  symbol?: Painter;
  /** Where the body is, for hit-testing: its centre and radius. */
  hit: { centerY: number; radius: number };
  /** Top of the body, for the gradient. */
  top: number;
  /** Ground shadow: half-width and vertical offset. */
  shadow: { rx: number; y: number };
  /** Soft halo drawn behind the body, as a multiple of r. */
  halo?: number;
}

const PIN_R = 0.75;
const PIN_CY = -1.55;

const pin: Shape = {
  trace(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-0.12 * r, -0.55 * r, -PIN_R * r, -0.95 * r, -PIN_R * r, PIN_CY * r);
    ctx.arc(0, PIN_CY * r, PIN_R * r, Math.PI, 0, false);
    ctx.bezierCurveTo(PIN_R * r, -0.95 * r, 0.12 * r, -0.55 * r, 0, 0);
    ctx.closePath();
  },
  symbol(ctx, r, palette) {
    ctx.fillStyle = palette.markerSymbol;
    ctx.beginPath();
    ctx.arc(0, PIN_CY * r, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },
  hit: { centerY: PIN_CY, radius: PIN_R },
  top: -2.3,
  shadow: { rx: 0.7, y: 0 },
};

/** A target: a disc with a ring and dot, centred on the spot rather than pointing at it. */
const ring: Shape = {
  trace(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.closePath();
  },
  symbol(ctx, r, palette) {
    ctx.strokeStyle = palette.markerSymbol;
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = palette.markerSymbol;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  },
  hit: { centerY: 0, radius: 0.9 },
  top: -0.8,
  shadow: { rx: 0.8, y: 0.62 },
  halo: 1.5,
};

/** The whole pin is a heart, pointing down at the spot. */
const heart: Shape = {
  trace(ctx, r) {
    const s = r * 1.05;
    const X = (u: number) => u * s;
    const Y = (v: number) => (v - 0.92) * s;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0.92));
    ctx.bezierCurveTo(X(-0.25), Y(0.7), X(-1), Y(0.2), X(-1), Y(-0.28));
    ctx.bezierCurveTo(X(-1), Y(-0.7), X(-0.65), Y(-0.92), X(-0.35), Y(-0.92));
    ctx.bezierCurveTo(X(-0.15), Y(-0.92), X(-0.02), Y(-0.8), X(0), Y(-0.6));
    ctx.bezierCurveTo(X(0.02), Y(-0.8), X(0.15), Y(-0.92), X(0.35), Y(-0.92));
    ctx.bezierCurveTo(X(0.65), Y(-0.92), X(1), Y(-0.7), X(1), Y(-0.28));
    ctx.bezierCurveTo(X(1), Y(0.2), X(0.25), Y(0.7), X(0), Y(0.92));
    ctx.closePath();
  },
  hit: { centerY: -1.1, radius: 1.0 },
  top: -1.95,
  shadow: { rx: 0.6, y: 0 },
};

/** A five-point star on a short stem. */
const star: Shape = {
  trace(ctx, r) {
    const cy = -1.35 * r;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const radius = (i % 2 === 0 ? 1.0 : 0.46) * r;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    // The stem down to the spot. Same winding as the star (clockwise on screen):
    // with the opposite winding the two overlap and cancel, cutting a hole in the star.
    ctx.moveTo(-0.2 * r, -0.95 * r);
    ctx.lineTo(0.2 * r, -0.95 * r);
    ctx.lineTo(0, 0);
    ctx.closePath();
  },
  hit: { centerY: -1.3, radius: 1.0 },
  top: -2.35,
  shadow: { rx: 0.5, y: 0 },
};

/** A little house standing on the spot. */
const home: Shape = {
  trace(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(-0.85 * r, 0);
    ctx.lineTo(-0.85 * r, -1.05 * r);
    ctx.lineTo(0, -1.95 * r);
    ctx.lineTo(0.85 * r, -1.05 * r);
    ctx.lineTo(0.85 * r, 0);
    ctx.closePath();
  },
  symbol(ctx, r, palette) {
    ctx.fillStyle = palette.markerSymbol;
    ctx.beginPath();
    ctx.moveTo(-0.24 * r, 0);
    ctx.lineTo(-0.24 * r, -0.75 * r);
    ctx.quadraticCurveTo(0, -0.95 * r, 0.24 * r, -0.75 * r);
    ctx.lineTo(0.24 * r, 0);
    ctx.closePath();
    ctx.fill();
  },
  hit: { centerY: -1.0, radius: 1.0 },
  top: -1.95,
  shadow: { rx: 0.95, y: 0 },
};

const SHAPES: Record<MarkerStyleId, Shape> = {
  solid: pin,
  ring,
  heart,
  star,
  home,
};

/** Body circle of each marker (centre height above the anchor and radius, in units of r), for hit-testing. */
export const MARKER_HIT: Record<MarkerStyleId, { centerY: number; radius: number }> = {
  solid: pin.hit,
  ring: ring.hit,
  heart: heart.hit,
  star: star.hit,
  home: home.hit,
};

function drawBody(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  x: number,
  y: number,
  r: number,
  palette: MarkerPalette,
  progress: number,
  withSymbol: boolean
): void {
  const t = clamp01(progress);
  if (t <= 0) return;
  const lift = (1 - easeOutBounce(t)) * r * 5;

  // Ground shadow, tightening as the marker lands.
  ctx.save();
  ctx.translate(x, y + shape.shadow.y * r);
  ctx.scale(1, 0.32);
  const sr = r * shape.shadow.rx * (0.45 + 0.55 * t);
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

  if (shape.halo) {
    ctx.fillStyle = palette.marker;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, r * shape.halo, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = prev;
  }

  const grad = ctx.createLinearGradient(0, shape.top * r, 0, 0);
  grad.addColorStop(0, shade(palette.marker, 0.22));
  grad.addColorStop(0.55, palette.marker);
  grad.addColorStop(1, shade(palette.marker, -0.14));

  shape.trace(ctx, r);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = r * 0.35;
  ctx.shadowOffsetY = r * 0.12;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Specular highlight: a soft light from the upper left, kept inside the body.
  ctx.save();
  ctx.clip();
  const hx = -shape.hit.radius * 0.35 * r;
  const hy = (shape.hit.centerY - shape.hit.radius * 0.4) * r;
  const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, shape.hit.radius * r * 1.1);
  hl.addColorStop(0, "rgba(255,255,255,0.4)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  ctx.fillRect(-2.5 * r, -3 * r, 5 * r, 4 * r);
  ctx.restore();

  if (withSymbol) shape.symbol?.(ctx, r, palette);
  ctx.restore();
}

/** The classic teardrop pin, without its symbol. Kept for callers that only want the silhouette. */
export function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  palette: MarkerPalette,
  progress = 1
): void {
  drawBody(ctx, pin, x, y, r, palette, progress, false);
}

export interface MarkerStyle {
  id: MarkerStyleId;
  /** Draws the marker anchored on (x, y). `progress` animates the drop-in. */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    palette: MarkerPalette,
    progress?: number
  ): void;
}

function makeMarker(id: MarkerStyleId): MarkerStyle {
  return {
    id,
    draw(ctx, x, y, r, palette, progress = 1) {
      drawBody(ctx, SHAPES[id], x, y, r, palette, progress, true);
    },
  };
}

export const MARKERS: Record<MarkerStyleId, MarkerStyle> = {
  solid: makeMarker("solid"),
  ring: makeMarker("ring"),
  heart: makeMarker("heart"),
  star: makeMarker("star"),
  home: makeMarker("home"),
};
