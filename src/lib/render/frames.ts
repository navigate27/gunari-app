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
    margin: 0.025,
    keyline: 0,
    rail: 0,
    corner: "none",
  },
  classic: {
    id: "classic",
    label: "Classic",
    margin: 0.025,
    keyline: 1.2,
    rail: 0.4,
    corner: "tick",
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    margin: 0.025,
    keyline: 0.8,
    rail: 0,
    corner: "none",
  },
  aurora: {
    id: "aurora",
    label: "Aurora",
    margin: 0.025,
    keyline: 0,
    rail: 1.6,
    corner: "none",
  },
  ornate: {
    id: "ornate",
    label: "Ornate",
    margin: 0.025,
    keyline: 0,
    rail: 0,
    corner: "none",
  },
  filigree: {
    id: "filigree",
    label: "Filigree",
    margin: 0.025,
    keyline: 0,
    rail: 0,
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
  // Uniform content padding for all frames (including blank) so the content
  // never appears to resize when switching frame styles. Frame strokes are
  // drawn at the inner edge of this margin, hugging the content.
  const m = style.margin * Math.min(W, H);
  const ix = m;
  const iy = m;
  const iw = W - 2 * m;
  const ih = H - 2 * m;

  if (style.id !== "blank") {
    ctx.save();

    if (style.id === "ornate") {
      drawOrnate(ctx, ix, iy, iw, ih, palette);
    } else if (style.id === "filigree") {
      drawFiligree(ctx, ix, iy, iw, ih, palette);
    } else {
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
    }

    ctx.restore();
  }

  return { inner: { x: ix, y: iy, w: iw, h: ih } };
}

/**
 * Ornate frame: triple rail + L-brackets with serifs at each corner +
 * small dot ornaments at the midpoint of each edge.
 */
function drawOrnate(
  ctx: CanvasRenderingContext2D,
  ix: number,
  iy: number,
  iw: number,
  ih: number,
  palette: ThemePalette
) {
  // Triple rail
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(ix, iy, iw, ih);
  ctx.strokeRect(ix + 4, iy + 4, iw - 8, ih - 8);
  ctx.strokeRect(ix + 8, iy + 8, iw - 16, ih - 16);

  // L-brackets with serifs at each corner
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 1.2;
  const arm = 26;
  const serif = 6;
  const off = 14;
  const corners: [number, number, number, number][] = [
    [ix, iy, 1, 1],
    [ix + iw, iy, -1, 1],
    [ix, iy + ih, 1, -1],
    [ix + iw, iy + ih, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    // Horizontal arm
    ctx.moveTo(x + dx * off, y + dy * off);
    ctx.lineTo(x + dx * (off + arm), y + dy * off);
    // Vertical arm
    ctx.moveTo(x + dx * off, y + dy * off);
    ctx.lineTo(x + dx * off, y + dy * (off + arm));
    // Serifs at arm ends
    ctx.moveTo(x + dx * (off + arm), y + dy * (off - serif));
    ctx.lineTo(x + dx * (off + arm), y + dy * (off + serif));
    ctx.moveTo(x + dx * (off - serif), y + dy * (off + arm));
    ctx.lineTo(x + dx * (off + serif), y + dy * (off + arm));
    ctx.stroke();
  }

  // Dot ornaments at edge midpoints
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.9;
  const dotR = 2.5;
  const mids: [number, number][] = [
    [ix + iw / 2, iy],
    [ix + iw / 2, iy + ih],
    [ix, iy + ih / 2],
    [ix + iw, iy + ih / 2],
  ];
  for (const [x, y] of mids) {
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Filigree frame: outer rail + inner keyline + diamond ornaments at each
 * corner + small tick marks spaced along all four edges.
 */
function drawFiligree(
  ctx: CanvasRenderingContext2D,
  ix: number,
  iy: number,
  iw: number,
  ih: number,
  palette: ThemePalette
) {
  // Outer rail (gold accent)
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 0.6;
  ctx.strokeRect(ix, iy, iw, ih);

  // Inner keyline (compass color)
  ctx.strokeStyle = palette.compass;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(ix + 6, iy + 6, iw - 12, ih - 12);

  // Diamond ornaments at corners
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.95;
  const dR = 5;
  const corners: [number, number][] = [
    [ix, iy],
    [ix + iw, iy],
    [ix, iy + ih],
    [ix + iw, iy + ih],
  ];
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y - dR);
    ctx.lineTo(x + dR, y);
    ctx.lineTo(x, y + dR);
    ctx.lineTo(x - dR, y);
    ctx.closePath();
    ctx.fill();
  }

  // Tick marks along edges (every 10% of edge length, skipping corners)
  ctx.strokeStyle = palette.compass;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.5;
  const tickLen = 4;
  const tickInset = 2;
  for (let i = 1; i < 10; i++) {
    const x = ix + (iw * i) / 10;
    const y = iy + (ih * i) / 10;
    // Top edge
    ctx.beginPath();
    ctx.moveTo(x, iy + tickInset);
    ctx.lineTo(x, iy + tickInset + tickLen);
    ctx.stroke();
    // Bottom edge
    ctx.beginPath();
    ctx.moveTo(x, iy + ih - tickInset);
    ctx.lineTo(x, iy + ih - tickInset - tickLen);
    ctx.stroke();
    // Left edge
    ctx.beginPath();
    ctx.moveTo(ix + tickInset, y);
    ctx.lineTo(ix + tickInset + tickLen, y);
    ctx.stroke();
    // Right edge
    ctx.beginPath();
    ctx.moveTo(ix + iw - tickInset, y);
    ctx.lineTo(ix + iw - tickInset - tickLen, y);
    ctx.stroke();
  }
}