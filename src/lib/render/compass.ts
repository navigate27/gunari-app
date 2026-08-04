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
  instrument: {
    id: "instrument",
    label: "Instrument",
    draw: (ctx, cx, cy, rOuter, rInner, p) => {
      const band = rOuter - rInner;
      if (band <= 0) return;
      ctx.save();
      ctx.translate(cx, cy);

      const GOLD = "#C9A35A";

      // Three radial bands (inner → outer):
      //   tickRing : rInner .. tickOuter   — 1°/5°/10° precision ticks
      //   degRing  : tickOuter .. degOuter — degree labels every 10°
      //   cardRing : degOuter .. rOuter    — cardinal + intercardinal labels
      const tickOuter = rInner + band * 0.38;
      const degOuter = rInner + band * 0.72;
      const tickBaseR = rInner;

      // --- Gold accent ring (between compass and star map) ---
      ctx.strokeStyle = GOLD;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, rInner, 0, Math.PI * 2);
      ctx.stroke();
      // Soft metallic halo just inside the gold ring
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, rInner - 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // --- Inner precision tick ring ---
      // Boundary hairline at tickOuter
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = p.compass;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, tickOuter, 0, Math.PI * 2);
      ctx.stroke();

      // 360 ticks: 1° minor, 5° medium, 10° major
      for (let deg = 0; deg < 360; deg++) {
        const a = (deg - 90) * (Math.PI / 180);
        const isMajor = deg % 10 === 0;
        const isMed = !isMajor && deg % 5 === 0;
        const len = isMajor ? 11 : isMed ? 7 : 4;
        const r0 = tickBaseR;
        const r1 = r0 + len;
        ctx.globalAlpha = isMajor ? 0.85 : isMed ? 0.5 : 0.28;
        ctx.lineWidth = isMajor ? 0.8 : 0.45;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
      }

      // --- Middle degree label ring (every 10°) ---
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = p.compass;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, degOuter, 0, Math.PI * 2);
      ctx.stroke();

      // Degree labels sit 70% of the way from tickOuter to degOuter — pushed
      // outward from the tick ring for more breathing room (40% more gap than
      // a centered placement).
      const degR = tickOuter + (degOuter - tickOuter) * 0.7;
      const degFontSize = Math.max(8, Math.round(band * 0.14));
      ctx.fillStyle = p.compassLabel;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let deg = 0; deg < 360; deg += 10) {
        const a = (deg - 90) * (Math.PI / 180);
        const label = String(deg).padStart(3, "0");
        ctx.globalAlpha = 0.72;
        ctx.font = `400 ${degFontSize}px "Geist", ui-sans-serif, sans-serif`;
        ctx.fillText(
          label,
          Math.cos(a) * degR,
          Math.sin(a) * degR
        );
      }

      // --- Outer cardinal / intercardinal labels (floating, no ring) ---
      const cardR = rOuter;
      const cardLabels = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
      ];
      for (let i = 0; i < 16; i++) {
        const deg = i * 22.5;
        const a = (deg - 90) * (Math.PI / 180);
        const isCardinal = deg % 90 === 0;
        const isIntercardinal = !isCardinal && deg % 45 === 0;
        const fontSize = Math.round(
          band * (isCardinal ? 0.34 : isIntercardinal ? 0.24 : 0.18)
        );
        const weight = isCardinal ? 600 : isIntercardinal ? 500 : 400;
        ctx.globalAlpha = isCardinal ? 1 : isIntercardinal ? 0.88 : 0.68;
        ctx.fillStyle = isCardinal ? GOLD : p.compassLabel;
        ctx.font = `${weight} ${fontSize}px "Geist", ui-sans-serif, sans-serif`;
        ctx.fillText(
          cardLabels[i],
          Math.cos(a) * cardR,
          Math.sin(a) * cardR
        );
      }

      ctx.restore();
    },
  },
};

export function getCompass(id: CompassStyleId): CompassStyle {
  return COMPASS_STYLES[id];
}