"use client";

import * as Astronomy from "astronomy-engine";
import type {
  CelestialContext,
  CelestialGridLine,
  MilkyWayRing,
  StarRecord,
  VisibleStar,
} from "../types";

const DEG = Math.PI / 180;

export interface SkyState {
  ctx: CelestialContext;
  stars: VisibleStar[];
  moon?: MoonState;
  milkyWay?: MilkyWayRing[];
  celestialGrid?: CelestialGridLine[];
}

export interface MoonState {
  /** Phase 0..1 (0 = new, 0.5 = full). */
  phase: number;
  /** Illuminated fraction 0..1. */
  illumination: number;
  /** Canvas position x in [0,1]. */
  x: number;
  /** Canvas position y in [0,1]. */
  y: number;
  /** Apparent magnitude. */
  mag: number;
}

/**
 * Compute Local Sidereal Time (hours) for a UTC date and observer longitude.
 */
export function localSiderealTime(date: Date, lng: number): number {
  const time = new Astronomy.AstroTime(date);
  const gmst = Astronomy.SiderealTime(time);
  const lst = (gmst + lng / 15) % 24;
  return lst < 0 ? lst + 24 : lst;
}

/**
 * Convert equatorial (RA hours, Dec degrees) to horizontal (alt, az degrees),
 * for a given LST (hours) and observer latitude (degrees).
 */
export function equatorialToHorizontal(
  raHours: number,
  decDeg: number,
  lstHours: number,
  latDeg: number
): { alt: number; az: number } {
  const ha = ((lstHours - raHours) % 24) * 15 * DEG; // hour angle in radians
  const dec = decDeg * DEG;
  const lat = latDeg * DEG;

  const sinAlt =
    Math.sin(lat) * Math.sin(dec) +
    Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const alt = Math.asin(clamp1(sinAlt));

  const cosAz =
    (Math.sin(dec) - Math.sin(lat) * sinAlt) / (Math.cos(lat) * Math.cos(alt));
  const azRaw = Math.acos(clamp1(cosAz));
  const az = Math.sin(ha) > 0 ? 2 * Math.PI - azRaw : azRaw;
  return { alt: (alt * 180) / Math.PI, az: (az * 180) / Math.PI };
}

/**
 * Stereographic projection of (alt, az) looking up at the zenith.
 * Center = zenith. Zenith distance θ (0 at top, 90° at horizon).
 * r = tan(θ/2) mapped onto [0, 1] radius. We map horizon to r = 1.
 * Returns x,y in [0,1] canvas coordinates (y down).
 */
export function projectAltAz(
  altDeg: number,
  azDeg: number,
  rotationRad: number
): { x: number; y: number; visible: boolean } {
  const theta = (90 - altDeg) * DEG; // zenith distance
  const r = Math.tan(theta / 2); // 0 at zenith, 1 at horizon, +inf below
  if (r > 1.4) return { x: 0.5, y: 0.5, visible: false };
  const az = azDeg * DEG + rotationRad;
  // North up convention: az measured from north, going east.
  const x = 0.5 + r * Math.sin(az);
  const y = 0.5 - r * Math.cos(az);
  return { x, y, visible: r <= 1 };
}

function clamp1(v: number): number {
  return Math.min(1, Math.max(-1, v));
}

/**
 * Compute apparent magnitude → brightness 0..1 with subtle nonlinear curve.
 */
export function magnitudeToBrightness(mag: number): number {
  // Sirius ≈ -1.46, faintest visible ≈ 7.0. Map [−2, 7.0] → [1, 0].
  const t = (mag - -2) / (7.0 - -2);
  const clamped = Math.min(1, Math.max(0, t));
  // Bright stars pop, faint stars stay visible — gentler gamma plus a small
  // floor so the new fainter end of the catalog actually renders as a dot.
  return Math.pow(1 - clamped, 1.25) * 0.95 + 0.05;
}

/**
 * Build the full sky state for a given context and catalog.
 * If `milkyway` is provided, each polygon ring is projected through the same
 * alt-az transform as the stars and included in the returned state.
 */
