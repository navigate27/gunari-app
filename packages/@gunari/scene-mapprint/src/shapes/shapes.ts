import { applyShapeMask, type ShapeId } from "@gunari/core";

export interface ShapePath {
  /** Trace the shape clip path on ctx and call ctx.clip(). */
  apply(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void;
}

function makeShape(shape: "square" | "circle" | "heart"): ShapePath {
  return {
    apply(ctx, cx, cy, r) {
      applyShapeMask(ctx, shape, cx, cy, r);
    },
  };
}

export const SHAPES: Record<ShapeId, ShapePath> = {
  square: makeShape("square"),
  circle: makeShape("circle"),
  heart: makeShape("heart"),
};