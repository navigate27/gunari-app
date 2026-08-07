import type { BBox, Label, MapGeometry, Polygon, Road, RoadClass } from "./types";

export interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}
export interface OsmWay {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  nodes?: number[];
}
export interface OsmRelation {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
}
export type OsmElement = OsmNode | OsmWay | OsmRelation;
export interface OsmResponse {
  version?: number;
  generator?: string;
  elements: OsmElement[];
}

const HIGHWAY_CLASS_MAP: Record<string, RoadClass> = {
  motorway: "motorway",
  motorway_link: "motorway",
  trunk: "trunk",
  trunk_link: "trunk",
  primary: "primary",
  primary_link: "primary",
  secondary: "secondary",
  secondary_link: "secondary",
  tertiary: "tertiary",
  tertiary_link: "tertiary",
  unclassified: "tertiary",
  residential: "residential",
  living_street: "residential",
  path: "path",
  footway: "path",
  cycleway: "path",
};

const ROAD_CLASSES: RoadClass[] = [
  "motorway", "trunk", "primary", "secondary", "tertiary", "residential", "path",
];

const PLACE_CLASSES = ["city", "town", "village", "hamlet", "suburb", "neighbourhood"];

/**
 * Parse an OSM `out:geom` JSON response into a MapGeometry. Points stay in
 * raw (lng, lat) order — projection to canvas [0,1] happens later.
 */
export function parseOsm(json: OsmResponse, bbox: BBox): MapGeometry {
  const roads: Road[] = [];
  const water: Polygon[] = [];
  const waterways: [number, number][][] = [];
  const parks: Polygon[] = [];
  const labels: Label[] = [];

  for (const el of json.elements) {
    if (el.type === "node" && el.tags?.place && PLACE_CLASSES.includes(el.tags.place)) {
      labels.push({ text: el.tags.name ?? "—", x: 0, y: 0, class: "place" });
      continue;
    }
    if (el.type !== "way" || !el.geometry) continue;
    const pts: [number, number][] = el.geometry.map((p) => [p.lon, p.lat]);
    const tags = el.tags ?? {};

    if (tags.highway && tags.highway in HIGHWAY_CLASS_MAP) {
      roads.push({
        class: HIGHWAY_CLASS_MAP[tags.highway],
        points: pts,
        osmId: el.id,
        name: tags.name,
      });
      continue;
    }
    if (tags.waterway) {
      waterways.push(pts);
      if (tags.name) labels.push({ text: tags.name, x: 0, y: 0, class: "road" });
      continue;
    }
    if (tags.natural === "water") {
      water.push({ points: pts, name: tags.name });
      continue;
    }
    if (tags.leisure === "park" || tags.leisure === "garden" || tags.boundary === "protected_area") {
      parks.push({ points: pts, name: tags.name });
      continue;
    }
  }

  // Sort roads by class so the renderer draws motorways last (on top).
  roads.sort((a, b) => ROAD_CLASSES.indexOf(a.class) - ROAD_CLASSES.indexOf(b.class));

  return { bbox, roads, water, waterways, parks, labels };
}