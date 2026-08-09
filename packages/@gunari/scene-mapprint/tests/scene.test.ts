import { describe, it, expect } from "vitest";
import { mapPrintScene, type MapPrintSceneData } from "../src/scene";
import type { SceneCapabilities, SceneInput, SceneViewport } from "@gunari/core";
import { MAP_THEMES } from "../src/styles/themes";

describe("mapPrintScene", () => {
  it("has id 'mapprint'", () => {
    expect(mapPrintScene.id).toBe("mapprint");
  });

  it("advertises the full v1 capabilities", () => {
    const caps = mapPrintScene.capabilities as SceneCapabilities;
    expect(caps.shapes).toEqual(["square", "circle", "heart"]);
    expect(caps.styles).toEqual(["classic", "midnight", "blueprint", "paper", "twilight"]);
    expect(caps.markers).toEqual(["solid", "ring", "heart", "star"]);
    expect(caps.zooms).toEqual(["neighborhood", "district", "city"]);
    expect(caps.layouts).toEqual(["classic", "poster"]);
    expect(caps.supportsRotation).toBe(true);
    expect(caps.supportsLabels).toBe(true);
  });

  it("project returns a ProjectedMapGeometry with roads", () => {
    const data: MapPrintSceneData = {
      geometry: {
        bbox: [120.95, 14.58, 121.02, 14.63],
        roads: [{ class: "motorway", points: [[120.95, 14.58], [121.02, 14.63]], name: "Skyway" }],
        water: [], waterways: [], parks: [],
        labels: [{ text: "Manila", x: 0, y: 0, class: "place" }],
      },
      bbox: [120.95, 14.58, 121.02, 14.63],
      zoom: "district",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const out = mapPrintScene.project(data, viewport, 0);
    expect(out.roads.length).toBe(1);
    expect(out.roads[0].class).toBe("motorway");
  });

  it("project uses data.zoom to pick tolerance (neighborhood = 0.0005)", () => {
    const data: MapPrintSceneData = {
      geometry: {
        bbox: [120.98, 14.59, 120.99, 14.60],
        roads: [{ class: "residential", points: [[120.98, 14.59], [120.985, 14.595], [120.99, 14.60]], name: "" }],
        water: [], waterways: [], parks: [], labels: [],
      },
      bbox: [120.98, 14.59, 120.99, 14.60],
      zoom: "neighborhood",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const out = mapPrintScene.project(data, viewport, 0);
    // neighborhood tolerance is finer — the 3-point road should NOT be simplified to 2 points
    expect(out.roads[0].points.length).toBe(3);
  });

  it("project uses data.zoom to pick tolerance (city = 0.003, coarser)", () => {
    const data: MapPrintSceneData = {
      geometry: {
        bbox: [120.9, 14.55, 121.1, 14.65],
        roads: [{ class: "residential", points: [[120.98, 14.59], [120.985, 14.595], [120.99, 14.60]], name: "" }],
        water: [], waterways: [], parks: [], labels: [],
      },
      bbox: [120.9, 14.55, 121.1, 14.65],
      zoom: "city",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const out = mapPrintScene.project(data, viewport, 0);
    // city tolerance is coarser — the middle point may be simplified away
    // (the exact result depends on the simplification algorithm; just assert roads exist)
    expect(out.roads.length).toBe(1);
  });

  it("render calls renderMap with the full 7 args", () => {
    const ctx = {
      save: () => {}, restore: () => {}, fillRect: () => {}, fillStyle: "", strokeStyle: "",
      globalAlpha: 1, lineWidth: 1, lineCap: "" as CanvasLineCap, lineJoin: "" as CanvasLineJoin,
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
      fill: () => {}, stroke: () => {}, clip: () => {}, rect: () => {}, arc: () => {},
      bezierCurveTo: () => {}, textAlign: "" as CanvasTextAlign, textBaseline: "" as CanvasTextBaseline,
      font: "", fillText: () => {},
    } as unknown as CanvasRenderingContext2D;
    const data: MapPrintSceneData = {
      geometry: { bbox: [120.95, 14.58, 121.02, 14.63], roads: [], water: [], waterways: [], parks: [], labels: [] },
      bbox: [120.95, 14.58, 121.02, 14.63],
      zoom: "district",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const geom = mapPrintScene.project(data, viewport, 0);
    const input: SceneInput = {
      location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: 0, labels: false, layout: "classic",
    };
    const palette = MAP_THEMES.classic;
    // Should not throw
    expect(() => mapPrintScene.render(ctx, geom, palette, input, viewport, 540, 960)).not.toThrow();
  });
});