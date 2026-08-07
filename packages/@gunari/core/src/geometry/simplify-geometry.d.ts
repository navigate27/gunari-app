declare module "simplify-geometry" {
  /**
   * Ramer-Douglas-Peucker simplification of a polyline.
   * @param points array of [x, y] pairs
   * @param tolerance perpendicular distance tolerance (same units as points)
   * @returns simplified array of [x, y] pairs (preserves first and last)
   */
  function simplify(points: [number, number][], tolerance: number): [number, number][];
  export default simplify;
}