export function computeSky(
  ctx: CelestialContext,
  catalog: StarRecord[],
  milkyway?: { level: number; polygons: number[][][] }[]
): SkyState {
  const lst =
    ctx.lstOverride != null ? ctx.lstOverride : localSiderealTime(ctx.date, ctx.lng);
  const visible: VisibleStar[] = [];

  for (const s of catalog) {
    const { alt, az } = equatorialToHorizontal(s.ra, s.dec, lst, ctx.lat);
    const { x, y, visible: vis } = projectAltAz(alt, az, ctx.rotation);
    if (!vis) continue;
    visible.push({
      ...s,
      x,
      y,
      b: magnitudeToBrightness(s.mag),
    });
  }

  // Project Milky Way polygons. Each polygon point is [ra_hours, dec_deg].
  // We project through the same pipeline as stars; polygons where every point
  // is below the horizon are skipped. Points just below the horizon (r ≤ 1.4)
  // are kept so the chart-circle clip produces a clean horizon edge instead
  // of a hard gap.
  let milkyWay: MilkyWayRing[] | undefined;
  if (milkyway && milkyway.length > 0) {
    milkyWay = [];
    for (const lvl of milkyway) {
      for (const ring of lvl.polygons) {
        const pts: { x: number; y: number }[] = [];
        let anyVisible = false;
        let allFar = true;
        for (const [ra, dec] of ring) {
          const { alt, az } = equatorialToHorizontal(ra, dec, lst, ctx.lat);
          const theta = (90 - alt) * DEG;
          const r = Math.tan(theta / 2);
          if (r <= 1.4) allFar = false;
          if (r > 1.4) {
            // Clamp to just below horizon so the polygon keeps its shape;
            // the chart-circle clip will cut off the invisible part.
            const az2 = az * DEG + ctx.rotation;
            pts.push({
              x: 0.5 + 1.4 * Math.sin(az2),
              y: 0.5 - 1.4 * Math.cos(az2),
            });
          } else {
            const az2 = az * DEG + ctx.rotation;
            pts.push({
              x: 0.5 + r * Math.sin(az2),
              y: 0.5 - r * Math.cos(az2),
            });
            if (r <= 1) anyVisible = true;
          }
        }
        if (!allFar && pts.length >= 3) {
          milkyWay.push({ level: lvl.level, points: pts });
        }
      }
    }
    if (milkyWay.length === 0) milkyWay = undefined;
  }

  // Celestial grid: RA meridians (every 1h) and Dec parallels (every 15°).
  // Sample densely so the curves stay smooth through the stereographic
  // projection, especially near the horizon.
  const grid: CelestialGridLine[] = [];
  const projectPt = (ra: number, dec: number): { x: number; y: number; vis: boolean } => {
    const { alt, az } = equatorialToHorizontal(ra, dec, lst, ctx.lat);
    const theta = (90 - alt) * DEG;
    const r = Math.tan(theta / 2);
    const az2 = az * DEG + ctx.rotation;
    if (r > 1.4) {
      return {
        x: 0.5 + 1.4 * Math.sin(az2),
        y: 0.5 - 1.4 * Math.cos(az2),
        vis: false,
      };
    }
    return { x: 0.5 + r * Math.sin(az2), y: 0.5 - r * Math.cos(az2), vis: r <= 1 };
  };

  // RA lines: 24 meridians, Dec sampled from -85° to +85° every 1°.
  for (let ra = 0; ra < 24; ra++) {
    const pts: { x: number; y: number }[] = [];
    let anyVis = false;
    for (let dec = -85; dec <= 85; dec += 1) {
      const p = projectPt(ra, dec);
      pts.push({ x: p.x, y: p.y });
      if (p.vis) anyVis = true;
    }
    if (anyVis) grid.push({ type: "ra", value: ra, points: pts });
  }

  // Dec lines: parallels every 15° from -75° to +75°, RA sampled every 0.2h.
  for (let dec = -75; dec <= 75; dec += 15) {
    const pts: { x: number; y: number }[] = [];
    let anyVis = false;
    for (let ra = 0; ra < 24; ra += 0.2) {
      const p = projectPt(ra, dec);
      pts.push({ x: p.x, y: p.y });
      if (p.vis) anyVis = true;
    }
    if (anyVis) grid.push({ type: "dec", value: dec, points: pts });
  }

  let moon: MoonState | undefined;
  try {
    moon = computeMoon(ctx, lst);
  } catch {
    moon = undefined;
  }

  return { ctx, stars: visible, moon, milkyWay, celestialGrid: grid };
}

function computeMoon(ctx: CelestialContext, lst: number): MoonState | undefined {
  const time = new Astronomy.AstroTime(ctx.date);
  const observer = new Astronomy.Observer(ctx.lat, ctx.lng, 0);
  const equ = Astronomy.Equator(Astronomy.Body.Moon, time, observer, true, true);
  const { alt, az } = equatorialToHorizontal(
    equ.ra / 15,
    equ.dec,
    lst,
    ctx.lat
  );
  const p = Astronomy.Illumination(Astronomy.Body.Moon, time);
  const proj = projectAltAz(alt, az, ctx.rotation);
  if (!proj.visible) return undefined;
  return {
    phase: p.phase_angle / 360,
    illumination: p.mag < 0 ? 0.5 : p.mag, // approx
    x: proj.x,
    y: proj.y,
    mag: p.mag,
  };
}