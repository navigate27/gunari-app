import type { Scene, SceneCapabilities, SceneInput, SceneViewport } from "@gunari/core";
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
    const bbox = bboxForZoom(/* lat/lng come from outside the scene */ 0, 0, input.zoom);
    // The scene's load is called by the app with the location baked into the
    // bbox via a wrapper. For Plan 1, this is a thin glue layer; the app
    // layer (Plan 2) provides the location-aware wrapper.
    const cached = cache.get(bbox);
    if (cached) return { geometry: cached, bbox };

    let osm: OsmResponse;
    try {
      osm = await fetchOsm(bbox, signal);
    } catch (err) {
      if (err instanceof OverpassError && err.message === "aborted") throw err;
      // Graceful degradation: return empty geometry, marker still draws.
      const empty: MapGeometry = { bbox, roads: [], water: [], waterways: [], parks: [], labels: [] };
      cache.set(bbox, empty);
      return { geometry: empty, bbox };
    }
    const geometry = parseOsm(osm, bbox);
    cache.set(bbox, geometry);
    return { geometry, bbox };
  },

  project(data, viewport, rotation) {
    // The tolerance depends on zoom, which we don't have here directly;
    // for now we use district as the default. Plan 2 wires the actual zoom
    // through the scene's caller by re-projecting when zoom changes.
    const tolerance = SIMPLIFY_TOLERANCE.district;
    return projectGeometry(data.geometry, viewport, rotation, tolerance);
  },

  render(ctx, geometry, palette) {
    // The renderer needs the SceneInput (shape, marker, labels) and the
    // viewport (cx/cy/r) — these come from the scaffold. The Scene contract
    // passes only geometry + palette here, so for v1 we encode the input
    // into the geometry's rotation field as a stopgap. Plan 2 introduces a
    // small wrapper that captures the input + viewport at the call site.
    const input: SceneInput = {
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: geometry.rotation,
      labels: false, layout: "classic",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    renderMap(ctx, geometry, palette as MapThemePalette, input, viewport, 1080, 1920);
  },
};