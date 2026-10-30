import { describe, it, expect } from "vitest";
import { renderMap } from "../src/render/render";
import { MAP_THEMES, poiColors } from "../src/styles/themes";
import { projectLatLng } from "../src/projection/frame";
import type { ProjectedMapGeometry } from "../src/projection/types";
import type { SceneInput, SceneViewport } from "@gunari/core";

interface Rec {
  fills: string[];
  strokes: { color: string; width: number }[];
  translates: [number, number][];
  lineTos: number;
  stops: string[];
  texts: string[];
}

function recorder() {
  const rec: Rec = { fills: [], strokes: [], translates: [], lineTos: 0, stops: [], texts: [] };
  const ctx = {
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    shadowColor: "", shadowBlur: 0, shadowOffsetY: 0, lineCap: "", lineJoin: "",
    font: "", textAlign: "", textBaseline: "",
    save() {}, restore() {}, beginPath() {}, closePath() {}, clip() {}, rect() {}, arc() {},
    moveTo() {}, bezierCurveTo() {}, scale() {}, strokeText() {},
    fillText(t: string) { rec.texts.push(t); },
    lineTo() { rec.lineTos++; },
    translate(x: number, y: number) { rec.translates.push([x, y]); },
    createLinearGradient: () => ({ addColorStop(_o: number, c: string) { rec.stops.push(c); } }),
    fillRect() {},
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

  it("shows the pin whole during the reveal when pinDrop is off", () => {
    const { ctx, rec } = recorder();
    renderMap(ctx, geom, MAP_THEMES.atlas, input, { ...viewport, reveal: 0.3, pinDrop: false }, 1080, 1920);
    const dropped = at(0.3);
    expect(rec.fills.length).toBeGreaterThan(dropped.fills.length);
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

describe("renderMap background", () => {
  it("paints the map's own background from the map theme, not the card", () => {
    const { ctx, rec } = recorder();
    renderMap(ctx, geom, MAP_THEMES.nocturne, { ...input, style: "nocturne" }, viewport, 1080, 1920);
    expect(rec.stops.slice(0, 2)).toEqual([MAP_THEMES.nocturne.background.top, MAP_THEMES.nocturne.background.bottom]);
  });
});

describe("renderMap labels", () => {
  const labelGeom: ProjectedMapGeometry = {
    ...geom,
    labels: [
      { text: "Binondo", x: 0.5, y: 0.5, class: "place" },
      { text: "Intramuros", x: 0.502, y: 0.501, class: "place" },
      { text: "Ermita", x: 0.3, y: 0.3, class: "place" },
      { text: "Nowhere", x: 0, y: 0, class: "road" },
    ],
  };

  it("draws labels that fit, skips ones that collide, and skips unplaced ones", () => {
    const { ctx, rec } = recorder();
    renderMap(ctx, labelGeom, MAP_THEMES.atlas, { ...input, labels: true }, viewport, 1080, 1920);
    expect(rec.texts).toEqual(["Binondo", "Ermita"]);
  });
});

describe("renderMap stroke scale", () => {
  const widthOfMotorway = (zoomScale: number) => {
    const { ctx, rec } = recorder();
    renderMap(ctx, { ...geom, zoomScale }, MAP_THEMES.atlas, input, viewport, 1080, 1920);
    return rec.strokes.find((s) => s.color === MAP_THEMES.atlas.road.motorway.color)!.width;
  };

  it("thickens roads when zoomed in, thins them when zoomed out, within limits", () => {
    const base = MAP_THEMES.atlas.road.motorway.width;
    expect(widthOfMotorway(1)).toBeCloseTo(base, 6);
    expect(widthOfMotorway(4)).toBeCloseTo(base * 2, 6);
    expect(widthOfMotorway(100)).toBeCloseTo(base * 2.2, 6);
    expect(widthOfMotorway(0.1)).toBeCloseTo(base * 0.85, 6);
  });
});

describe("renderMap named places", () => {
  const poiGeom: ProjectedMapGeometry = {
    ...geom,
    pois: [
      { name: "Rizal Museum", category: "landmarks", x: 0.5, y: 0.45 },
      { name: "Aling Nena", category: "food", x: 0.4, y: 0.55 },
      { name: "Mercury Drug", category: "shops", x: 0.6, y: 0.55 },
      { name: "Too far away", category: "food", x: 0.99, y: 0.01 },
    ],
  };
  const draw = (places: SceneInput["places"], style: "atlas" | "ink" = "atlas") => {
    const { ctx, rec } = recorder();
    renderMap(ctx, poiGeom, MAP_THEMES[style], { ...input, style, places }, viewport, 1080, 1920);
    return rec;
  };

  it("draws nothing unless categories are chosen", () => {
    expect(draw(undefined).texts).toEqual([]);
    expect(draw([]).texts).toEqual([]);
  });

  it("draws only the chosen categories, skipping places outside the map shape", () => {
    expect(draw(["food"]).texts).toEqual(["Aling Nena"]);
    expect(draw(["landmarks", "shops"]).texts.sort()).toEqual(["Mercury Drug", "Rizal Museum"]);
  });

  it("colours dots by kind from the theme, or one colour for monochrome styles", () => {
    expect(draw(["food"]).fills).toContain(poiColors(MAP_THEMES.atlas).food);
    expect(draw(["food"], "ink").fills).toContain(MAP_THEMES.ink.poiColor);
    expect(draw(["food"], "ink").fills).not.toContain(poiColors(MAP_THEMES.atlas).food);
  });

  it("drops a place whose dot would sit on one already drawn", () => {
    const { ctx, rec } = recorder();
    renderMap(
      ctx,
      { ...poiGeom, pois: [
        { name: "First", category: "food", x: 0.5, y: 0.5 },
        { name: "Second", category: "food", x: 0.5005, y: 0.5 },
      ] },
      MAP_THEMES.atlas, { ...input, places: ["food"] }, viewport, 1080, 1920,
    );
    expect(rec.texts).toEqual(["First"]);
  });
});
