import type { ThemePalette } from "../theme/theme";
import type { ArtworkLayout } from "./formats";

/** Frames drawn around the whole card, behind the map and text. */
export type ArtworkFrameId = "none" | "line" | "mat" | "rounded" | "brackets" | "stamp";

export const FRAME_ORDER: readonly ArtworkFrameId[] = ["none", "line", "mat", "rounded", "brackets", "stamp"];

export const FRAME_LABELS: Record<ArtworkFrameId, string> = {
  none: "None",
  line: "Line",
  mat: "Mat",
  rounded: "Rounded",
  brackets: "Brackets",
  stamp: "Stamp",
};

/** Mix a #rrggbb colour toward white (amount > 0) or black (amount < 0). */
function mix(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const target = amount >= 0 ? 255 : 0;
  const k = Math.abs(amount);
  const f = (c: number) => Math.round(c + (target - c) * k);
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function drawCardFrame(
  ctx: CanvasRenderingContext2D,
  L: ArtworkLayout,
  p: ThemePalette,
  frame: ArtworkFrameId
): void {
  if (frame === "none") return;
  const { x, y, w, h } = L.inner;
  const short = Math.min(w, h);
  ctx.save();

  if (frame === "line") {
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  } else if (frame === "rounded") {
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 2;
    roundedRectPath(ctx, x, y, w, h, short * 0.07);
    ctx.stroke();
  } else if (frame === "brackets") {
    const len = short * 0.1;
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.lineCap = "square";
    const corners: [number, number, number, number][] = [
      [x, y, 1, 1],
      [x + w, y, -1, 1],
      [x, y + h, 1, -1],
      [x + w, y + h, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * len, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * len);
      ctx.stroke();
    }
  } else if (frame === "mat") {
    // A mat board: a tinted band around the card with a bevelled opening.
    ctx.fillStyle = p.light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.rect(0, 0, L.w, L.h);
    ctx.rect(x, y, w, h);
    ctx.fill("evenodd");
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = p.light ? "#000000" : "#ffffff";
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
  } else {
    // Stamp: a sheet with perforated edges on a darker backing.
    const backing = mix(p.background.bottom, p.light ? -0.14 : 0.12);
    ctx.fillStyle = backing;
    ctx.fillRect(0, 0, L.w, L.h);
    const inset = 22;
    const px = inset;
    const py = inset;
    const pw = L.w - inset * 2;
    const ph = L.h - inset * 2;
    const g = ctx.createLinearGradient(0, 0, 0, L.h);
    g.addColorStop(0, p.background.top);
    g.addColorStop(1, p.background.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(px, py, pw, ph);
    // Perforations: half circles bitten out of the sheet's edge.
    const r = 9;
    ctx.fillStyle = backing;
    const along = (len: number) => {
      const n = Math.max(2, Math.round(len / 38));
      return Array.from({ length: n + 1 }, (_, i) => (len * i) / n);
    };
    for (const t of along(pw)) {
      for (const yy of [py, py + ph]) {
        ctx.beginPath();
        ctx.arc(px + t, yy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const t of along(ph)) {
      for (const xx of [px, px + pw]) {
        ctx.beginPath();
        ctx.arc(xx, py + t, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.strokeRect(x, y, w, h);
  }

  ctx.restore();
}
