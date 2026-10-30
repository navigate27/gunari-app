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

/**
 * Diameter of the map slot, in km, when the data for `zoom` is shown at its
 * natural size (the bbox square is sqrt(2) times the slot so rotation stays covered).
 */
export function naturalViewKm(zoom: ZoomId): number {
  return zoomKmSpan(zoom) / Math.SQRT2;
}

/** Smallest and largest slot diameter the zoom control allows. */
export const VIEW_KM_MIN = 0.25;
export const VIEW_KM_MAX = 8.4;

export function clampViewKm(km: number): number {
  return Math.min(VIEW_KM_MAX, Math.max(VIEW_KM_MIN, km));
}

/** The data tier to load so the slot is still fully covered at this view size. */
export function tierForViewKm(km: number): ZoomId {
  if (km <= naturalViewKm("neighborhood")) return "neighborhood";
  if (km <= naturalViewKm("district")) return "district";
  return "city";
}

/** How much to enlarge the loaded data so the slot shows `viewKm`. Always >= 1 for the tier tierForViewKm picks. */
export function zoomScaleFor(zoom: ZoomId, viewKm: number): number {
  return naturalViewKm(zoom) / viewKm;
}

/** Zoom slider position (0 = zoomed out, 1 = zoomed in) on a log scale. */
export function sliderFromViewKm(km: number): number {
  return Math.log(VIEW_KM_MAX / clampViewKm(km)) / Math.log(VIEW_KM_MAX / VIEW_KM_MIN);
}

export function viewKmFromSlider(t: number): number {
  return VIEW_KM_MAX * Math.pow(VIEW_KM_MIN / VIEW_KM_MAX, Math.min(1, Math.max(0, t)));
}
