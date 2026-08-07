import type { BBox } from "../interpret/types";
import type { ZoomId } from "@gunari/core";

const EQUATOR_LAT_DEG_PER_KM = 1 / 110.574;
const EQUATOR_LNG_DEG_PER_KM = 1 / 111.32;

export function zoomKmSpan(zoom: ZoomId): number {
  switch (zoom) {
    case "neighborhood": return 0.6;
    case "district": return 2;
    case "city": return 12;
  }
}

/**
 * Compute the bbox centered on (lat, lng) with the given zoom's km span.
 * Lng span widens with latitude (Mercator distortion).
 */
export function bboxForZoom(lat: number, lng: number, zoom: ZoomId): BBox {
  const km = zoomKmSpan(zoom);
  const halfLat = (km / 2) * EQUATOR_LAT_DEG_PER_KM;
  const halfLng = (km / 2) * EQUATOR_LNG_DEG_PER_KM / Math.max(Math.cos(lat * Math.PI / 180), 0.01);
  return [lng - halfLng, lat - halfLat, lng + halfLng, lat + halfLat];
}