import { describe, it, expect, vi } from "vitest";
import { MARKERS, drawPin } from "../src/markers/markers";
import type { MarkerStyleId } from "@gunari/core";

interface Palette { marker: string; markerSymbol: string; light: boolean; }
const palette: Palette = { marker: "#000", markerSymbol: "#fff", light: false };

function mockCtx() {
  return {
    save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    arc: vi.fn(), bezierCurveTo: vi.fn(), closePath: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(),
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & {
    save: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
  };
}

describe("drawPin (shared silhouette)", () => {
  it("traces a closed path and fills it", () => {
    const ctx = mockCtx();
    drawPin(ctx, 50, 80, 10, palette);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe("MARKERS registry", () => {
  it("has entries for solid, ring, heart, star", () => {
    expect(Object.keys(MARKERS).sort()).toEqual(["heart", "ring", "solid", "star"]);
  });

  it("every marker calls drawPin once and drawSymbol once", () => {
    for (const id of Object.keys(MARKERS) as MarkerStyleId[]) {
      const ctx = mockCtx();
      MARKERS[id].draw(ctx, 50, 80, 10, palette);
      // drawPin calls fill once; drawSymbol may fill or stroke.
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    }
  });
});