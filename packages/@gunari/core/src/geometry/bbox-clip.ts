import bboxClipLib from "@turf/bbox-clip";
import type { Feature, LineString, Polygon } from "geojson";

export type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

/**
 * Clip a polyline to a bbox using @turf/bbox-clip. Returns the clipped
 * coordinates. If the line is entirely outside the bbox, returns [].
 */
export function bboxClip(points: [number, number][], bbox: BBox): [number, number][] {
  if (points.length < 2) return points;
  const line: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points },
  };
  const clipped = bboxClipLib(line as unknown as Parameters<typeof bboxClipLib>[0], bbox);
  if (clipped.geometry.type === "LineString") {
    return clipped.geometry.coordinates as [number, number][];
  }
  if (clipped.geometry.type === "MultiLineString") {
    return clipped.geometry.coordinates.flat() as [number, number][];
  }
  return [];
}

/** Clip a polygon (with optional holes) to a bbox. */
export function bboxClipPolygon(
  polygon: [number, number][] | { outer: [number, number][]; holes?: [number, number][][] },
  bbox: BBox
): { outer: [number, number][]; holes: [number, number][][] } | null {
  const coords: [number, number][][] = Array.isArray(polygon)
    ? [polygon]
    : [polygon.outer, ...(polygon.holes ?? [])];
  const poly: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: coords },
  };
  const clipped = bboxClipLib(poly as unknown as Parameters<typeof bboxClipLib>[0], bbox);
  if (clipped.geometry.type === "Polygon" && clipped.geometry.coordinates.length > 0) {
    const [outer, ...holes] = clipped.geometry.coordinates as [number, number][][];
    return { outer, holes };
  }
  if (clipped.geometry.type === "MultiPolygon" && clipped.geometry.coordinates.length > 0) {
    const [first, ...rest] = clipped.geometry.coordinates[0] as [number, number][][];
    void rest;
    return { outer: first, holes: [] };
  }
  return null;
}