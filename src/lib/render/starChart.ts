import type { StarChartStyleId, ThemePalette, VisibleStar } from "../types";

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
    moon?: { x: number; y: number; phase: number }
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
  const r = baseR * (0.4 + brightness * 1.6);
  if (r <= 0) return;
  ctx.save();
  // Glow halo
  const glowR = soft ? r * 6 : r * 4;
  const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
  g.addColorStop(0, hexWithAlpha(color, soft ? 0.85 : 0.95));
  g.addColorStop(0.4, hexWithAlpha(color, 0.18 * brightness));
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
  if (brightness > 0.7 && !soft) {
    ctx.globalAlpha = 0.5 * brightness;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6;
    const spike = r * 3.5;
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
    render: (ctx, cx, cy, r, stars, palette, moon) => {
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
        drawStar(ctx, x, y, s.b, baseR, palette.star, false);
      }

      // Moon
      if (moon) {
        const mx = cx + (moon.x - 0.5) * 2 * r;
        const my = cy + (moon.y - 0.5) * 2 * r;
        drawMoon(ctx, mx, my, r * 0.036, moon.phase, palette);
      }
      ctx.restore();
    },
  },
  dreamscape: {
    id: "dreamscape",
    label: "Dreamscape",
    render: (ctx, cx, cy, r, stars, palette, moon) => {
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
        drawStar(ctx, x, y, s.b, baseR, palette.star, true);
      }

      if (moon) {
        const mx = cx + (moon.x - 0.5) * 2 * r;
        const my = cy + (moon.y - 0.5) * 2 * r;
        drawMoon(ctx, mx, my, r * 0.042, moon.phase, palette, true);
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
  soft = false
) {
  ctx.save();
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
  ctx.globalAlpha = 0.95;
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