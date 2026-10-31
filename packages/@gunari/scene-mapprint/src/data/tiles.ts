import { VectorTile, classifyRings } from "@mapbox/vector-tile";
import type { PlaceCategory, ZoomId } from "@gunari/core";
import { PbfReader } from "pbf";
import { PMTiles } from "pmtiles";
import { selectPois, sortRoadsByClass } from "../interpret/parse";
import type { BBox, Label, MapGeometry, Poi, Polygon, Road, RoadClass } from "../interpret/types";
import { OverpassError } from "./overpass";

let tilesUrl: string | null = null;

/** Point the map at a Protomaps PMTiles archive, or pass null to use Overpass only. */
export function setTilesSource(url: string | null | undefined): void {
  tilesUrl = url || null;
}

export function getTilesSource(): string | null {
  return tilesUrl;
}

const TILE_ZOOM: Record<ZoomId, number> = { neighborhood: 15, district: 15, city: 13 };

const archives = new Map<string, PMTiles>();
function archive(url: string): PMTiles {
  let a = archives.get(url);
  if (!a) {
    a = new PMTiles(url);
    archives.set(url, a);
  }
  return a;
}

function lngToTileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * 2 ** z;
}

function latToTileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
}

export function tilesForBBox(bbox: BBox, z: number): { x: number; y: number }[] {
  const n = 2 ** z;
  const clamp = (v: number) => Math.min(n - 1, Math.max(0, Math.floor(v)));
  const x0 = clamp(lngToTileX(bbox[0], z));
  const x1 = clamp(lngToTileX(bbox[2], z));
  const y0 = clamp(latToTileY(bbox[3], z));
  const y1 = clamp(latToTileY(bbox[1], z));
  const out: { x: number; y: number }[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ x, y });
  return out;
}

type LngLat = [number, number];
interface TilePoint { x: number; y: number }

function unproject(z: number, tx: number, ty: number, extent: number, p: TilePoint): LngLat {
  const n = 2 ** z;
  const lng = ((tx + p.x / extent) / n) * 360 - 180;
  const merc = Math.PI * (1 - (2 * (ty + p.y / extent)) / n);
  const lat = (Math.atan(Math.sinh(merc)) * 180) / Math.PI;
  return [lng, lat];
}

const ROAD_BY_DETAIL: Record<string, RoadClass> = {
  motorway: "motorway", motorway_link: "motorway",
  trunk: "trunk", trunk_link: "trunk",
  primary: "primary", primary_link: "primary",
  secondary: "secondary", secondary_link: "secondary",
  tertiary: "tertiary", tertiary_link: "tertiary", unclassified: "tertiary",
  residential: "residential", living_street: "residential",
  path: "path", footway: "path", cycleway: "path",
};

const WATER_KINDS = ["water", "lake", "ocean", "playa", "other"];
const WATERWAY_DETAILS = ["river", "stream", "canal"];
const PARK_KINDS = ["park", "national_park", "nature_reserve", "protected_area", "garden", "playground", "dog_park", "zoo"];
const BUILT_KINDS = ["residential", "commercial", "retail", "industrial", "construction", "garages"];
const GREEN_KINDS = [
  "forest", "wood", "grass", "meadow", "recreation_ground", "village_green", "cemetery", "farmland",
  "orchard", "scrub", "grassland", "wetland", "heath",
];
const PLACE_KINDS = ["locality", "macrohood", "neighbourhood"];

const POI_KINDS: Record<string, PlaceCategory> = {
  restaurant: "food", cafe: "food", fast_food: "food", bar: "food", pub: "food", food_court: "food",
  ice_cream: "food", biergarten: "food", bakery: "food",
  museum: "landmarks", attraction: "landmarks", gallery: "landmarks", artwork: "landmarks",
  viewpoint: "landmarks", zoo: "landmarks", theme_park: "landmarks", theatre: "landmarks",
  cinema: "landmarks", marketplace: "landmarks", monument: "landmarks", castle: "landmarks",
  hotel: "lodging", hostel: "lodging", guest_house: "lodging", motel: "lodging", apartment: "lodging",
  school: "community", university: "community", college: "community", hospital: "community",
  clinic: "community", place_of_worship: "community", library: "community", townhall: "community",
  police: "community", fire_station: "community", bank: "community",
  supermarket: "shops", convenience: "shops", mall: "shops", department_store: "shops",
  clothes: "shops", books: "shops", pharmacy: "shops",
};

export interface TileParts {
  roads: Road[];
  water: Polygon[];
  waterways: LngLat[][];
  parks: Polygon[];
  built: Polygon[];
  green: Polygon[];
  labels: Label[];
  pois: Poi[];
}

export function emptyParts(): TileParts {
  return { roads: [], water: [], waterways: [], parks: [], built: [], green: [], labels: [], pois: [] };
}

