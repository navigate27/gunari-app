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

  const px = (p: [number, number], v: SceneViewport = viewport): [number, number] => [
    p[0] * (v.canvasW ?? 1080),
    p[1] * (v.canvasH ?? 1920),
  ];

  // The bbox lands on a square centred on the slot, side = 2r * min(W, H) * sqrt(2)
  // so it still covers the slot when rotated. North is up (y flipped).
  it("places the bbox on a square centred on the slot (min corner bottom-left)", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    const half = 0.4 * 1080 * Math.SQRT2;
    const [x, y] = px(out.roads[0].points[0]);
    expect(x).toBeCloseTo(540 - half, 0);
    expect(y).toBeCloseTo(960 + half, 0);
  });

  it("places the bbox max corner top-right", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    const half = 0.4 * 1080 * Math.SQRT2;
    const [x, y] = px(out.roads[0].points[1]);
    expect(x).toBeCloseTo(540 + half, 0);
    expect(y).toBeCloseTo(960 - half, 0);
  });

  it("scales both axes equally on a landscape canvas so the map is not stretched", () => {
    const wide: SceneViewport = { cx: 0.27, cy: 0.5, r: 0.36, canvasW: 1920, canvasH: 1080 };
    const out = projectGeometry(geom, wide, 0, 0.001);
    const [x0, y0] = px(out.roads[0].points[0], wide);
    const [x1, y1] = px(out.roads[0].points[1], wide);
    expect(x1 - x0).toBeCloseTo(y0 - y1, 0);
  });

  it("preserves road names and classes", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    expect(out.roads[0].class).toBe("motorway");
    expect(out.roads[0].name).toBe("Skyway");
  });

  it("rotates points around the slot centre without changing their pixel distance from it", () => {
    const wide: SceneViewport = { cx: 0.27, cy: 0.5, r: 0.36, canvasW: 1920, canvasH: 1080 };
    const flat = projectGeometry(geom, wide, 0, 0.001).roads[0].points[0];
    const turned = projectGeometry(geom, wide, Math.PI / 2, 0.001).roads[0].points[0];
    const dist = (p: [number, number]) => {
      const [x, y] = px(p, wide);
      return Math.hypot(x - 0.27 * 1920, y - 0.5 * 1080);
    };
    expect(dist(turned)).toBeCloseTo(dist(flat), 3);
    const [fx, fy] = px(flat, wide);
    const [tx, ty] = px(turned, wide);
    // +90°: (dx, dy) -> (-dy, dx)
    expect(tx - 0.27 * 1920).toBeCloseTo(-(fy - 540), 3);
    expect(ty - 540).toBeCloseTo(fx - 0.27 * 1920, 3);
  });

  it("returns labels with projected x/y", () => {
    // The Manila label has x=0,y=0 in the input. projectGeometry should
    // place it at the projected centroid of the bbox.
    const out = projectGeometry(geom, viewport, 0, 0.001);
    expect(out.labels[0].x).toBeGreaterThanOrEqual(0);
    expect(out.labels[0].x).toBeLessThanOrEqual(1);
  });
});