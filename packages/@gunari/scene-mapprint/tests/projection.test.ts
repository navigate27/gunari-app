import { describe, it, expect } from "vitest";
import { bboxForZoom, zoomKmSpan } from "../src/projection/viewport";
import { projectGeometry } from "../src/projection/project";
import type { MapGeometry, BBox } from "../src/interpret/types";
import type { SceneViewport } from "@gunari/core";

describe("zoomKmSpan", () => {
  it("neighborhood = 0.6 km", () => {
    expect(zoomKmSpan("neighborhood")).toBe(0.6);
  });
  it("district = 2 km", () => {
    expect(zoomKmSpan("district")).toBe(2);
  });
  it("city = 12 km", () => {
    expect(zoomKmSpan("city")).toBe(12);
  });
});

describe("bboxForZoom", () => {
  it("returns a bbox centered on the given lat/lng", () => {
    const bbox = bboxForZoom(14.5995, 120.9842, "district");
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const cx = (minLng + maxLng) / 2;
    const cy = (minLat + maxLat) / 2;
    expect(cx).toBeCloseTo(120.9842, 4);
    expect(cy).toBeCloseTo(14.5995, 4);
  });
  it("neighborhood bbox is smaller than district", () => {
    const n = bboxForZoom(14.5995, 120.9842, "neighborhood");
    const d = bboxForZoom(14.5995, 120.9842, "district");
    const nSpan = n[2] - n[0];
    const dSpan = d[2] - d[0];
    expect(nSpan).toBeLessThan(dSpan);
  });
});

describe("projectGeometry", () => {
  const bbox: BBox = [120.95, 14.58, 121.02, 14.63];
  const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
  const geom: MapGeometry = {
    bbox,
    roads: [
      { class: "motorway", points: [[120.95, 14.58], [121.02, 14.63]], name: "Skyway" },
      { class: "residential", points: [[120.98, 14.60], [120.99, 14.61]] },
    ],
    water: [{ points: [[120.95, 14.58], [120.96, 14.58], [120.96, 14.59]] }],
    waterways: [],
    parks: [],
    labels: [{ text: "Manila", x: 0, y: 0, class: "place" }],
  };

  // With the y-flip (`return [nx, 1 - ny]`) the min-lng/min-lat corner
  // (geographic south-west) maps to canvas [0, 1] (bottom-left in canvas-
  // down y), and the max corner maps to [1, 0] (top-right). North is up.
  it("maps the bbox min corner to roughly [0, 1] (y-flipped)", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    const motorway = out.roads[0];
    expect(motorway.points[0][0]).toBeCloseTo(0, 1);
    expect(motorway.points[0][1]).toBeCloseTo(1, 1);
  });

  it("maps the bbox max corner to roughly [1, 0] (y-flipped)", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    const motorway = out.roads[0];
    expect(motorway.points[1][0]).toBeCloseTo(1, 1);
    expect(motorway.points[1][1]).toBeCloseTo(0, 1);
  });

  it("preserves road names and classes", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    expect(out.roads[0].class).toBe("motorway");
    expect(out.roads[0].name).toBe("Skyway");
  });

  it("rotates points around the viewport center", () => {
    const out90 = projectGeometry(geom, viewport, Math.PI / 2, 0.001);
    // The motorway's first point is the bbox min corner → projected [0, 1]
    // (canvas bottom-left). A +90° rotation (counterclockwise in math,
    // clockwise visually in canvas-down) around (0.5, 0.5) moves [0, 1]
    // to [0, 0] (canvas top-left).
    expect(out90.roads[0].points[0][0]).toBeCloseTo(0, 1);
    expect(out90.roads[0].points[0][1]).toBeCloseTo(0, 1);
  });

  it("returns labels with projected x/y", () => {
    // The Manila label has x=0,y=0 in the input. projectGeometry should
    // place it at the projected centroid of the bbox.
    const out = projectGeometry(geom, viewport, 0, 0.001);
    expect(out.labels[0].x).toBeGreaterThanOrEqual(0);
    expect(out.labels[0].x).toBeLessThanOrEqual(1);
  });
});