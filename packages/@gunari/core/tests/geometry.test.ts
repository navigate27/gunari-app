import { describe, it, expect, vi } from "vitest";
import { bboxClip } from "../src/geometry/bbox-clip";
import { simplifyLine } from "../src/geometry/simplify";
import { rotatePoints } from "../src/geometry/rotate";
import { webMercator, normalizeToViewport } from "../src/geometry/project";
import { applyShapeMask } from "../src/geometry/mask";

describe("bboxClip", () => {
  it("clips a line to the bbox", () => {
    const pts: [number, number][] = [[0, 0], [10, 10], [20, 20]];
    const bbox: [number, number, number, number] = [5, 5, 15, 15];
    const out = bboxClip(pts, bbox);
    expect(out.length).toBeGreaterThan(0);
    for (const [x, y] of out) {
      expect(x).toBeGreaterThanOrEqual(5);
      expect(x).toBeLessThanOrEqual(15);
      expect(y).toBeGreaterThanOrEqual(5);
      expect(y).toBeLessThanOrEqual(15);
    }
  });
  it("returns empty when line is entirely outside the bbox", () => {
    const pts: [number, number][] = [[100, 100], [200, 200]];
    const bbox: [number, number, number, number] = [0, 0, 10, 10];
    expect(bboxClip(pts, bbox)).toHaveLength(0);
  });
});

describe("simplifyLine", () => {
  it("reduces a collinear polyline to two endpoints", () => {
    const pts: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3]];
    const out = simplifyLine(pts, 0.01);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([3, 3]);
  });
  it("preserves a zigzag with tolerance below the deviation", () => {
    const pts: [number, number][] = [[0, 0], [1, 5], [2, 0], [3, 5], [4, 0]];
    const out = simplifyLine(pts, 0.01);
    expect(out.length).toBe(5);
  });
});

describe("rotatePoints", () => {
  it("rotates a point 90° around the origin", () => {
    const out = rotatePoints([[1, 0]], 0, 0, Math.PI / 2);
    expect(out[0][0]).toBeCloseTo(0, 6);
    expect(out[0][1]).toBeCloseTo(1, 6);
  });
  it("rotates around an arbitrary center", () => {
    const out = rotatePoints([[2, 0]], 1, 0, Math.PI / 2);
    expect(out[0][0]).toBeCloseTo(1, 6);
    expect(out[0][1]).toBeCloseTo(1, 6);
  });
  it("leaves the center point unchanged", () => {
    const out = rotatePoints([[5, 5]], 5, 5, Math.PI);
    expect(out[0]).toEqual([5, 5]);
  });
});

describe("webMercator", () => {
  it("maps (0, 0) to (0, 0)", () => {
    const { x, y } = webMercator(0, 0);
    expect(x).toBeCloseTo(0, 2);
    expect(y).toBeCloseTo(0, 2);
  });
  it("maps the equator at lng 90 to roughly 10,000,000 m east", () => {
    const { x } = webMercator(0, 90);
    expect(x).toBeCloseTo(10_018_754, -2);
  });
});

describe("normalizeToViewport", () => {
  const bbox = [120.95, 14.58, 121.02, 14.63] as [number, number, number, number];
  it("maps the bbox min corner to [0, 0]", () => {
    const { x, y } = webMercator(14.58, 120.95);
    const [nx, ny] = normalizeToViewport(x, y, bbox);
    expect(nx).toBeCloseTo(0, 6);
    expect(ny).toBeCloseTo(0, 6);
  });
  it("maps the bbox max corner to [1, 1]", () => {
    const { x, y } = webMercator(14.63, 121.02);
    const [nx, ny] = normalizeToViewport(x, y, bbox);
    expect(nx).toBeCloseTo(1, 6);
    expect(ny).toBeCloseTo(1, 6);
  });
  it("maps the bbox center to ~[0.5, 0.5]", () => {
    // x is linear in lng so center lng maps to exactly 0.5. y is nonlinear
    // (Mercator) so center lat does NOT map to exactly 0.5; use 4 decimal
    // places tolerance for the small-bbox near-linearity.
    const { x, y } = webMercator(14.605, 120.985);
    const [nx, ny] = normalizeToViewport(x, y, bbox);
    expect(nx).toBeCloseTo(0.5, 6);
    expect(ny).toBeCloseTo(0.5, 4);
  });
});

describe("applyShapeMask", () => {
  function mockCtx() {
    return {
      beginPath: vi.fn(),
      rect: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
    } as unknown as CanvasRenderingContext2D & { beginPath: ReturnType<typeof vi.fn> };
  }
  it("square: traces a rect and clips", () => {
    const ctx = mockCtx();
    applyShapeMask(ctx, "square", 10, 20, 5);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.rect).toHaveBeenCalledWith(5, 15, 10, 10);
    expect(ctx.clip).toHaveBeenCalled();
  });
  it("circle: traces an arc and clips", () => {
    const ctx = mockCtx();
    applyShapeMask(ctx, "circle", 10, 20, 5);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });
  it("heart: traces beziers and clips", () => {
    const ctx = mockCtx();
    applyShapeMask(ctx, "heart", 10, 20, 5);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });
});