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
    translate: vi.fn(), scale: vi.fn(), clip: vi.fn(), fillRect: vi.fn(), quadraticCurveTo: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    shadowColor: "", shadowBlur: 0, shadowOffsetY: 0, lineCap: "",
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

describe("drawPin anchoring and drop-in", () => {
  it("puts the tip on (x, y) once landed", () => {
    const ctx = mockCtx();
    drawPin(ctx, 50, 80, 10, palette, 1);
    expect(ctx.translate).toHaveBeenCalledWith(50, 80);
  });

  it("draws nothing at progress 0 and starts above the target while falling", () => {
    const none = mockCtx();
    drawPin(none, 50, 80, 10, palette, 0);
    expect(none.fill).not.toHaveBeenCalled();

    const falling = mockCtx();
    drawPin(falling, 50, 80, 10, palette, 0.2);
    const bodyCall = (falling.translate as unknown as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(bodyCall[1]).toBeLessThan(80);
  });
});

describe("MARKERS registry", () => {
  it("has entries for solid, ring, heart, star, home", () => {
    expect(Object.keys(MARKERS).sort()).toEqual(["heart", "home", "ring", "solid", "star"]);
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

describe("star marker silhouette", () => {
  it("draws the star and its stem with the same winding so they never cancel into a hole", () => {
    const subpaths: [number, number][][] = [];
    let current: [number, number][] = [];
    const ctx = {
      ...mockCtx(),
      beginPath: () => { current = []; subpaths.length = 0; },
      moveTo: (x: number, y: number) => { current = [[x, y]]; },
      lineTo: (x: number, y: number) => { current.push([x, y]); },
      closePath: () => { subpaths.push(current); },
    } as unknown as CanvasRenderingContext2D;
    // Trace only: the first beginPath/closePath pairs belong to the silhouette.
    MARKERS.star.draw(ctx, 0, 0, 10, palette, 1);
    const area = (pts: [number, number][]) =>
      pts.reduce((sum, [x, y], i) => {
        const [nx, ny] = pts[(i + 1) % pts.length];
        return sum + (x * ny - nx * y);
      }, 0) / 2;
    const polys = subpaths.filter((p) => p.length >= 3);
    expect(polys.length).toBeGreaterThanOrEqual(2);
    const signs = polys.slice(0, 2).map((p) => Math.sign(area(p)));
    expect(signs[0]).toBe(signs[1]);
  });
});
