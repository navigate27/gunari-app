import type { LayoutId, SceneViewport } from "../scene/types";

export type FormatId = "story" | "square" | "landscape";

export interface ArtworkFormat {
  id: FormatId;
  label: string;
  w: number;
  h: number;
}

export const FORMATS: Record<FormatId, ArtworkFormat> = {
  story: { id: "story", label: "Story", w: 1080, h: 1920 },
  square: { id: "square", label: "Square", w: 1080, h: 1080 },
  landscape: { id: "landscape", label: "Landscape", w: 1920, h: 1080 },
};

export const FORMAT_ORDER: readonly FormatId[] = ["story", "square", "landscape"];

/** Inner canvas region after the frame border. */
export const MARGIN = 80;

export interface TextSpot {
  x: number;
  y: number;
  maxW: number;
}

export interface ArtworkLayout {
  /** Canvas size this layout is for. */
  w: number;
  h: number;
  inner: { x: number; y: number; w: number; h: number };
  /** Font sizes derive from the shorter inner side so type stays the same across formats. */
  base: number;
  /** The scene slot, canvas-normalized, with the canvas size it is relative to. */
  slot: SceneViewport;
  title: TextSpot;
  message: TextSpot;
  meta: TextSpot;
  wordmark: TextSpot;
}

interface Spec {
  /** Slot center x/y as a fraction of the canvas, radius in px. */
  slot: { cx: number; cy: number; rPx: number };
  /** Text column center x in px; baselines as fractions of inner height. */
  textX: number;
  textW: number;
  title: number;
  message: number;
  meta: number;
}

const SPECS: Record<FormatId, Record<LayoutId, Spec>> = {
  story: {
    classic: { slot: { cx: 0.5, cy: 0.5, rPx: 432 }, textX: 540, textW: 920, title: 0.16, message: 0.22, meta: 0.9 },
    poster: { slot: { cx: 0.5, cy: 0.5, rPx: 453.6 }, textX: 540, textW: 920, title: 0.76, message: 0.82, meta: 0.92 },
  },
  square: {
    classic: { slot: { cx: 0.5, cy: 0.5444, rPx: 240 }, textX: 540, textW: 920, title: 0.15, message: 0.21, meta: 0.89 },
    poster: { slot: { cx: 0.5, cy: 0.3704, rPx: 270 }, textX: 540, textW: 920, title: 0.74, message: 0.81, meta: 0.89 },
  },
  landscape: {
    classic: { slot: { cx: 0.2698, cy: 0.5, rPx: 389 }, textX: 1373, textW: 860, title: 0.42, message: 0.5, meta: 0.6 },
    poster: { slot: { cx: 0.7302, cy: 0.5, rPx: 389 }, textX: 536, textW: 860, title: 0.42, message: 0.5, meta: 0.6 },
  },
};

export function artworkLayout(format: FormatId, layout: LayoutId): ArtworkLayout {
  const { w, h } = FORMATS[format];
  const inner = { x: MARGIN, y: MARGIN, w: w - MARGIN * 2, h: h - MARGIN * 2 };
  const base = Math.min(inner.w, inner.h);
  const s = SPECS[format][layout];
  const at = (frac: number) => inner.y + inner.h * frac;
  return {
    w,
    h,
    inner,
    base,
    slot: {
      cx: s.slot.cx,
      cy: s.slot.cy,
      r: s.slot.rPx / Math.min(w, h),
      canvasW: w,
      canvasH: h,
    },
    title: { x: s.textX, y: at(s.title), maxW: s.textW * 0.82 },
    message: { x: s.textX, y: at(s.message), maxW: s.textW * 0.78 },
    meta: { x: s.textX, y: at(s.meta), maxW: s.textW * 0.9 },
    wordmark: { x: s.textX, y: inner.y + inner.h - 24, maxW: s.textW },
  };
}


const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpSpot = (a: TextSpot, b: TextSpot, t: number): TextSpot => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  maxW: lerp(a.maxW, b.maxW, t),
});

/**
 * A layout partway between two others (t = 0 is `a`, t = 1 is `b`), for
 * animating a change of format or layout. The canvas size, the map slot and
 * every text position move together, in pixels.
 */
export function blendLayouts(a: ArtworkLayout, b: ArtworkLayout, t: number): ArtworkLayout {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const w = lerp(a.w, b.w, t);
  const h = lerp(a.h, b.h, t);
  const min = Math.min(w, h);
  const inner = { x: MARGIN, y: MARGIN, w: w - MARGIN * 2, h: h - MARGIN * 2 };
  const px = (l: ArtworkLayout) => ({
    cx: l.slot.cx * l.w,
    cy: l.slot.cy * l.h,
    r: l.slot.r * Math.min(l.w, l.h),
  });
  const sa = px(a);
  const sb = px(b);
  return {
    w,
    h,
    inner,
    base: Math.min(inner.w, inner.h),
    slot: {
      cx: lerp(sa.cx, sb.cx, t) / w,
      cy: lerp(sa.cy, sb.cy, t) / h,
      r: lerp(sa.r, sb.r, t) / min,
      canvasW: w,
      canvasH: h,
    },
    title: lerpSpot(a.title, b.title, t),
    message: lerpSpot(a.message, b.message, t),
    meta: lerpSpot(a.meta, b.meta, t),
    wordmark: lerpSpot(a.wordmark, b.wordmark, t),
  };
}
