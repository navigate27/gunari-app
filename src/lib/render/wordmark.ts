import type { ThemePalette } from "../types";

export function drawWordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  palette: ThemePalette
) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.75;
  ctx.font = `400 ${Math.round(22)}px "Cormorant Garamond", serif`;
  ctx.fillText("GUNARI", cx, y, 120);
  // Tiny flourish
  ctx.globalAlpha = 0.45;
  ctx.font = `300 ${Math.round(10)}px "Geist", sans-serif`;
  ctx.fillText("·  every night tells a story  ·", cx, y + 14, 220);
  ctx.restore();
}