import { describe, it, expect } from "vitest";
import { renderMap } from "../src/render/render";
import { MAP_THEMES } from "../src/styles/themes";
import { projectLatLng } from "../src/projection/frame";
import type { ProjectedMapGeometry } from "../src/projection/types";
import type { SceneInput, SceneViewport } from "@gunari/core";

interface Rec {
  fills: string[];
  strokes: { color: string; width: number }[];
  translates: [number, number][];
  lineTos: number;
}

function recorder() {
  const rec: Rec = { fills: [], strokes: [], translates: [], lineTos: 0 };
  const ctx = {
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    shadowColor: "", shadowBlur: 0, shadowOffsetY: 0, lineCap: "", lineJoin: "",
    font: "", textAlign: "", textBaseline: "",
    save() {}, restore() {}, beginPath() {}, closePath() {}, clip() {}, rect() {}, arc() {},
    moveTo() {}, bezierCurveTo() {}, fillText() {}, scale() {},
    lineTo() { rec.lineTos++; },
    translate(x: number, y: number) { rec.translates.push([x, y]); },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    fill() { rec.fills.push(String(this.fillStyle)); },
    stroke() { rec.strokes.push({ color: String(this.strokeStyle), width: this.lineWidth }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rec };
}

const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4, canvasW: 1080, canvasH: 1920 };
const input: SceneInput = {
  location: { lat: 14.6, lng: 120.98, label: "Manila" },
  shape: "square", style: "atlas", marker: "solid", zoom: "district",
  rotation: 0, labels: false, layout: "classic",
};
const tri = (x: number, y: number): [number, number][] => [[x, y], [x + 0.1, y], [x + 0.1, y + 0.1]];

const geom: ProjectedMapGeometry = {
  bbox: [120.97, 14.59, 120.99, 14.61],
  rotation: 0,
  roads: [
    { class: "motorway", points: [[0.2, 0.3], [0.5, 0.5], [0.8, 0.7]] },
    { class: "residential", points: [[0.3, 0.4], [0.4, 0.5], [0.45, 0.62]] },
  ],
  water: [], waterways: [], parks: [],
  built: [{ points: tri(0.3, 0.3) }],
  green: [{ points: tri(0.5, 0.5) }],
  labels: [],
};

describe("renderMap land layers and casings", () => {
  it("fills built-up and green land with the theme's colours", () => {
    const { ctx, rec } = recorder();
    renderMap(ctx, geom, MAP_THEMES.atlas, input, viewport, 1080, 1920);
    expect(rec.fills).toContain(MAP_THEMES.atlas.built);
    expect(rec.fills).toContain(MAP_THEMES.atlas.green);
  });

  it("skips those layers for themes that don't define them", () => {
    const { ctx, rec } = recorder();
    renderMap(ctx, geom, MAP_THEMES.classic, { ...input, style: "classic" }, viewport, 1080, 1920);
    expect(rec.fills).not.toContain(MAP_THEMES.atlas.built);
  });

  it("strokes a wider casing before the road itself", () => {
    const { ctx, rec } = recorder();
    renderMap(ctx, geom, MAP_THEMES.atlas, input, viewport, 1080, 1920);
    const mw = MAP_THEMES.atlas.road.motorway;
    const cs = MAP_THEMES.atlas.casing!.motorway!;
    const casingAt = rec.strokes.findIndex((s) => s.color === cs.color && s.width === mw.width + cs.extra);
    const roadAt = rec.strokes.findIndex((s) => s.color === mw.color && s.width === mw.width);
    expect(casingAt).toBeGreaterThanOrEqual(0);
    expect(roadAt).toBeGreaterThan(casingAt);
  });
});

describe("renderMap reveal animation", () => {
  const at = (reveal?: number) => {
    const { ctx, rec } = recorder();
    renderMap(ctx, geom, MAP_THEMES.atlas, input, { ...viewport, reveal }, 1080, 1920);
    return rec;
  };

  it("traces no roads at 0, part of them early on, and matches the static render at 1", () => {
    const none = at(0);
    const half = at(0.1);
    const full = at(1);
    expect(none.strokes.filter((s) => s.color === MAP_THEMES.atlas.road.motorway.color)).toHaveLength(0);
    expect(half.lineTos).toBeGreaterThan(none.lineTos);
    expect(half.lineTos).toBeLessThan(full.lineTos);
    expect(full).toEqual(at(undefined));
  });

  it("drops the pin in only at the end", () => {
    expect(at(0.5).fills.length).toBeLessThan(at(1).fills.length);
  });
});

describe("renderMap pin position", () => {
  it("anchors the pin tip at the slot centre by default", () => {
    const { ctx, rec } = recorder();
    renderMap(ctx, geom, MAP_THEMES.atlas, input, viewport, 1080, 1920);
    expect(rec.translates).toContainEqual([540, 960]);
  });

  it("anchors the pin on its own lat/lng when it has one, following pan", () => {
    const pin = { lat: 14.595, lng: 120.975 };
    const vp = { ...viewport, panX: 0.05, panY: -0.02 };
    const { ctx, rec } = recorder();
    renderMap(ctx, geom, MAP_THEMES.atlas, { ...input, pin }, vp, 1080, 1920);
    const [nx, ny] = projectLatLng(geom.bbox, vp, 0, pin.lat, pin.lng);
    const [tx, ty] = rec.translates[rec.translates.length - 2];
    expect(tx).toBeCloseTo(nx * 1080, 6);
    expect(ty).toBeCloseTo(ny * 1920, 6);
  });
});
