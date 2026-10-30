import type { MapStyleId, PlaceCategory, ThemePalette } from "@gunari/core";
import type { RoadClass } from "../interpret/types";

export interface MapThemePalette extends ThemePalette {
  id: MapStyleId;
  /** Per-class road color + width (px at 1080w canvas). */
  road: Record<RoadClass, { color: string; width: number }>;
  /** Water polygon fill. */
  water: string;
  /** Waterway (river line) stroke. */
  waterway: string;
  /** Park polygon fill. */
  park: string;
  /** Marker pin silhouette color. */
  marker: string;
  /** Marker inner symbol color. */
  markerSymbol: string;
  /** Label text color. */
  labelColor: string;
  /** Built-up land fill. Omitted = not drawn. */
  built?: string;
  /** Woods, grass and farmland fill. Omitted = not drawn. */
  green?: string;
  /** Outline drawn under a road class, `extra` px wider than the road itself. */
  casing?: Partial<Record<RoadClass, { color: string; extra: number }>>;
  /** Waterway stroke width in px at 1080w. Default 2. */
  waterwayWidth?: number;
  /** One colour for every place dot, instead of a colour per kind (for monochrome styles). */
  poiColor?: string;
  /** Place dot colours that differ from the light/dark defaults. */
  poi?: Partial<Record<PlaceCategory, string>>;
}

