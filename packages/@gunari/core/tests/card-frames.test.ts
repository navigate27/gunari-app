import { describe, it, expect, vi } from "vitest";
import { FRAME_LABELS, FRAME_ORDER, drawCardFrame, type ArtworkFrameId } from "../src/artwork/card-frames";
import { artworkLayout } from "../src/artwork/formats";
import type { ThemePalette } from "../src/theme/theme";

function recorder() {
  const calls: string[] = [];
  const ctx = {
    fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1, lineCap: "",
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    beginPath: () => calls.push("beginPath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    arcTo: () => calls.push("arcTo"),
    arc: () => calls.push("arc"),
    closePath: () => calls.push("closePath"),
    rect: () => calls.push("rect"),
    fill: (rule?: string) => calls.push(rule ? `fill:${rule}` : "fill"),
    stroke: () => calls.push("stroke"),
    strokeRect: () => calls.push("strokeRect"),
    fillRect: () => calls.push("fillRect"),
    setLineDash: () => calls.push("dash"),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const light: ThemePalette = {
  id: "l", label: "L", background: { top: "#fafafa", bottom: "#eeeeee" },
  title: "#111111", message: "#333333", meta: "#666666", accent: "#9a8a5a", light: true,
};
const dark: ThemePalette = { ...light, background: { top: "#10131a", bottom: "#07080b" }, light: false };
const L = artworkLayout("story", "classic");

describe("drawCardFrame", () => {
  it("lists six distinct, labelled frames, none first", () => {
    expect(FRAME_ORDER).toHaveLength(6);
    expect(FRAME_ORDER[0]).toBe("none");
    expect(new Set(FRAME_ORDER.map((id) => FRAME_LABELS[id])).size).toBe(6);
  });

  it("draws nothing for none", () => {
    const { ctx, calls } = recorder();
    drawCardFrame(ctx, L, light, "none");
    expect(calls).toEqual([]);
  });

  it("draws a single hairline for line", () => {
    const { ctx, calls } = recorder();
    drawCardFrame(ctx, L, light, "line");
    expect(calls.filter((c) => c === "strokeRect")).toHaveLength(1);
  });

  it("traces a rounded outline with arcs", () => {
    const { ctx, calls } = recorder();
    drawCardFrame(ctx, L, light, "rounded");
    expect(calls.filter((c) => c === "arcTo")).toHaveLength(4);
  });

  it("draws four L-shaped brackets", () => {
    const { ctx, calls } = recorder();
    drawCardFrame(ctx, L, light, "brackets");
    expect(calls.filter((c) => c === "stroke")).toHaveLength(4);
    expect(calls.filter((c) => c === "lineTo")).toHaveLength(8);
  });

  it("fills a band around the opening for mat, leaving the opening clear", () => {
    const { ctx, calls } = recorder();
    drawCardFrame(ctx, L, dark, "mat");
    expect(calls).toContain("fill:evenodd");
    expect(calls.filter((c) => c === "rect")).toHaveLength(2);
  });

  it("perforates the edge for stamp and ends with a dashed rule", () => {
    const { ctx, calls } = recorder();
    drawCardFrame(ctx, L, light, "stamp");
    expect(calls.filter((c) => c === "arc").length).toBeGreaterThan(30);
    expect(calls).toContain("dash");
  });

  it("leaves the context state as it found it", () => {
    for (const id of FRAME_ORDER as readonly ArtworkFrameId[]) {
      const { ctx, calls } = recorder();
      drawCardFrame(ctx, L, light, id);
      expect(calls.filter((c) => c === "save").length).toBe(calls.filter((c) => c === "restore").length);
    }
  });
});
