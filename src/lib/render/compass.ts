import type { CompassStyleId, ThemePalette } from "../types";

export interface CompassStyle {
  id: CompassStyleId;
  label: string;
  /** Draw the compass ring around a circular star chart. */
  draw: (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rOuter: number,
    rInner: number,
    palette: ThemePalette
  ) => void;
}

export const COMPASS_STYLES: Record<CompassStyleId, CompassStyle> = {
  blank: {
    id: "blank",
    label: "Blank",
    draw: () => {},
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    draw: (ctx, cx, cy, rOuter, rInner, p) => {
      const mid = (rOuter + rInner) / 2;
      ctx.save();
      ctx.translate(cx, cy);

      // Hairline ring
      ctx.strokeStyle = p.compass;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, rInner, 0, Math.PI * 2);
      ctx.stroke();

      // 72 minor ticks (every 5°)
      ctx.globalAlpha = 0.4;
      for (let deg = 0; deg < 360; deg += 5) {
        const a = (deg - 90) * (Math.PI / 180);
        const major = deg % 30 === 0;
        const tick = major ? 8 : 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rOuter, Math.sin(a) * rOuter);
        ctx.lineTo(
          Math.cos(a) * (rOuter - tick),
          Math.sin(a) * (rOuter - tick)
        );
        ctx.stroke();
      }

      // Cardinal letters
      ctx.fillStyle = p.compassLabel;
      ctx.globalAlpha = 1;
      ctx.font = `500 ${Math.round(mid * 0.18)}px "Cormorant Garamond", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labels: [string, number][] = [
        ["N", -90],
        ["E", 0],
        ["S", 90],
        ["W", 180],
      ];
      for (const [text, deg] of labels) {
        const a = (deg * Math.PI) / 180;
        ctx.fillText(text, Math.cos(a) * mid, Math.sin(a) * mid);
      }
      ctx.restore();
    },
  },
  "compass-rose": {
    id: "compass-rose",
    label: "Compass Rose",
    draw: (ctx, cx, cy, rOuter, rInner, p) => {
      const mid = (rOuter + rInner) / 2;
      ctx.save();
      ctx.translate(cx, cy);

      // Outer + inner rings
      ctx.strokeStyle = p.compass;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, rOuter, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, rInner, 0, Math.PI * 2);
      ctx.stroke();

      // Degree ticks every 2°
      ctx.globalAlpha = 0.35;
      for (let deg = 0; deg < 360; deg += 2) {
        const a = (deg - 90) * (Math.PI / 180);
        const major = deg % 30 === 0;
        const med = deg % 10 === 0;
        const tick = major ? 10 : med ? 6 : 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rOuter, Math.sin(a) * rOuter);
        ctx.lineTo(
          Math.cos(a) * (rOuter - tick),
          Math.sin(a) * (rOuter - tick)
        );
        ctx.stroke();
      }

      // Eight-point rose at center of ring
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = p.compassLabel;
      ctx.lineWidth = 1;
      const roseR = mid * 0.45;
      const points = 8;
      for (let i = 0; i < points; i++) {
        const a = (i / points) * Math.PI * 2 - Math.PI / 2;
        const long = i % 2 === 0 ? 1 : 0.55;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * roseR * long, Math.sin(a) * roseR * long);
        ctx.stroke();
      }
      // Small fleur at N
      ctx.fillStyle = p.accent;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(0, -roseR * 1.05);
      ctx.lineTo(roseR * 0.18, 0);
      ctx.lineTo(0, -roseR * 0.25);
      ctx.lineTo(-roseR * 0.18, 0);
      ctx.closePath();
      ctx.fill();

      // Cardinal labels
      ctx.fillStyle = p.compassLabel;
      ctx.globalAlpha = 1;
      ctx.font = `500 ${Math.round(mid * 0.18)}px "Cormorant Garamond", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labels: [string, number][] = [
        ["N", -90],
        ["E", 0],
        ["S", 90],
        ["W", 180],
      ];
      for (const [text, deg] of labels) {
        const a = (deg * Math.PI) / 180;
        ctx.fillText(text, Math.cos(a) * mid, Math.sin(a) * mid);
      }
      ctx.restore();
    },
  },
};

export function getCompass(id: CompassStyleId): CompassStyle {
  return COMPASS_STYLES[id];
}