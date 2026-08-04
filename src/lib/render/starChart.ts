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

      // Stars — monochrome (palette star color), no B-V tinting
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

      // Stars — larger halos, no diffraction spikes, monochrome
      const baseR = palette.light ? 1.6 : 2.1;
      for (const s of stars) {
        const x = cx + (s.x - 0.5) * 2 * r;
        const y = cy + (s.y - 0.5) * 2 * r;
        drawStar(ctx, x, y, s.b, baseR, palette.star, true);
      }

      if (moon) {
        const mx = cx + (moon.x - 0.5) * 2 * r;
        const my = cy + (moon.y - 0.5) * 2 * r;
        drawMoon(ctx, mx, my, r * 0.042, moon.phase, palette, true, moonOpacity);
      }
      ctx.restore();
    },
  },
  nebula: {
    id: "nebula",
    label: "Nebula",
    render: (ctx, cx, cy, r, stars, palette, moon, moonOpacity) => {
      ctx.save();
      clipCircle(ctx, cx, cy, r);

      // Deep chart surface
      const grad = ctx.createRadialGradient(
        cx,
        cy,
        r * 0.05,
        cx,
        cy,
        r
      );
      grad.addColorStop(0, palette.chart.center);
      grad.addColorStop(1, palette.chart.edge);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Nebula color clouds — soft radial blobs in screen blend so they
      // glow without occluding the stars drawn on top.
      const clouds: Array<[number, number, number, string]> = [
        [-0.25, -0.15, 0.55, "rgba(255,120,180,0.35)"],
        [0.3, 0.1, 0.5, "rgba(120,200,255,0.30)"],
        [0.05, 0.35, 0.4, "rgba(180,140,255,0.28)"],
      ];
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const [ox, oy, sz, color] of clouds) {
        const gx = cx + ox * r;
        const gy = cy + oy * r;
        const gr = r * sz;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, color);
        g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      ctx.restore();

      // Stars — astronomical-style on top of the nebula
      const baseR = palette.light ? 1.3 : 1.8;
      for (const s of stars) {
        const x = cx + (s.x - 0.5) * 2 * r;
        const y = cy + (s.y - 0.5) * 2 * r;
        drawStar(ctx, x, y, s.b, baseR, starColor(s, palette), false);
      }

      if (moon) {
        const mx = cx + (moon.x - 0.5) * 2 * r;
        const my = cy + (moon.y - 0.5) * 2 * r;
        drawMoon(ctx, mx, my, r * 0.036, moon.phase, palette, false, moonOpacity);
      }
      ctx.restore();
    },
  },
  galactic: {
    id: "galactic",
    label: "Galactic",
    render: (ctx, cx, cy, r, stars, palette, moon, moonOpacity) => {
      ctx.save();
      clipCircle(ctx, cx, cy, r);

      // Chart surface
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

      // Milky Way band — a soft diagonal dust cloud across the chart.
      // Use a thin rotated linear gradient + mottled radial blobs.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI * 0.22);
      const bandG = ctx.createLinearGradient(0, -r * 0.18, 0, r * 0.18);
      bandG.addColorStop(0, hexWithAlpha(palette.star, 0));
      bandG.addColorStop(0.5, hexWithAlpha(palette.star, 0.10));
      bandG.addColorStop(1, hexWithAlpha(palette.star, 0));
      ctx.fillStyle = bandG;
      ctx.fillRect(-r * 1.2, -r * 0.18, r * 2.4, r * 0.36);
      // Mottled blobs along the band for texture
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const bx = -r * 1.0 + t * r * 2.0;
        const by = (Math.sin(i * 1.7) * 0.06) * r;
        const br = r * (0.18 + 0.1 * Math.cos(i * 2.3));
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        bg.addColorStop(0, hexWithAlpha(palette.star, 0.08));
        bg.addColorStop(1, hexWithAlpha(palette.star, 0));
        ctx.fillStyle = bg;
        ctx.fillRect(bx - br, by - br, br * 2, br * 2);
      }
      ctx.restore();

      // Dense faint procedural stars along the band (deterministic seed)
      const seedRand = mulberry32(12345);
      ctx.fillStyle = palette.star;
      for (let i = 0; i < 320; i++) {
        const t = seedRand();
        const bx = (t - 0.5) * 2.2;
        const bandY = (seedRand() - 0.5) * 0.34;
        // Rotate band point by -0.22π to match the visual band
        const rot = -Math.PI * 0.22;
        const rx = bx * Math.cos(rot) - bandY * Math.sin(rot);
        const ry = bx * Math.sin(rot) + bandY * Math.cos(rot);
        // Keep inside the circle
        if (rx * rx + ry * ry > 0.92) continue;
        const x = cx + rx * r;
        const y = cy + ry * r;
        const rad = 0.3 + seedRand() * 0.7;
        ctx.globalAlpha = 0.25 + seedRand() * 0.4;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Catalog stars on top
      const baseR = palette.light ? 1.3 : 1.8;
      for (const s of stars) {
        const x = cx + (s.x - 0.5) * 2 * r;
        const y = cy + (s.y - 0.5) * 2 * r;
        drawStar(ctx, x, y, s.b, baseR, starColor(s, palette), false);
      }

      if (moon) {
        const mx = cx + (moon.x - 0.5) * 2 * r;
        const my = cy + (moon.y - 0.5) * 2 * r;
        drawMoon(ctx, mx, my, r * 0.036, moon.phase, palette, false, moonOpacity);
      }
      ctx.restore();
    },
  },
};

/** Deterministic PRNG so the procedural galactic field is stable between frames. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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