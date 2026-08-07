import { describe, it, expect, vi } from "vitest";
import { SHAPES } from "../src/shapes/shapes";
import type { ShapeId } from "@gunari/core";

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

describe("SHAPES registry", () => {
  it("has entries for square, circle, heart", () => {
    expect(Object.keys(SHAPES).sort()).toEqual(["circle", "heart", "square"]);
  });

  it("square traces a rect", () => {
    const ctx = mockCtx();
    SHAPES.square.apply(ctx, 10, 20, 5);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.rect).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });

  it("circle traces an arc", () => {
    const ctx = mockCtx();
    SHAPES.circle.apply(ctx, 10, 20, 5);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });

  it("heart traces beziers", () => {
    const ctx = mockCtx();
    SHAPES.heart.apply(ctx, 10, 20, 5);
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });

  it("every entry is a function", () => {
    for (const id of Object.keys(SHAPES) as ShapeId[]) {
      expect(typeof SHAPES[id].apply).toBe("function");
    }
  });
});