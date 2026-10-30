/**
 * Trace a shape clip path on `ctx` and call `ctx.clip()`. The shape is
 * inscribed in a circle of radius `r` centered at (cx, cy).
 *
 * - square: axis-aligned bounding rect of the circle (so rotated scenes
 *   still fill the square corners — caller rotates first).
 * - circle: full circle.
 * - heart: two-lobed heart filling the circle's width, pointing down.
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
    // Heart: two lobes with a cleft, a rounded body and a tip pointing down.
    // Drawn in a unit box (x, y in [-1, 1], y down) and scaled by r, so the
    // widest point spans the full diameter and the shape is vertically centred.
    const X = (u: number) => cx + u * r;
    const Y = (v: number) => cy + v * r;
    ctx.moveTo(X(0), Y(0.92));
    ctx.bezierCurveTo(X(-0.25), Y(0.7), X(-1), Y(0.2), X(-1), Y(-0.28));
    ctx.bezierCurveTo(X(-1), Y(-0.7), X(-0.65), Y(-0.92), X(-0.35), Y(-0.92));
    ctx.bezierCurveTo(X(-0.15), Y(-0.92), X(-0.02), Y(-0.8), X(0), Y(-0.6));
    ctx.bezierCurveTo(X(0.02), Y(-0.8), X(0.15), Y(-0.92), X(0.35), Y(-0.92));
    ctx.bezierCurveTo(X(0.65), Y(-0.92), X(1), Y(-0.7), X(1), Y(-0.28));
    ctx.bezierCurveTo(X(1), Y(0.2), X(0.25), Y(0.7), X(0), Y(0.92));
  }
  ctx.closePath();
  ctx.clip();
}