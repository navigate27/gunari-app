import { describe, it, expect } from "vitest";
import { mapPrintScene, type MapPrintSceneData } from "../src/scene";
import type { SceneCapabilities, SceneInput, SceneViewport } from "@gunari/core";

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
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const input: SceneInput = {
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: 0, labels: false, layout: "classic",
    };
    const out = mapPrintScene.project(data, viewport, input.rotation);
    expect(out.roads.length).toBe(1);
    expect(out.roads[0].class).toBe("motorway");
  });
});