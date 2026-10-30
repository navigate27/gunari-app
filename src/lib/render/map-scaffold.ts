import type { ScaffoldInput, SceneRenderFn } from "@gunari/core";
import { mapPrintScene, getMapTheme, type ProjectedMapGeometry } from "@gunari/scene-mapprint";
import { MAP_PREVIEW_VIEWPORT, type MapPrintInput } from "@/hooks/useMapPrintState";
import { formatLatLng } from "@/lib/utils";

export function buildMapScaffoldInput(
  input: MapPrintInput,
  geometry: ProjectedMapGeometry,
  pan: { x: number; y: number } = { x: 0, y: 0 },
): ScaffoldInput {
  const palette = getMapTheme(input.style);
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
        ? formatLatLng(input.location.lat, input.location.lng)
        : undefined,
    },
    palette,
    scene: { render: mapPrintScene.render as unknown as SceneRenderFn },
    sceneGeometry: geometry,
    scenePalette: palette,
    sceneInput: input,
    sceneViewport: { ...MAP_PREVIEW_VIEWPORT(input.layout, input.format), panX: pan.x, panY: pan.y },
  };
}
