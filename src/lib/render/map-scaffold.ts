import type { ScaffoldInput, SceneRenderFn, ThemePalette } from "@gunari/core";
import {
  CARD_STYLES,
  bboxForZoom,
  mapPrintScene,
  getMapTheme,
  type ProjectedMapGeometry,
} from "@gunari/scene-mapprint";
import { MAP_PREVIEW_VIEWPORT, type MapPrintInput } from "@/hooks/useMapPrintState";
import { formatLatLng } from "@/lib/utils";

/** A map with nothing drawn yet, so the frame, title and theme can show while data loads. */
export function emptyGeometry(input: MapPrintInput): ProjectedMapGeometry {
  const { lat, lng } = input.location;
  return {
    roads: [], water: [], waterways: [], parks: [], built: [], green: [], labels: [],
    bbox: bboxForZoom(lat, lng, input.zoom),
    rotation: input.rotation,
  };
}

/** The card's colours: its own style, or the map theme's when set to "match". */
export function cardPalette(input: Pick<MapPrintInput, "card" | "style">): ThemePalette {
  return input.card === "match" ? getMapTheme(input.style) : CARD_STYLES[input.card];
}

export function buildMapScaffoldInput(
  input: MapPrintInput,
  geometry: ProjectedMapGeometry,
  pan: { x: number; y: number } = { x: 0, y: 0 },
  reveal?: number,
): ScaffoldInput {
  const mapPalette = getMapTheme(input.style);
  return {
    format: input.format,
    layout: input.layout,
    title: input.title,
    message: input.message,
    meta: {
      date: "",
      time: "",
      location: input.location.label,
      coordinates: input.showCoordinates
        ? formatLatLng(input.pin?.lat ?? input.location.lat, input.pin?.lng ?? input.location.lng)
        : undefined,
    },
    palette: cardPalette(input),
    scene: { render: mapPrintScene.render as unknown as SceneRenderFn },
    sceneGeometry: geometry,
    scenePalette: mapPalette,
    sceneInput: input,
    sceneViewport: {
      ...MAP_PREVIEW_VIEWPORT(input.layout, input.format),
      zoomScale: geometry.zoomScale,
      panX: pan.x,
      panY: pan.y,
      reveal: reveal !== undefined && reveal < 1 ? reveal : undefined,
    },
  };
}
