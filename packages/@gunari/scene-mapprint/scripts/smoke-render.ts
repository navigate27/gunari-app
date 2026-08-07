// Dev-time end-to-end smoke test: parse a Manila fixture, project it, and
// render to a real PNG file using the SAME production modules the scene
// pipeline uses (no reimplementation). Run: `npm run smoke`.
// Produces smoke-output.png in the same directory (gitignored).

import { writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "canvas";
import { parseOsm, type OsmResponse } from "../src/interpret/parse";
import { projectGeometry } from "../src/projection/project";
import { renderMap } from "../src/render/render";
import { MAP_THEMES } from "../src/styles/themes";
import type { BBox } from "../src/interpret/types";
import type { SceneInput, SceneViewport } from "@gunari/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "smoke-output.png");
const FIXTURE = resolve(__dirname, "../__fixtures__/manila-district.json");
const BBOX: BBox = [120.95, 14.58, 121.02, 14.63];

async function main(): Promise<void> {
  const fixtureJson: OsmResponse = JSON.parse(await readFile(FIXTURE, "utf8"));
  const geometry = parseOsm(fixtureJson, BBOX);
  const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
  const input: SceneInput = {
    shape: "square",
    style: "classic",
    marker: "solid",
    zoom: "district",
    rotation: 0,
    labels: true,
    layout: "classic",
  };
  const projected = projectGeometry(geometry, viewport, 0, 0.001);

  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  // Background gradient: the render function draws inside the shape mask,
  // so fill the full canvas with the theme's background gradient first.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, MAP_THEMES.classic.background.top);
  grad.addColorStop(1, MAP_THEMES.classic.background.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  renderMap(ctx, projected, MAP_THEMES.classic, input, viewport, W, H);

  await writeFile(OUT, canvas.toBuffer("image/png"));
  console.log(`✓ wrote ${OUT}`);
}

main().catch((err: unknown) => {
  console.error("smoke render failed:", err);
  process.exit(1);
});