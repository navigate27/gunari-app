/**
 * Trace a shape clip path on `ctx` and call `ctx.clip()`. The shape is
 * inscribed in a circle of radius `r` centered at (cx, cy).
 *
 * - square: axis-aligned bounding rect of the circle (so rotated scenes
 *   still fill the square corners — caller rotates first).
 * - circle: full circle.
 * - heart: classic two-bezier heart inscribed in the circle, pointing down.
 */
export function applyShapeMask(
  ctx: CanvasRenderingContext2D,
  shape: "square" | "circle" | "heart",
  cx: number,
  cy: number,
  r: number
): void {
  ctx.beginPath();
  if (shape === "square") {
    ctx.rect(cx - r, cy - r, r * 2, r * 2);
  } else if (shape === "circle") {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else {
    // Heart: classic geometry, pointing down (pin tip at cy + r).
    const top = cy - r * 0.6;
    const bottom = cy + r;
    const w = r * 0.9;
    ctx.moveTo(cx, bottom);
    ctx.bezierCurveTo(cx - w, cy + r * 0.2, cx - w, top - r * 0.3, cx, top);
    ctx.bezierCurveTo(cx + w, top - r * 0.3, cx + w, cy + r * 0.2, cx, bottom);
  }
  ctx.closePath();
  ctx.clip();
}