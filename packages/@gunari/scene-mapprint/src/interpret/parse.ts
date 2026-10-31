import type { PlaceCategory } from "@gunari/core";
import type { BBox, Label, MapGeometry, Poi, Polygon, Road, RoadClass } from "./types";

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

const BUILT_LANDUSE = ["residential", "commercial", "retail", "industrial", "construction", "garages"];
const GREEN_LANDUSE = ["forest", "grass", "meadow", "recreation_ground", "village_green", "cemetery", "farmland", "orchard"];
const GREEN_NATURAL = ["wood", "scrub", "grassland", "wetland", "heath"];

const FOOD_AMENITY = ["restaurant", "cafe", "fast_food", "bar", "pub", "food_court", "ice_cream", "biergarten"];
const LANDMARK_TOURISM = ["attraction", "museum", "gallery", "artwork", "viewpoint", "zoo", "theme_park"];
const LODGING_TOURISM = ["hotel", "hostel", "guest_house", "motel", "apartment"];
const LANDMARK_AMENITY = ["theatre", "cinema", "marketplace"];
const COMMUNITY_AMENITY = [
  "school", "university", "college", "hospital", "clinic", "place_of_worship",
  "library", "townhall", "police", "fire_station", "bank",
];

/** Most places to keep per kind, so one busy kind (banks, shops) can't crowd out the others. */
const MAX_POIS_PER_CATEGORY = 150;
const POI_PRIORITY: PlaceCategory[] = ["landmarks", "lodging", "community", "food", "shops"];

function categorize(tags: Record<string, string>): PlaceCategory | null {
  if (!tags.name) return null;
  if (tags.historic) return "landmarks";
  if (tags.tourism) {
    if (LANDMARK_TOURISM.includes(tags.tourism)) return "landmarks";
    if (LODGING_TOURISM.includes(tags.tourism)) return "lodging";
  }
  if (tags.amenity) {
    if (FOOD_AMENITY.includes(tags.amenity)) return "food";
    if (LANDMARK_AMENITY.includes(tags.amenity)) return "landmarks";
    if (COMMUNITY_AMENITY.includes(tags.amenity)) return "community";
  }
  if (tags.shop) return "shops";
  return null;
}

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
  const built: Polygon[] = [];
  const green: Polygon[] = [];
  const labels: Label[] = [];
  const pois: Poi[] = [];

  for (const el of json.elements) {
    if (el.type === "node" && el.tags?.place && PLACE_CLASSES.includes(el.tags.place)) {
      // Keep the node's own lng/lat so projection can put the label where the place is.
      labels.push({ text: el.tags.name ?? "—", x: el.lon, y: el.lat, class: "place" });
      continue;
    }
    if (el.type === "node") {
      const category = categorize(el.tags ?? {});
      if (category) pois.push({ name: el.tags!.name, category, x: el.lon, y: el.lat });
      continue;
    }
    if (el.type !== "way" || !el.geometry) continue;
    const pts: [number, number][] = el.geometry.map((p) => [p.lon, p.lat]);
    const tags = el.tags ?? {};

    // A named building or area (a mall, a church, a museum): mark its centre.
    // Roads, water and land use are handled below and never become places.
    if (!tags.highway && !tags.waterway && !tags.natural && !tags.landuse && !tags.leisure) {
      const category = categorize(tags);
      if (category) {
        const n = pts.length;
        const cx = pts.reduce((sum, p) => sum + p[0], 0) / n;
        const cy = pts.reduce((sum, p) => sum + p[1], 0) / n;
        pois.push({ name: tags.name, category, x: cx, y: cy });
        continue;
      }
    }

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
    if (tags.landuse && BUILT_LANDUSE.includes(tags.landuse)) {
      built.push({ points: pts });
      continue;
    }
    if (
      (tags.landuse && GREEN_LANDUSE.includes(tags.landuse)) ||
      (tags.natural && GREEN_NATURAL.includes(tags.natural))
    ) {
      green.push({ points: pts });
      continue;
    }
  }

  sortRoadsByClass(roads);
  return { bbox, roads, water, waterways, parks, built, green, labels, pois: selectPois(pois) };
}

/** Draw order: motorways last, so they end up on top. */
export function sortRoadsByClass(roads: Road[]): void {
  roads.sort((a, b) => ROAD_CLASSES.indexOf(a.class) - ROAD_CLASSES.indexOf(b.class));
}

/** One place per name and kind, capped per kind, rarer kinds first. */
export function selectPois(pois: Poi[]): Poi[] {
  const seen = new Set<string>();
  const perKind = new Map<PlaceCategory, number>();
  return [...pois]
    .sort((a, b) => POI_PRIORITY.indexOf(a.category) - POI_PRIORITY.indexOf(b.category))
    .filter((p) => {
      const key = `${p.category}:${p.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const n = perKind.get(p.category) ?? 0;
      if (n >= MAX_POIS_PER_CATEGORY) return false;
      perKind.set(p.category, n + 1);
      return true;
    });
}