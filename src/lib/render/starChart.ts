import type { StarChartStyleId, ThemePalette, VisibleStar } from "../types";

/**
 * Map a B-V color index to an RGB string.
 *
 *   B-V < 0.0   → Blue   (hot O/B stars)
 *   B-V 0.0-0.4 → White  (A/F stars, blue-white to white)
 *   B-V 0.4-0.8 → Yellow (G stars, like the Sun)
 *   B-V 0.8-1.4 → Orange (K stars)
 *   B-V > 1.4   → Red    (M stars)
 */
const BV_STOPS: Array<[number, [number, number, number]]> = [
  [-0.4, [155, 176, 255]], // hot blue
  [-0.1, [180, 200, 255]], // blue-white
  [0.15, [220, 230, 255]], // white-blue
  [0.45, [255, 255, 245]], // white
  [0.7, [255, 245, 210]],  // yellow-white
  [1.0, [255, 225, 170]],  // yellow-orange
  [1.3, [255, 195, 140]],  // orange
  [1.6, [255, 165, 120]],  // red-orange
  [2.0, [255, 130, 100]],  // red
];

function bvToRgb(bv: number): [number, number, number] {
  if (bv <= BV_STOPS[0][0]) return BV_STOPS[0][1];
  if (bv >= BV_STOPS[BV_STOPS.length - 1][0])
    return BV_STOPS[BV_STOPS.length - 1][1];
  for (let i = 0; i < BV_STOPS.length - 1; i++) {
    const [t0, c0] = BV_STOPS[i];
    const [t1, c1] = BV_STOPS[i + 1];
    if (bv >= t0 && bv <= t1) {
      const f = (bv - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return BV_STOPS[BV_STOPS.length - 1][1];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Compute the render color for a star. If the star has a B-V index, map it
 * to a stellar color. For light-theme palettes (Ivory, Blank) the color is
 * darkened so stars remain visible on a light background. Falls back to the
 * palette's star color when B-V is missing.
 */
function starColor(
  star: { bv?: number },
  palette: ThemePalette
): string {
  if (star.bv == null) return palette.star;
  const rgb = bvToRgb(star.bv);
  if (palette.light) {
    // Darken to ~35% so colored stars read against a light canvas.
    return rgbToHex([
      Math.round(rgb[0] * 0.35),
      Math.round(rgb[1] * 0.35),
      Math.round(rgb[2] * 0.35),
    ]);
  }
  return rgbToHex(rgb);
}

export interface StarChartStyle {
  id: StarChartStyleId;
  label: string;
  render: (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    stars: VisibleStar[],
    palette: ThemePalette,
    moon?: { x: number; y: number; phase: number },
    moonOpacity?: number
  ) => void;
}

const HIP_BAYER_NAMES: Record<number, string> = {};

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brightness: number,
  baseR: number,
  color: string,
  soft: boolean
) {
  const r = baseR * (0.3 + brightness * 3.0);
  if (r <= 0) return;
  ctx.save();
  // Glow halo
  const glowR = soft ? r * 6 : r * 4.5;
  const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
  g.addColorStop(0, hexWithAlpha(color, soft ? 0.85 : 0.95));
  g.addColorStop(0.4, hexWithAlpha(color, 0.22 * brightness));
  g.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7 + brightness * 0.3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Cross diffraction spike for bright stars
  if (brightness > 0.6 && !soft) {
    ctx.globalAlpha = 0.55 * brightness;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    const spike = r * 5;
    ctx.beginPath();
    ctx.moveTo(x - spike, y);
    ctx.lineTo(x + spike, y);
    ctx.moveTo(x, y - spike);
    ctx.lineTo(x, y + spike);
    ctx.stroke();
  }
  ctx.restore();
}

function hexWithAlpha(hex: string, alpha: number): string {
  // Accept #rrggbb or already-rgba; fallback to rgba with the alpha.
  if (hex.startsWith("rgba") || hex.startsWith("rgb(")) return hex;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clipCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
}

export const STAR_CHART_STYLES: Record<StarChartStyleId, StarChartStyle> = {
  astronomical: {
    id: "astronomical",
    label: "Astronomical",
    render: (ctx, cx, cy, r, stars, palette, moon, moonOpacity) => {
      ctx.save();
      clipCircle(ctx, cx, cy, r);

      // Chart surface gradient (the circular star-chart background)
      const grad = ctx.createRadialGradient(
        cx,
        cy - r * 0.1,
        r * 0.05,
        cx,
        cy,
        r
      );
      grad.addColorStop(0, palette.chart.center);
      grad.addColorStop(1, palette.chart.edge);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Subtle horizon haze ring
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = hexWithAlpha(palette.star, 0.08);
      ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Stars
      const baseR = palette.light ? 1.3 : 1.8;
      for (const s of stars) {
        const x = cx + (s.x - 0.5) * 2 * r;
        const y = cy + (s.y - 0.5) * 2 * r;
        drawStar(ctx, x, y, s.b, baseR, starColor(s, palette), false);
      }

      // Moon
      if (moon) {
        const mx = cx + (moon.x - 0.5) * 2 * r;
        const my = cy + (moon.y - 0.5) * 2 * r;
        drawMoon(ctx, mx, my, r * 0.036, moon.phase, palette, false, moonOpacity);
      }
      ctx.restore();
    },
  },
  dreamscape: {
    id: "dreamscape",
    label: "Dreamscape",
    render: (ctx, cx, cy, r, stars, palette, moon, moonOpacity) => {
      ctx.save();
      clipCircle(ctx, cx, cy, r);

      // Softer, warmer chart surface
      const grad = ctx.createRadialGradient(
        cx,
        cy - r * 0.15,
        r * 0.1,
        cx,
        cy,
        r
      );
      grad.addColorStop(0, palette.chart.center);
      grad.addColorStop(0.6, palette.chart.center);
      grad.addColorStop(1, palette.chart.edge);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Soft inner glow
      const inner = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        r * 0.6
      );
      inner.addColorStop(0, hexWithAlpha(palette.star, 0.06));
      inner.addColorStop(1, hexWithAlpha(palette.star, 0));
      ctx.fillStyle = inner;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Stars — larger halos, no diffraction spikes
      const baseR = palette.light ? 1.6 : 2.1;
      for (const s of stars) {
        const x = cx + (s.x - 0.5) * 2 * r;
        const y = cy + (s.y - 0.5) * 2 * r;
        drawStar(ctx, x, y, s.b, baseR, starColor(s, palette), true);
      }

      if (moon) {
        const mx = cx + (moon.x - 0.5) * 2 * r;
        const my = cy + (moon.y - 0.5) * 2 * r;
        drawMoon(ctx, mx, my, r * 0.042, moon.phase, palette, true, moonOpacity);
      }
      ctx.restore();
    },
  },
};

function drawMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  phase: number,
  palette: ThemePalette,
  soft = false,
  opacity: number = 1
) {
  if (opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  // Glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * (soft ? 6 : 4));
  glow.addColorStop(0, hexWithAlpha(palette.star, 0.4));
  glow.addColorStop(1, hexWithAlpha(palette.star, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * (soft ? 6 : 4), 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = palette.star;
  ctx.globalAlpha = 0.95 * opacity;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Shadow crescent
  const phaseAngle = phase * Math.PI * 2;
  const offset = Math.cos(phaseAngle) * r;
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(x + offset, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function getStarChartStyle(id: StarChartStyleId): StarChartStyle {
  return STAR_CHART_STYLES[id];
}