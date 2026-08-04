import type { FrameId, ThemePalette } from "../types";

export interface FrameStyle {
  id: FrameId;
  label: string;
  /** Content padding (fraction of canvas short edge). Frame strokes are drawn at the canvas edge, independent of this padding. */
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
  // Content padding — independent of frame position. Frame strokes are
  // drawn at the canvas edge, offset inward by half their stroke width so
  // the full stroke sits inside the canvas (no clipping).
  const m = style.margin * Math.min(W, H);

  ctx.save();
  // Outer rail — at the canvas edge (2px safety inset so the stroke's
  // anti-aliased outer pixels stay fully inside the canvas)
  if (style.rail > 0) {
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = style.rail;
    const off = style.rail / 2 + 2;
    ctx.strokeRect(off, off, W - 2 * off, H - 2 * off);
  }
  // Inner keyline — just inside the rail
  if (style.keyline > 0) {
    ctx.strokeStyle = palette.compass;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = style.keyline;
    const railW = style.rail > 0 ? style.rail : 0;
    const off = railW + 4 + style.keyline / 2 + 2;
    ctx.strokeRect(off, off, W - 2 * off, H - 2 * off);
  }
  // Corner ticks — at the canvas corners
  if (style.corner === "tick") {
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.2;
    const t = 16;
    const off = 6;
    const corners: [number, number, number, number][] = [
      [off, off, 1, 1],
      [W - off, off, -1, 1],
      [off, H - off, 1, -1],
      [W - off, H - off, -1, -1],
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

  return { inner: { x: m, y: m, w: W - 2 * m, h: H - 2 * m } };
}