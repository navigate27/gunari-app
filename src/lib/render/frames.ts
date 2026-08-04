import type { FrameId, ThemePalette } from "../types";

export interface FrameStyle {
  id: FrameId;
  label: string;
  /** Outer margin (fraction of canvas short edge). Frame is drawn at the inner edge of this margin, hugging the content. */
  margin: number;
  /** Stroke width of inner keyline (px at 1080 wide). */
  keyline: number;
  /** Stroke width of outer rail (px at 1080 wide). 0 = none. */
  rail: number;
  /** Corner ornament style. */
  corner: "none" | "tick" | "notch";
}

export const FRAMES: Record<FrameId, FrameStyle> = {
  blank: {
    id: "blank",
    label: "Blank",
    margin: 0,
    keyline: 0,
    rail: 0,
    corner: "none",
  },
  classic: {
    id: "classic",
    label: "Classic",
    margin: 0.04,
    keyline: 1.2,
    rail: 0.4,
    corner: "tick",
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    margin: 0.06,
    keyline: 0.8,
    rail: 0,
    corner: "none",
  },
  aurora: {
    id: "aurora",
    label: "Aurora",
    margin: 0.04,
    keyline: 0,
    rail: 1.6,
    corner: "none",
  },
};

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  style: FrameStyle,
  palette: ThemePalette
): { inner: { x: number; y: number; w: number; h: number } } {
  if (style.id === "blank") {
    return { inner: { x: 0, y: 0, w: W, h: H } };
  }
  // Frame is drawn at the inner edge of the margin — hugging the content.
  // The margin is the space between the canvas edge and the frame.
  const m = style.margin * Math.min(W, H);
  const ix = m;
  const iy = m;
  const iw = W - 2 * m;
  const ih = H - 2 * m;

  ctx.save();
  // Outer hairline (rail) — at the content boundary
  if (style.rail > 0) {
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = style.rail;
    ctx.strokeRect(ix, iy, iw, ih);
  }
  // Inner keyline — just inside the rail
  if (style.keyline > 0) {
    ctx.strokeStyle = palette.compass;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = style.keyline;
    const inset = 4;
    ctx.strokeRect(ix + inset, iy + inset, iw - 2 * inset, ih - 2 * inset);
  }
  // Corner ticks — at the content boundary corners
  if (style.corner === "tick") {
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.2;
    const t = 16;
    const corners: [number, number, number, number][] = [
      [ix, iy, 1, 1],
      [ix + iw, iy, -1, 1],
      [ix, iy + ih, 1, -1],
      [ix + iw, iy + ih, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + dx * 6, y);
      ctx.lineTo(x + dx * (6 + t), y);
      ctx.moveTo(x, y + dy * 6);
      ctx.lineTo(x, y + dy * (6 + t));
      ctx.stroke();
    }
  }
  ctx.restore();

  return { inner: { x: ix, y: iy, w: iw, h: ih } };
}