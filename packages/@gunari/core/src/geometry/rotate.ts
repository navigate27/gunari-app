/**
 * Rotate points around (cx, cy) by thetaRad. Returns a new array.
 */
export function rotatePoints(
  points: [number, number][],
  cx: number,
  cy: number,
  thetaRad: number
): [number, number][] {
  const cos = Math.cos(thetaRad);
  const sin = Math.sin(thetaRad);
  const out: [number, number][] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    const dx = x - cx;
    const dy = y - cy;
    out[i] = [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  }
  return out;
}