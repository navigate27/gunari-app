import { describe, it, expect, vi } from "vitest";
import { renderScaffold, type ScaffoldInput } from "../src/artwork/scaffold";
import { artworkLayout, blendLayouts } from "../src/artwork/formats";
import type { ThemePalette } from "../src/theme/theme";

/** A canvas stand-in where every glyph is half an em wide, recording each fillText. */
function ctxWithMetrics() {
  const drawn: { text: string; size: number; y: number; maxW?: number }[] = [];
  const ctx = {
    font: "",
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1, textAlign: "", textBaseline: "",
    save() {}, restore() {}, fillRect() {}, strokeRect() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText(t: string) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
      return { width: t.length * px * 0.5 };
    },
    fillText(text: string, _x: number, y: number, maxW?: number) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 10);
      drawn.push({ text, size: px, y, maxW });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn };
}

const palette: ThemePalette = {
  id: "t", label: "T", background: { top: "#fff", bottom: "#eee" },
  title: "#000", message: "#333", meta: "#666", accent: "#999", light: true,
};

const base = (title: string, extra: Partial<ScaffoldInput> = {}): ScaffoldInput => ({
  layout: "classic",
  title,
  meta: { date: "", time: "", location: "Manila" },
  palette,
  scene: { render: vi.fn() as never },
  sceneGeometry: {},
  scenePalette: palette,
  sceneInput: {
    location: { lat: 0, lng: 0, label: "x" }, shape: "square", style: "classic", marker: "solid",
    zoom: "district", rotation: 0, labels: false, layout: "classic",
  },
  sceneViewport: { cx: 0.5, cy: 0.5, r: 0.4 },
  ...extra,
});

const titleLines = (drawn: ReturnType<typeof ctxWithMetrics>["drawn"]) =>
  drawn.filter((d) => d.y < 800);

describe("title fitting", () => {
  it("draws a short title at full size, untouched", () => {
    const { ctx, drawn } = ctxWithMetrics();
    renderScaffold(ctx, base("Under the stars"));
    const [t] = titleLines(drawn);
    expect(t.text).toBe("Under the stars");
    expect(t.size).toBe(78);
  });

  it("never squeezes the letters: no maxWidth is passed to fillText", () => {
    const { ctx, drawn } = ctxWithMetrics();
    renderScaffold(ctx, base("The night asked, we answered and the sky agreed with every word"));
    expect(drawn.every((d) => d.maxW === undefined)).toBe(true);
  });

  it("shrinks a slightly long title to fit on one line", () => {
    const { ctx, drawn } = ctxWithMetrics();
    renderScaffold(ctx, base("The night we said yes"));
    const lines = titleLines(drawn);
    expect(lines).toHaveLength(1);
    expect(lines[0].size).toBeLessThan(78);
    expect(lines[0].text.length * lines[0].size * 0.5).toBeLessThanOrEqual(920 * 0.82 + 1);
  });

  it("breaks a very long title over two balanced lines that each fit", () => {
    const { ctx, drawn } = ctxWithMetrics();
    renderScaffold(ctx, base("The night asked and we answered with everything we had ever wanted to say"));
    const lines = titleLines(drawn);
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.text.length * l.size * 0.5).toBeLessThanOrEqual(920 * 0.82 + 1);
    expect(lines[1].y).toBeGreaterThan(lines[0].y);
    expect(lines.map((l) => l.text).join(" ")).toBe("The night asked and we answered with everything we had ever wanted to say");
  });
});

describe("blendLayouts", () => {
  const story = artworkLayout("story", "classic");
  const wide = artworkLayout("landscape", "classic");

  it("returns the endpoints exactly", () => {
    expect(blendLayouts(story, wide, 0)).toBe(story);
    expect(blendLayouts(story, wide, 1)).toBe(wide);
  });

  it("moves the canvas size, the map slot and the text together", () => {
    const mid = blendLayouts(story, wide, 0.5);
    expect(mid.w).toBeCloseTo((story.w + wide.w) / 2, 6);
    expect(mid.h).toBeCloseTo((story.h + wide.h) / 2, 6);
    expect(mid.slot.canvasW).toBeCloseTo(mid.w, 6);
    const px = (l: typeof story) => l.slot.cx * l.w;
    expect(px(mid)).toBeCloseTo((px(story) + px(wide)) / 2, 6);
    expect(mid.title.x).toBeCloseTo((story.title.x + wide.title.x) / 2, 6);
  });

  it("lets the scaffold render a frame partway through a change", () => {
    const { ctx } = ctxWithMetrics();
    const spec = blendLayouts(story, wide, 0.5);
    const render = vi.fn();
    renderScaffold(ctx, base("Hi", { layoutSpec: spec, scene: { render: render as never } }));
    expect(render.mock.calls[0].slice(-2)).toEqual([spec.w, spec.h]);
  });
});

describe("location line", () => {
  it("is left out when the address label is cleared", () => {
    const { ctx, drawn } = ctxWithMetrics();
    renderScaffold(ctx, { ...base("Hi"), meta: { date: "", time: "", location: "" } });
    expect(drawn.map((d) => d.text)).toEqual(["Hi", "GUNARI"]);
  });
});
