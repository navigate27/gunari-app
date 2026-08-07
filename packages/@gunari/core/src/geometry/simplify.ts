import simplify from "simplify-geometry";

/**
 * Douglas-Peucker simplification. `tolerance` is in the same units as the
 * input points (typically canvas-normalized [0,1] for Map Print).
 */
export function simplifyLine(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) return points;
  return simplify(points, tolerance);
}