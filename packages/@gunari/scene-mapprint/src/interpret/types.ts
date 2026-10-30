import type { PlaceCategory } from "@gunari/core";

export type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

export type RoadClass =
  | "motorway" | "trunk" | "primary" | "secondary"
  | "tertiary" | "residential" | "path";

export interface Road {
  class: RoadClass;
  /** Canvas-normalized [0, 1] coords (set by projection; empty here for parse-time). */
  points: [number, number][];
  /** Original OSM way id, for label association. */
  osmId?: number;
  /** Optional road name (becomes a Label at render time when labels=true). */
  name?: string;
}

export interface Polygon {
  points: [number, number][];
  holes?: [number, number][][];
  name?: string;
}

/** A named place (shop, cafe, landmark...). x/y are lng/lat at parse time, canvas-normalized after projection. */
export interface Poi {
  name: string;
  category: PlaceCategory;
  x: number;
  y: number;
}

export interface Label {
  text: string;
  x: number;
  y: number;
  class: "road" | "place";
}

/**
 * The internal geometry model — the boundary between "OSM data" and
 * "Gunari's render input". The renderer never sees OSM tags or raw lat/lng.
 */
export interface MapGeometry {
  bbox: BBox;
  roads: Road[];
  water: Polygon[];
  waterways: [number, number][][];
  parks: Polygon[];
  /** Built-up land (residential, commercial, industrial). Absent in entries cached before this layer existed. */
  built?: Polygon[];
  /** Woods, grass, farmland and other green land that isn't a park. */
  green?: Polygon[];
  labels: Label[];
  /** Named places. Absent in entries cached before places existed; empty when not fetched (city zoom). */
  pois?: Poi[];
}