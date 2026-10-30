import { FORMATS, type SceneViewport, type ZoomId } from "@gunari/core";
import { zoomKmSpan } from "./viewport";

const KM_PER_LAT_DEG = 110.574;
const KM_PER_LNG_DEG_AT_EQUATOR = 111.32;

/**
 * Convert a drag of the map content (canvas-normalized, screen space) into
 * the location the map should be centred on afterwards. Dragging the content
 * right/down shows more to the west/north, and the drag is un-rotated first so
 * it follows the screen when the map is rotated.
 */
export function panLocation(
  location: { lat: number; lng: number },
  zoom: ZoomId,
  viewport: SceneViewport,
  rotation: number,
  panX: number,
  panY: number,
): { lat: number; lng: number } {
  const w = viewport.canvasW ?? FORMATS.story.w;
  const h = viewport.canvasH ?? FORMATS.story.h;
  const side = 2 * viewport.r * Math.min(w, h) * Math.SQRT2;
  const kmPerPx = zoomKmSpan(zoom) / side;

  const sx = panX * w;
  const sy = panY * h;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const gx = sx * cos + sy * sin;
  const gy = -sx * sin + sy * cos;

  const eastKm = -gx * kmPerPx;
  const northKm = gy * kmPerPx;
  const lat = location.lat + northKm / KM_PER_LAT_DEG;
  const lng =
    location.lng +
    eastKm / (KM_PER_LNG_DEG_AT_EQUATOR * Math.max(Math.cos((location.lat * Math.PI) / 180), 0.01));
  return { lat, lng };
}
