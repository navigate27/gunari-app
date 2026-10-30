import { describe, it, expect } from "vitest";
import { artworkLayout } from "@gunari/core";
import {
  VIEW_KM_MAX,
  VIEW_KM_MIN,
  clampViewKm,
  naturalViewKm,
  sliderFromViewKm,
  tierForViewKm,
  viewKmFromSlider,
  zoomScaleFor,
} from "../src/projection/viewport";
import { projectGeometry } from "../src/projection/project";
import { panLocation } from "../src/projection/pan";
import type { MapGeometry } from "../src/interpret/types";

describe("zoom helpers", () => {
  it("picks the smallest data tier that still covers the view", () => {
    expect(tierForViewKm(0.3)).toBe("neighborhood");
    expect(tierForViewKm(naturalViewKm("neighborhood"))).toBe("neighborhood");
    expect(tierForViewKm(0.6)).toBe("district");
    expect(tierForViewKm(naturalViewKm("district"))).toBe("district");
    expect(tierForViewKm(3)).toBe("city");
    expect(tierForViewKm(VIEW_KM_MAX)).toBe("city");
  });

  it("never needs to shrink the data below its natural size", () => {
    for (const km of [0.25, 0.4, 0.45, 1, 1.4, 1.5, 4, 8.4]) {
      expect(zoomScaleFor(tierForViewKm(km), km)).toBeGreaterThanOrEqual(1 - 1e-9);
    }
  });

  it("maps the slider to view size on a log scale and back", () => {
    expect(viewKmFromSlider(0)).toBeCloseTo(VIEW_KM_MAX, 6);
    expect(viewKmFromSlider(1)).toBeCloseTo(VIEW_KM_MIN, 6);
    for (const km of [0.3, 1, 4]) expect(viewKmFromSlider(sliderFromViewKm(km))).toBeCloseTo(km, 6);
    expect(clampViewKm(100)).toBe(VIEW_KM_MAX);
    expect(clampViewKm(0.01)).toBe(VIEW_KM_MIN);
  });
});

describe("zoomScale in projection and panning", () => {
  const bbox: [number, number, number, number] = [120.97, 14.59, 120.99, 14.61];
  const geom: MapGeometry = {
    bbox,
    roads: [{ class: "motorway", points: [[120.97, 14.59], [120.99, 14.61]] }],
    water: [], waterways: [], parks: [], labels: [],
  };
  const slot = artworkLayout("story", "classic").slot;

  it("enlarges the map about the slot centre", () => {
    const base = projectGeometry(geom, slot, 0, 0.001).roads[0].points[1];
    const twice = projectGeometry(geom, { ...slot, zoomScale: 2 }, 0, 0.001).roads[0].points[1];
    expect(twice[0] - slot.cx).toBeCloseTo((base[0] - slot.cx) * 2, 6);
    expect(twice[1] - slot.cy).toBeCloseTo((base[1] - slot.cy) * 2, 6);
  });

  it("records the scale on the geometry so pins and drags can undo it", () => {
    expect(projectGeometry(geom, { ...slot, zoomScale: 2.5 }, 0, 0.001).zoomScale).toBe(2.5);
    expect(projectGeometry(geom, slot, 0, 0.001).zoomScale).toBe(1);
  });

  it("moves less ground for the same drag when zoomed in", () => {
    const origin = { lat: 14.6, lng: 120.98 };
    const wide = panLocation(origin, "district", slot, 0, 0, 0.05);
    const close = panLocation(origin, "district", { ...slot, zoomScale: 4 }, 0, 0, 0.05);
    expect(close.lat - origin.lat).toBeCloseTo((wide.lat - origin.lat) / 4, 8);
  });
});
