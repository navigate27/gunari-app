import {
  FORMATS,
  inverseWebMercator,
  normalizeToViewport,
  webMercator,
  type SceneViewport,
} from "@gunari/core";
import type { BBox } from "../interpret/types";

/**
 * How the geographic bbox sits on the canvas. The bbox lands on a square
 * (the same scale on both axes, so the map is never stretched) centred on the
 * slot and sized to still cover the slot when rotated by any angle.
 */
export interface Frame {
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** Side of the bbox square, in canvas pixels. */
  side: number;
  rotation: number;
  panX: number;
  panY: number;
}

export function makeFrame(viewport: SceneViewport, rotation: number): Frame {
  const w = viewport.canvasW ?? FORMATS.story.w;
  const h = viewport.canvasH ?? FORMATS.story.h;
  return {
    w,
    h,
    cx: viewport.cx,
    cy: viewport.cy,
    side: 2 * viewport.r * Math.min(w, h) * Math.SQRT2,
    rotation,
    panX: viewport.panX ?? 0,
    panY: viewport.panY ?? 0,
  };
}

/** bbox-normalised [0,1] point (y already flipped) → canvas-normalised, unrotated. */
export function place(f: Frame, [nx, ny]: [number, number]): [number, number] {
  return [f.cx + ((nx - 0.5) * f.side) / f.w, f.cy + ((ny - 0.5) * f.side) / f.h];
}

/** Rotate canvas-normalised points about the slot centre, in pixel space so non-square canvases don't shear. */
export function rotateAround(f: Frame, pts: [number, number][], angle: number): [number, number][] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return pts.map(([x, y]) => {
    const dx = (x - f.cx) * f.w;
    const dy = (y - f.cy) * f.h;
    return [f.cx + (dx * cos - dy * sin) / f.w, f.cy + (dx * sin + dy * cos) / f.h];
  });
}

/** Where a lat/lng lands on the canvas (canvas-normalised), including rotation and pan. */
export function projectLatLng(
  bbox: BBox,
  viewport: SceneViewport,
  rotation: number,
  lat: number,
  lng: number,
): [number, number] {
  const f = makeFrame(viewport, rotation);
  const { x, y } = webMercator(lat, lng);
  const [nx, ny] = normalizeToViewport(x, y, bbox);
  const placed = place(f, [nx, 1 - ny]);
  const [rx, ry] = rotation !== 0 ? rotateAround(f, [placed], rotation)[0] : placed;
  return [rx + f.panX, ry + f.panY];
}

/** Inverse of {@link projectLatLng}: a canvas-normalised point back to lat/lng. */
export function unprojectCanvas(
  bbox: BBox,
  viewport: SceneViewport,
  rotation: number,
  [px, py]: [number, number],
): { lat: number; lng: number } {
  const f = makeFrame(viewport, rotation);
  let p: [number, number] = [px - f.panX, py - f.panY];
  if (rotation !== 0) p = rotateAround(f, [p], -rotation)[0];
  const nx = (p[0] - f.cx) * (f.w / f.side) + 0.5;
  const ny = 1 - ((p[1] - f.cy) * (f.h / f.side) + 0.5);
  const min = webMercator(bbox[1], bbox[0]);
  const max = webMercator(bbox[3], bbox[2]);
  return inverseWebMercator(min.x + nx * (max.x - min.x), min.y + ny * (max.y - min.y));
}