export const MAP_THEMES: Record<MapStyleId, MapThemePalette> = {
  classic: {
    id: "classic",
    label: "Classic",
    background: { top: "#f7f5f1", bottom: "#ece8e1" },
    road: {
      motorway:    { color: "#1c1d22", width: 3.6 },
      trunk:       { color: "#1c1d22", width: 3.2 },
      primary:     { color: "#3b3a35", width: 2.6 },
      secondary:   { color: "#3b3a35", width: 2.0 },
      tertiary:    { color: "#5b5b5b", width: 1.4 },
      residential: { color: "#7a7a7a", width: 0.9 },
      path:        { color: "#9a9a9a", width: 0.6 },
    },
    poi: { food: "#b5532c", shops: "#3a6aa6", landmarks: "#a8322d", lodging: "#6b4aa3", community: "#2d7a57" },
    water: "#cfd6dc",
    waterway: "#9aa8b5",
    park: "#d4dcc6",
    marker: "#1c1d22",
    markerSymbol: "#f7f5f1",
    labelColor: "#3b3a35",
    title: "#1c1d22",
    message: "#3b3a35",
    meta: "#5b5b5b",
    accent: "#9a8a5a",
    light: true,
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    background: { top: "#070b18", bottom: "#02040a" },
    road: {
      motorway:    { color: "#f4f6fb", width: 3.6 },
      trunk:       { color: "#f4f6fb", width: 3.2 },
      primary:     { color: "#cdd5ee", width: 2.6 },
      secondary:   { color: "#cdd5ee", width: 2.0 },
      tertiary:    { color: "#a9b4d4", width: 1.4 },
      residential: { color: "#7d8298", width: 0.9 },
      path:        { color: "#5b6178", width: 0.6 },
    },
    water: "#0a1226",
    waterway: "#3a4a6a",
    park: "#0d1a14",
    marker: "#f4f6fb",
    markerSymbol: "#070b18",
    labelColor: "#cdd5ee",
    title: "#eef1fb",
    message: "#c8cce0",
    meta: "#8d96b8",
    accent: "#c9a96a",
    light: false,
  },
  blueprint: {
    id: "blueprint",
    label: "Blueprint",
    background: { top: "#0d2444", bottom: "#061a36" },
    road: {
      motorway:    { color: "#9ecbff", width: 3.4 },
      trunk:       { color: "#9ecbff", width: 3.0 },
      primary:     { color: "#79b2e8", width: 2.4 },
      secondary:   { color: "#79b2e8", width: 1.8 },
      tertiary:    { color: "#5a92c4", width: 1.3 },
      residential: { color: "#3f7aa8", width: 0.9 },
      path:        { color: "#2c5f8c", width: 0.6 },
    },
    poi: { food: "#ffd166", shops: "#9ecbff", landmarks: "#ff8fa3", lodging: "#c9b6ff", community: "#7ee8c1" },
    water: "#1a3a5e",
    waterway: "#5a92c4",
    park: "#14304a",
    marker: "#9ecbff",
    markerSymbol: "#061a36",
    labelColor: "#9ecbff",
    title: "#cfe2ff",
    message: "#9ecbff",
    meta: "#5a92c4",
    accent: "#79b2e8",
    light: false,
  },
  paper: {
    id: "paper",
    label: "Paper",
    background: { top: "#f4ede0", bottom: "#e8dec6" },
    road: {
      motorway:    { color: "#2a2a2a", width: 3.0 },
      trunk:       { color: "#2a2a2a", width: 2.6 },
      primary:     { color: "#3d3d3d", width: 2.0 },
      secondary:   { color: "#3d3d3d", width: 1.6 },
      tertiary:    { color: "#555", width: 1.1 },
      residential: { color: "#777", width: 0.7 },
      path:        { color: "#999", width: 0.5 },
    },
    poi: { food: "#b5532c", shops: "#3a6aa6", landmarks: "#a8322d", lodging: "#6b4aa3", community: "#2d7a57" },
    water: "#c4d0d8",
    waterway: "#a4b4c0",
    park: "#d6dcc8",
    marker: "#2a2a2a",
    markerSymbol: "#f4ede0",
    labelColor: "#3d3d3d",
    title: "#1a1c22",
    message: "#3a3528",
    meta: "#6b6452",
    accent: "#9a7b3a",
    light: true,
  },
  twilight: {
    id: "twilight",
    label: "Twilight",
    background: { top: "#1a1140", bottom: "#0c0a1f" },
    road: {
      motorway:    { color: "#f6ecff", width: 3.4 },
      trunk:       { color: "#e6d8ff", width: 3.0 },
      primary:     { color: "#d6c3f0", width: 2.4 },
      secondary:   { color: "#b89ed6", width: 1.8 },
      tertiary:    { color: "#9a87c2", width: 1.3 },
      residential: { color: "#7a6798", width: 0.9 },
      path:        { color: "#5a4a7a", width: 0.6 },
    },
    poi: { food: "#ffb86b", shops: "#8fb4ff", landmarks: "#ff8aa8", lodging: "#e0a6ff", community: "#7ee0c0" },
    water: "#1f1a40",
    waterway: "#5a4a7a",
    park: "#2a1a3c",
    marker: "#f6ecff",
    markerSymbol: "#1a1140",
    labelColor: "#e6d8ff",
    title: "#f6ecff",
    message: "#d6c3f0",
    meta: "#9a87c2",
    accent: "#d9a6ff",
    light: false,
  },

  atlas: {
    id: "atlas",
    label: "Atlas",
    background: { top: "#fffdf0", bottom: "#fff8de" },
    road: {
      motorway:    { color: "#f6a04a", width: 4.6 },
      trunk:       { color: "#f9b960", width: 4.0 },
      primary:     { color: "#fbd488", width: 3.4 },
      secondary:   { color: "#fdeaa8", width: 2.6 },
      tertiary:    { color: "#ffffff", width: 2.0 },
      residential: { color: "#ffffff", width: 1.5 },
      path:        { color: "#d4cfc0", width: 0.7 },
    },
    casing: {
      motorway:    { color: "#dd8a2a", extra: 1.4 },
      trunk:       { color: "#e0a04a", extra: 1.3 },
      primary:     { color: "#e6bd6a", extra: 1.2 },
      secondary:   { color: "#e8d08a", extra: 1.1 },
      tertiary:    { color: "#cfcabb", extra: 1.0 },
      residential: { color: "#d8d3c4", extra: 0.9 },
    },
    water: "#8cc4ee",
    waterway: "#6fb0e8",
    waterwayWidth: 3,
    park: "#cfe6b8",
    green: "#e3edd3",
    built: "#ebe7dc",
    marker: "#e0463a",
    markerSymbol: "#ffffff",
    labelColor: "#5b5648",
    title: "#34312a",
    message: "#5b5648",
    meta: "#7a7566",
    accent: "#d99a3d",
    light: true,
  },
  ink: {
    id: "ink",
    label: "Ink",
    background: { top: "#ffffff", bottom: "#f4f4f4" },
    road: {
      motorway:    { color: "#111111", width: 4.8 },
      trunk:       { color: "#111111", width: 4.2 },
      primary:     { color: "#1a1a1a", width: 3.4 },
      secondary:   { color: "#1a1a1a", width: 2.4 },
      tertiary:    { color: "#222222", width: 1.6 },
      residential: { color: "#333333", width: 1.0 },
      path:        { color: "#666666", width: 0.6 },
    },
    casing: {
      motorway: { color: "#9a9a9a", extra: 1.6 },
      trunk:    { color: "#aaaaaa", extra: 1.4 },
    },
    water: "#151515",
    waterway: "#111111",
    waterwayWidth: 3.4,
    poiColor: "#111111",
    park: "#e4e4e4",
    green: "#efefef",
    marker: "#111111",
    markerSymbol: "#ffffff",
    labelColor: "#222222",
    title: "#0d0d0d",
    message: "#333333",
    meta: "#666666",
    accent: "#111111",
    light: true,
  },
  mist: {
    id: "mist",
    label: "Mist",
    background: { top: "#f7f7f8", bottom: "#eeeef0" },
    road: {
      motorway:    { color: "#a6a6ad", width: 3.6 },
      trunk:       { color: "#c4c4ca", width: 3.0 },
      primary:     { color: "#ffffff", width: 3.0 },
      secondary:   { color: "#ffffff", width: 2.4 },
      tertiary:    { color: "#ffffff", width: 1.8 },
      residential: { color: "#ffffff", width: 1.3 },
      path:        { color: "#e4e4e8", width: 0.6 },
    },
    casing: {
      primary:     { color: "#d9d9de", extra: 1.0 },
      secondary:   { color: "#dedee3", extra: 0.9 },
      tertiary:    { color: "#e4e4e8", extra: 0.8 },
      residential: { color: "#e8e8ec", extra: 0.7 },
    },
    poi: { food: "#e08a5a", shops: "#6f94d8", landmarks: "#d9706b", lodging: "#9a7bd0", community: "#5aa882" },
    water: "#e6eaf2",
    waterway: "#c9bdd9",
    waterwayWidth: 1.6,
    park: "#dde9d8",
    green: "#e6eee2",
    built: "#eaeaed",
    marker: "#5c6074",
    markerSymbol: "#ffffff",
    labelColor: "#6b6c78",
    title: "#34353d",
    message: "#5a5b66",
    meta: "#8b8c99",
    accent: "#a3a4b3",
    light: true,
  },
  nocturne: {
    id: "nocturne",
    label: "Nocturne",
    background: { top: "#1d2a4c", bottom: "#141d38" },
    road: {
      motorway:    { color: "#4a86e0", width: 4.4 },
      trunk:       { color: "#5592e4", width: 3.8 },
      primary:     { color: "#6a9fe6", width: 3.2 },
      secondary:   { color: "#7d8fb4", width: 2.4 },
      tertiary:    { color: "#8a7a62", width: 1.8 },
      residential: { color: "#7a6850", width: 1.3 },
      path:        { color: "#5d5040", width: 0.7 },
    },
    casing: {
      motorway: { color: "#2a5aa8", extra: 1.4 },
      trunk:    { color: "#2f63b0", extra: 1.2 },
      primary:  { color: "#38629f", extra: 1.1 },
    },
    water: "#16203d",
    waterway: "#2b4c82",
    waterwayWidth: 2.2,
    park: "#1d4150",
    green: "#1f3b4d",
    built: "#26365f",
    marker: "#f0a24f",
    markerSymbol: "#1d2a4c",
    labelColor: "#aebce0",
    title: "#e3ebff",
    message: "#aebce0",
    meta: "#7f90bd",
    accent: "#e0a458",
    light: false,
  },
  lagoon: {
    id: "lagoon",
    label: "Lagoon",
    background: { top: "#f5fbfd", bottom: "#eaf4f8" },
    road: {
      motorway:    { color: "#b4b4b6", width: 4.2 },
      trunk:       { color: "#bcbcbe", width: 3.6 },
      primary:     { color: "#c3c3c5", width: 3.0 },
      secondary:   { color: "#cbcbcd", width: 2.4 },
      tertiary:    { color: "#d3d3d5", width: 1.8 },
      residential: { color: "#dadadc", width: 1.3 },
      path:        { color: "#e4e4e6", width: 0.7 },
    },
    water: "#93d0e4",
    waterway: "#7ec7e0",
    waterwayWidth: 3.2,
    park: "#bfe3d1",
    green: "#cfe9dd",
    built: "#c9c2b8",
    marker: "#2f86a6",
    markerSymbol: "#ffffff",
    labelColor: "#4b6b78",
    title: "#25444f",
    message: "#4b6b78",
    meta: "#7a98a5",
    accent: "#5aa9c4",
    light: true,
  },
  chalk: {
    id: "chalk",
    label: "Chalk",
    background: { top: "#fcfbf9", bottom: "#f6f4f0" },
    road: {
      motorway:    { color: "#ffffff", width: 4.2 },
      trunk:       { color: "#ffffff", width: 3.6 },
      primary:     { color: "#ffffff", width: 3.0 },
      secondary:   { color: "#ffffff", width: 2.4 },
      tertiary:    { color: "#ffffff", width: 1.8 },
      residential: { color: "#ffffff", width: 1.3 },
      path:        { color: "#e6e6e6", width: 0.6 },
    },
    casing: {
      motorway:    { color: "#c9c9c9", extra: 1.4 },
      trunk:       { color: "#d0d0d0", extra: 1.2 },
      primary:     { color: "#d6d6d6", extra: 1.1 },
      secondary:   { color: "#dcdcdc", extra: 1.0 },
      tertiary:    { color: "#e2e2e2", extra: 0.9 },
      residential: { color: "#e8e8e8", extra: 0.8 },
    },
    poi: { food: "#e08a5a", shops: "#6f94d8", landmarks: "#d9706b", lodging: "#9a7bd0", community: "#5aa882" },
    water: "#dfe9ee",
    waterway: "#a9c7d6",
    waterwayWidth: 2.4,
    park: "#d8e6c8",
    green: "#e6ecd8",
    built: "#e4e3e1",
    marker: "#2e2e30",
    markerSymbol: "#ffffff",
    labelColor: "#55555a",
    title: "#2b2b2d",
    message: "#55555a",
    meta: "#8a8a90",
    accent: "#b3a88f",
    light: true,
  },
};

const POI_LIGHT: Record<PlaceCategory, string> = {
  food: "#d9622b",
  shops: "#2f6fd0",
  landmarks: "#c43a36",
  lodging: "#7c4fc0",
  community: "#23875a",
};
const POI_DARK: Record<PlaceCategory, string> = {
  food: "#ff9a5c",
  shops: "#6fa8ff",
  landmarks: "#ff6b6b",
  lodging: "#b58cff",
  community: "#4fd6a0",
};

/** The dot colour for each kind of place in a theme: tuned to its background, or one colour for monochrome styles. */
export function poiColors(palette: MapThemePalette): Record<PlaceCategory, string> {
  if (palette.poiColor) {
    const c = palette.poiColor;
    return { food: c, shops: c, landmarks: c, lodging: c, community: c };
  }
  return { ...(palette.light ? POI_LIGHT : POI_DARK), ...palette.poi };
}

export function getMapTheme(id: MapStyleId): MapThemePalette {
  return MAP_THEMES[id];
}