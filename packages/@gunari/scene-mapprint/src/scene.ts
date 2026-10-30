import type { Scene, SceneCapabilities, SceneInput } from "@gunari/core";
import type { BBox, MapGeometry } from "./interpret/types";
import type { ProjectedMapGeometry } from "./projection/types";
import { fetchOsm, OverpassError } from "./data/overpass";
import { parseOsm, type OsmResponse } from "./interpret/parse";
import { bboxForZoom } from "./projection/viewport";
import { projectGeometry } from "./projection/project";
import { renderMap } from "./render/render";
import { type MapThemePalette } from "./styles/themes";
import { MapDataCache } from "./data/cache";
import { IndexedDBCacheStorage } from "./data/indexed-db-storage";

export interface MapPrintSceneData {
  geometry: MapGeometry;
  bbox: BBox;
  zoom: SceneInput["zoom"];
}

const SIMPLIFY_TOLERANCE: Record<SceneInput["zoom"], number> = {
  neighborhood: 0.0005,
  district: 0.001,
  city: 0.003,
};

// Browser-only persistent layer (IndexedDB). In Node/jsdom, indexedDB is
// undefined and the cache falls back to memory-only — safe for tests.
const cache = new MapDataCache({
  storage: typeof indexedDB !== "undefined" ? new IndexedDBCacheStorage() : undefined,
});

function hasFeatures(g: MapGeometry): boolean {
  // Entries saved before the built-up/green layers existed have no `built`;
  // treat them as stale so they are fetched again with the new layers.
  if (g.built === undefined || g.pois === undefined) return false;
  return g.roads.length + g.water.length + g.waterways.length + g.parks.length + g.built.length > 0;
}

export const mapPrintScene: Scene<MapPrintSceneData, ProjectedMapGeometry> & {
  /** Synchronous lookup of already-loaded data, so cached views show without waiting. */
  peek(input: SceneInput): MapPrintSceneData | null;
} = {
  id: "mapprint",

  capabilities: {
    shapes: ["square", "circle", "heart"],
    styles: ["classic", "midnight", "blueprint", "paper", "twilight", "atlas", "ink", "mist", "nocturne", "lagoon", "chalk"],
    markers: ["solid", "ring", "heart", "star"],
    zooms: ["neighborhood", "district", "city"],
    layouts: ["classic", "poster"],
    supportsRotation: true,
    supportsLabels: true,
  } satisfies SceneCapabilities,

  peek(input) {
    const bbox = bboxForZoom(input.location.lat, input.location.lng, input.zoom);
    const cached = cache.get(bbox);
    return cached && hasFeatures(cached) ? { geometry: cached, bbox, zoom: input.zoom } : null;
  },

  async load(input, signal) {
    const { lat, lng } = input.location;
    const bbox = bboxForZoom(lat, lng, input.zoom);
    const cached = await cache.getWithPersistence(bbox);
    // An empty entry may be left over from a failed fetch, so refetch it.
    if (cached && hasFeatures(cached)) return { geometry: cached, bbox, zoom: input.zoom };

    let osm: OsmResponse;
    try {
      // Named places only make sense up close; the city view would be flooded.
      osm = await fetchOsm(bbox, signal, undefined, { pois: input.zoom !== "city" });
    } catch (err) {
      if (err instanceof OverpassError && err.message === "aborted") throw err;
      // Not cached: a transient failure must not stick as a permanently blank map.
      const empty: MapGeometry = { bbox, roads: [], water: [], waterways: [], parks: [], built: [], green: [], pois: [], labels: [] };
      return { geometry: empty, bbox, zoom: input.zoom };
    }
    const geometry = parseOsm(osm, bbox);
    await cache.setWithPersistence(bbox, geometry);
    return { geometry, bbox, zoom: input.zoom };
  },

  project(data, viewport, rotation) {
    const tolerance = SIMPLIFY_TOLERANCE[data.zoom];
    return projectGeometry(data.geometry, viewport, rotation, tolerance);
  },

  render(ctx, geometry, palette, input, viewport, w, h) {
    renderMap(ctx, geometry, palette as MapThemePalette, input, viewport, w, h);
  },
};