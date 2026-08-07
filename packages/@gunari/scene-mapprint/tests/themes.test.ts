import { describe, it, expect } from "vitest";
import { MAP_THEMES, getMapTheme } from "../src/styles/themes";
import type { MapStyleId } from "@gunari/core";

const EXPECTED_IDS: MapStyleId[] = ["classic", "midnight", "blueprint", "paper", "twilight"];

describe("MAP_THEMES", () => {
  it("has all five theme ids", () => {
    expect(Object.keys(MAP_THEMES).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it("every palette has a per-class road entry with color and width", () => {
    for (const id of EXPECTED_IDS) {
      const p = MAP_THEMES[id];
      expect(p.road.motorway).toHaveProperty("color");
      expect(p.road.motorway).toHaveProperty("width");
      expect(p.road.residential).toHaveProperty("color");
      expect(p.road.residential).toHaveProperty("width");
    }
  });

  it("every palette has water, waterway, park, marker, markerSymbol, label, background, light", () => {
    for (const id of EXPECTED_IDS) {
      const p = MAP_THEMES[id];
      expect(typeof p.water).toBe("string");
      expect(typeof p.waterway).toBe("string");
      expect(typeof p.park).toBe("string");
      expect(typeof p.marker).toBe("string");
      expect(typeof p.markerSymbol).toBe("string");
      expect(typeof p.label).toBe("string");
      expect(typeof p.labelColor).toBe("string");
      expect(p.background).toHaveProperty("top");
      expect(p.background).toHaveProperty("bottom");
      expect(typeof p.light).toBe("boolean");
    }
  });

  it("light themes have light=true; dark themes have light=false", () => {
    expect(MAP_THEMES.paper.light).toBe(true);
    expect(MAP_THEMES.classic.light).toBe(true);
    expect(MAP_THEMES.midnight.light).toBe(false);
    expect(MAP_THEMES.blueprint.light).toBe(false);
    expect(MAP_THEMES.twilight.light).toBe(false);
  });

  it("getMapTheme returns the matching palette", () => {
    expect(getMapTheme("midnight")).toBe(MAP_THEMES.midnight);
  });
});