interface FeatureLike {
  type: number;
  extent: number;
  properties: Record<string, unknown>;
  loadGeometry(): TilePoint[][];
}
interface LayerLike {
  length: number;
  feature(i: number): FeatureLike;
}
export interface TileLike {
  layers: Record<string, LayerLike | undefined>;
}

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Convert one decoded vector tile into the app's geometry, appending to `out`. */
export function addTile(out: TileParts, tile: TileLike, z: number, tx: number, ty: number, withPois: boolean): void {
  const each = (layer: string, fn: (f: FeatureLike) => void) => {
    const l = tile.layers[layer];
    if (!l) return;
    for (let i = 0; i < l.length; i++) fn(l.feature(i));
  };
  const toLngLat = (f: FeatureLike, ring: TilePoint[]): LngLat[] => ring.map((p) => unproject(z, tx, ty, f.extent, p));
  const lines = (f: FeatureLike) => f.loadGeometry().map((part) => toLngLat(f, part));
  const polygons = (f: FeatureLike, name?: string): Polygon[] =>
    (classifyRings(f.loadGeometry() as never) as unknown as TilePoint[][][]).map(([outer, ...holes]) => ({
      points: toLngLat(f, outer),
      ...(holes.length ? { holes: holes.map((h) => toLngLat(f, h)) } : {}),
      ...(name ? { name } : {}),
    }));
  const firstPoint = (f: FeatureLike): LngLat | undefined => lines(f)[0]?.[0];

  each("roads", (f) => {
    const cls = ROAD_BY_DETAIL[text(f.properties.kind_detail)];
    if (!cls || f.type !== 2) return;
    const name = text(f.properties.name) || undefined;
    for (const points of lines(f)) out.roads.push({ class: cls, points, name });
  });

  each("water", (f) => {
    if (f.type === 3 && WATER_KINDS.includes(text(f.properties.kind))) {
      out.water.push(...polygons(f, text(f.properties.name) || undefined));
    } else if (f.type === 2 && WATERWAY_DETAILS.includes(text(f.properties.kind_detail))) {
      out.waterways.push(...lines(f));
    }
  });

  each("landuse", (f) => {
    if (f.type !== 3) return;
    const kind = text(f.properties.kind);
    if (PARK_KINDS.includes(kind)) out.parks.push(...polygons(f, text(f.properties.name) || undefined));
    else if (BUILT_KINDS.includes(kind)) out.built.push(...polygons(f));
    else if (GREEN_KINDS.includes(kind)) out.green.push(...polygons(f));
  });

  each("places", (f) => {
    const name = text(f.properties.name);
    const at = f.type === 1 ? firstPoint(f) : undefined;
    if (name && at && PLACE_KINDS.includes(text(f.properties.kind))) {
      out.labels.push({ text: name, x: at[0], y: at[1], class: "place" });
    }
  });

  if (!withPois) return;
  each("pois", (f) => {
    const name = text(f.properties.name);
    const category = POI_KINDS[text(f.properties.kind)];
    const at = f.type === 1 ? firstPoint(f) : undefined;
    if (name && category && at) out.pois.push({ name, category, x: at[0], y: at[1] });
  });
}

export function finishTiles(bbox: BBox, parts: TileParts): MapGeometry {
  sortRoadsByClass(parts.roads);
  const seen = new Set<string>();
  // Tiles overlap by a margin, so the same place can arrive more than once.
  const labels = parts.labels.filter((l) => !seen.has(l.text) && seen.add(l.text));
  return { bbox, ...parts, labels, pois: selectPois(parts.pois) };
}

/** Read every tile that covers the bbox from a PMTiles archive and build the map geometry. */
export async function loadTileGeometry(
  bbox: BBox,
  zoom: ZoomId,
  signal: AbortSignal,
  options: { pois?: boolean } = {},
  url: string | null = tilesUrl
): Promise<MapGeometry> {
  if (!url) throw new OverpassError("no tile source");
  if (signal.aborted) throw new OverpassError("aborted");
  const z = TILE_ZOOM[zoom];
  const source = archive(url);
  try {
    const tiles = await Promise.all(
      tilesForBBox(bbox, z).map(async ({ x, y }) => ({ x, y, res: await source.getZxy(z, x, y, signal) }))
    );
    const parts = emptyParts();
    for (const t of tiles) {
      if (!t.res) continue;
      const tile = new VectorTile(new PbfReader(new Uint8Array(t.res.data)));
      addTile(parts, tile as unknown as TileLike, z, t.x, t.y, Boolean(options.pois));
    }
    return finishTiles(bbox, parts);
  } catch (err) {
    if (signal.aborted) throw new OverpassError("aborted");
    throw new OverpassError(`tiles failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
