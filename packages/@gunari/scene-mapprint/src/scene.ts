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

const cache = new MapDataCache();

export const mapPrintScene: Scene<MapPrintSceneData, ProjectedMapGeometry> = {
  id: "mapprint",

  capabilities: {
    shapes: ["square", "circle", "heart"],
    styles: ["classic", "midnight", "blueprint", "paper", "twilight"],
    markers: ["solid", "ring", "heart", "star"],
    zooms: ["neighborhood", "district", "city"],
    layouts: ["classic", "poster"],
    supportsRotation: true,
    supportsLabels: true,
  } satisfies SceneCapabilities,

  async load(input, signal) {
    const { lat, lng } = input.location;
    const bbox = bboxForZoom(lat, lng, input.zoom);
    const cached = cache.get(bbox);
    if (cached) return { geometry: cached, bbox, zoom: input.zoom };

    let osm: OsmResponse;
    try {
      osm = await fetchOsm(bbox, signal);
    } catch (err) {
      if (err instanceof OverpassError && err.message === "aborted") throw err;
      const empty: MapGeometry = { bbox, roads: [], water: [], waterways: [], parks: [], labels: [] };
      cache.set(bbox, empty);
      return { geometry: empty, bbox, zoom: input.zoom };
    }
    const geometry = parseOsm(osm, bbox);
    cache.set(bbox, geometry);
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