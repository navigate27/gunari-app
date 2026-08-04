export type ThemeId =
  | "blank"
  | "midnight"
  | "obsidian"
  | "ivory"
  | "slate"
  | "twilight"
  | "aurora"
  | "moonlight"
  | "cosmos"
  | "dusk";

export type FrameId = "blank" | "classic" | "midnight" | "aurora" | "ornate" | "filigree";

export type CompassStyleId = "blank" | "minimal" | "instrument";

export type StarChartStyleId = "astronomical" | "dreamscape";

export interface GunariInput {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: GunariLocation;
  title: string;
  message?: string;
  theme: ThemeId;
  frame: FrameId;
  compass: CompassStyleId;
  starChart: StarChartStyleId;
  moon: boolean;
}

export interface GunariLocation {
  label: string;
  lat: number;
  lng: number;
}

export interface StarRecord {
  /** Right ascension in hours (0–24). */
  ra: number;
  /** Declination in degrees (−90 to +90). */
  dec: number;
  /** Apparent visual magnitude. */
  mag: number;
  /** Optional Hipparcos catalog id. */
  hip?: number;
  /** Optional Bayer / Flamsteed designation. */
  name?: string;
  /** B-V color index (roughly −0.3 hot/blue to +2.0 cool/red). */
  bv?: number;
}

export interface ThemePalette {
  id: ThemeId;
  label: string;
  /** Canvas background gradient stops (top → bottom). */
  canvas: { top: string; bottom: string };
  /** Circular star-chart surface gradient (center → edge). */
  chart: { center: string; edge: string };
  /** Star fill base color (tinted by theme). */
  star: string;
  /** Constellation line color (alpha applied by renderer). */
  constellation: string;
  /** Compass ring color. */
  compass: string;
  /** Compass label color. */
  compassLabel: string;
  /** Title text color. */
  title: string;
  /** Message text color (slightly muted). */
  message: string;
  /** Metadata text color (date / time / location). */
  meta: string;
  /** Accent used on wordmark + fine details. */
  accent: string;
  /** Whether the chart surface is light (affects star sizing). */
  light: boolean;
}

export interface VisibleStar extends StarRecord {
  /** Projected canvas X in [0,1]. */
  x: number;
  /** Projected canvas Y in [0,1]. */
  y: number;
  /** Normalized brightness 0..1 (already magnitude-clamped). */
  b: number;
}

export interface CelestialContext {
  /** Observer latitude, degrees. */
  lat: number;
  /** Observer longitude, degrees. */
  lng: number;
  /** UTC date the sky is rendered for. */
  date: Date;
  /** Sidereal-like rotation applied to projection, in radians. */
  rotation: number;
  /**
   * Optional override for Local Sidereal Time (in hours, 0–24).
   * When set, the engine uses this directly instead of computing from
   * date + lng. Used by the live preview to animate the sky between states.
   */
  lstOverride?: number;
}