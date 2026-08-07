import type { MarkerStyleId } from "@gunari/core";

export interface MarkerPalette {
  marker: string;
  markerSymbol: string;
  light: boolean;
}

/**
 * Draw the pin silhouette — a classic teardrop with a pointer at the
 * bottom. Same function for every marker; only the inner symbol varies.
 *
 * (cx, cy) is the pin's CENTER (the teardrop body center). The pointer
 * tip extends to cy + r. The body is inscribed in a circle of radius r
 * centered at (cx, cy - r * 0.4) so the silhouette visually balances.
 */
export function drawPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  palette: MarkerPalette
): void {
  ctx.save();
  ctx.beginPath();
  // Teardrop body: a circle with a downward taper.
  const bodyCy = cy - r * 0.4;
  const bodyR = r * 0.7;
  // Pointer tip
  ctx.moveTo(cx, cy + r);
  // Left side: cubic bezier up to the top of the body circle.
  ctx.bezierCurveTo(cx - r * 0.8, cy - r * 0.2, cx - bodyR, bodyCy - bodyR * 0.5, cx - bodyR, bodyCy);
  // Top arc (left to right over the body circle).
  ctx.arc(cx, bodyCy, bodyR, Math.PI, 0, false);
  // Right side: cubic bezier back down to the pointer tip.
  ctx.bezierCurveTo(cx + bodyR, bodyCy - bodyR * 0.5, cx + r * 0.8, cy - r * 0.2, cx, cy + r);
  ctx.closePath();
  ctx.fillStyle = palette.marker;
  ctx.fill();
  ctx.restore();
}

function drawSolidSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void {
  const bodyCy = cy - r * 0.4;
  const bodyR = r * 0.7;
  ctx.save();
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  ctx.arc(cx, bodyCy, bodyR * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRingSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void {
  const bodyCy = cy - r * 0.4;
  const bodyR = r * 0.7;
  ctx.save();
  ctx.strokeStyle = palette.markerSymbol;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.arc(cx, bodyCy, bodyR * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHeartSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void {
  const bodyCy = cy - r * 0.4;
  const symR = r * 0.25;
  ctx.save();
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  ctx.moveTo(cx, bodyCy + symR * 0.6);
  ctx.bezierCurveTo(cx - symR, bodyCy - symR * 0.3, cx - symR, bodyCy - symR * 0.9, cx, bodyCy - symR * 0.4);
  ctx.bezierCurveTo(cx + symR, bodyCy - symR * 0.9, cx + symR, bodyCy - symR * 0.3, cx, bodyCy + symR * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStarSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void {
  const bodyCy = cy - r * 0.4;
  const outer = r * 0.32;
  const inner = outer * 0.4;
  ctx.save();
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = bodyCy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface MarkerStyle {
  id: MarkerStyleId;
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void;
}

function makeMarker(id: MarkerStyleId, symbol: typeof drawSolidSymbol): MarkerStyle {
  return {
    id,
    draw(ctx, cx, cy, r, palette) {
      drawPin(ctx, cx, cy, r, palette);
      symbol(ctx, cx, cy, r, palette);
    },
  };
}

export const MARKERS: Record<MarkerStyleId, MarkerStyle> = {
  solid: makeMarker("solid", drawSolidSymbol),
  ring: makeMarker("ring", drawRingSymbol),
  heart: makeMarker("heart", drawHeartSymbol),
  star: makeMarker("star", drawStarSymbol),
};