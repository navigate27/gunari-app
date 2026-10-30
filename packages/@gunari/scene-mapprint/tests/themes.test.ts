import { describe, it, expect } from "vitest";
import { MAP_THEMES, getMapTheme, poiColors } from "../src/styles/themes";
import type { MapStyleId } from "@gunari/core";

const EXPECTED_IDS: MapStyleId[] = [
  "classic", "midnight", "blueprint", "paper", "twilight",
  "atlas", "ink", "mist", "nocturne", "lagoon", "chalk",
];

describe("MAP_THEMES", () => {
  it("has every theme id", () => {
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
    for (const id of ["atlas", "ink", "mist", "lagoon", "chalk"] as const) expect(MAP_THEMES[id].light).toBe(true);
    expect(MAP_THEMES.nocturne.light).toBe(false);
  });

  it("the land-use themes define built-up and green fills, and casings are wider outlines", () => {
    for (const id of ["atlas", "mist", "nocturne", "lagoon", "chalk"] as const) {
      expect(MAP_THEMES[id].built).toMatch(/^#[0-9a-f]{6}$/i);
      expect(MAP_THEMES[id].green).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (const id of EXPECTED_IDS) {
      for (const c of Object.values(MAP_THEMES[id].casing ?? {})) {
        expect(c.extra).toBeGreaterThan(0);
      }
    }
  });

  it("getMapTheme returns the matching palette", () => {
    expect(getMapTheme("midnight")).toBe(MAP_THEMES.midnight);
  });

  it("place dot colours follow the theme: brighter on dark, deeper on light, one colour for Ink", () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
    };
    const mean = (id: keyof typeof MAP_THEMES) =>
      Object.values(poiColors(MAP_THEMES[id])).reduce((s, c) => s + lum(c), 0) / 5;
    expect(mean("nocturne")).toBeGreaterThan(mean("atlas"));
    expect(mean("midnight")).toBeGreaterThan(mean("classic"));
    expect(new Set(Object.values(poiColors(MAP_THEMES.ink))).size).toBe(1);
    expect(poiColors(MAP_THEMES.blueprint).food).not.toBe(poiColors(MAP_THEMES.classic).food);
    for (const id of Object.keys(MAP_THEMES) as (keyof typeof MAP_THEMES)[]) {
      for (const c of Object.values(poiColors(MAP_THEMES[id]))) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
