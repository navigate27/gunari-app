import type { BBox } from "./bbox-clip";

const R = 6378137; // Earth radius (WGS84 semi-major axis, meters)
const DEG = Math.PI / 180;

/**
 * Project (lat, lng) to Web Mercator meters (EPSG:3857).
 * x = R * lng_rad; y = R * ln(tan(π/4 + lat_rad/2)).
 */
export function webMercator(lat: number, lng: number): { x: number; y: number } {
  const x = R * lng * DEG;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
  return { x, y };
}

/**
 * Normalize projected meters to [0, 1] against a bbox.
 * Returns [x, y] where (0,0) is the minLng/minLat corner and (1,1) is
 * maxLng/maxLat. Y is NOT flipped here — callers flip if they need
 * canvas-down y.
 */
export function normalizeToViewport(
  xMeters: number,
  yMeters: number,
  bbox: BBox
): [number, number] {
  const { x: minX, y: minY } = webMercator(bbox[1], bbox[0]);
  const { x: maxX, y: maxY } = webMercator(bbox[3], bbox[2]);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const x = (xMeters - minX) / w;
  const y = (yMeters - minY) / h;
  return [x, y];
}