import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { renderToPng, readGolden, writeGolden, diffImages } from "./golden-harness";
import { parseOsm, type OsmResponse } from "../src/interpret/parse";
import { projectGeometry } from "../src/projection/project";
import { renderMap } from "../src/render/render";
import { MAP_THEMES } from "../src/styles/themes";
import type { SceneInput, SceneViewport } from "@gunari/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPDATE = process.env.UPDATE_GOLDEN === "1";

function loadFixture(name: string): OsmResponse {
  return JSON.parse(readFileSync(resolve(__dirname, "../__fixtures__", `${name}.json`), "utf8"));
}

const manilaDistrict = parseOsm(loadFixture("manila-district"), [120.95, 14.58, 121.02, 14.63]);
const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
const W = 540, H = 960; // half-scale for golden-image storage efficiency

const baseInput: SceneInput = {
  shape: "square", style: "classic", marker: "solid",
  zoom: "district", rotation: 0, labels: false, layout: "classic",
};

describe("golden: render.manila-district", () => {
  for (const themeId of ["classic", "midnight", "blueprint", "paper", "twilight"] as const) {
    it(`renders ${themeId} theme matching the golden image`, async () => {
      const tolerance = 0.02; // 2% byte diff tolerance for sub-pixel rendering variance
      const geom = projectGeometry(manilaDistrict, viewport, 0, 0.001);
      const input: SceneInput = { ...baseInput, style: themeId };
      const png = await renderToPng((ctx) => {
        renderMap(ctx, geom, MAP_THEMES[themeId], input, viewport, W, H);
      }, W, H);
      if (UPDATE) {
        await writeGolden(`manila-district-${themeId}`, png);
        return;
      }
      const expected = await readGolden(`manila-district-${themeId}`);
      const { match, diff } = await diffImages(png, expected, tolerance);
      if (!match) {
        // Write the actual for manual inspection.
        await writeGolden(`manila-district-${themeId}.ACTUAL`, png);
      }
      expect(match, `golden diff for ${themeId} = ${diff}`).toBe(true);
    });
  }

  for (const shapeId of ["square", "circle", "heart"] as const) {
    it(`renders ${shapeId} shape matching the golden image`, async () => {
      const tolerance = 0.02;
      const geom = projectGeometry(manilaDistrict, viewport, 0, 0.001);
      const input: SceneInput = { ...baseInput, shape: shapeId };
      const png = await renderToPng((ctx) => {
        renderMap(ctx, geom, MAP_THEMES.classic, input, viewport, W, H);
      }, W, H);
      if (UPDATE) { await writeGolden(`manila-district-shape-${shapeId}`, png); return; }
      const expected = await readGolden(`manila-district-shape-${shapeId}`);
      const { match, diff } = await diffImages(png, expected, tolerance);
      expect(match, `golden shape diff for ${shapeId} = ${diff}`).toBe(true);
    });
  }

  for (const markerId of ["solid", "ring", "heart", "star"] as const) {
    it(`renders ${markerId} marker matching the golden image`, async () => {
      const tolerance = 0.02;
      const geom = projectGeometry(manilaDistrict, viewport, 0, 0.001);
      const input: SceneInput = { ...baseInput, marker: markerId };
      const png = await renderToPng((ctx) => {
        renderMap(ctx, geom, MAP_THEMES.classic, input, viewport, W, H);
      }, W, H);
      if (UPDATE) { await writeGolden(`manila-district-marker-${markerId}`, png); return; }
      const expected = await readGolden(`manila-district-marker-${markerId}`);
      const { match, diff } = await diffImages(png, expected, tolerance);
      expect(match, `golden marker diff for ${markerId} = ${diff}`).toBe(true);
    });
  }

  for (const angle of [0, 45, 90, 180]) {
    it(`renders rotation ${angle}° matching the golden image`, async () => {
      const tolerance = 0.02;
      const rad = (angle * Math.PI) / 180;
      const geom = projectGeometry(manilaDistrict, viewport, rad, 0.001);
      const input: SceneInput = { ...baseInput, rotation: rad };
      const png = await renderToPng((ctx) => {
        renderMap(ctx, geom, MAP_THEMES.classic, input, viewport, W, H);
      }, W, H);
      if (UPDATE) { await writeGolden(`manila-district-rot-${angle}`, png); return; }
      const expected = await readGolden(`manila-district-rot-${angle}`);
      const { match, diff } = await diffImages(png, expected, tolerance);
      expect(match, `golden rotation diff for ${angle}° = ${diff}`).toBe(true);
    });
  }
});