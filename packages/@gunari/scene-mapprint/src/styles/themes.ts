import type { MapStyleId, ThemePalette } from "@gunari/core";
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
};

export function getMapTheme(id: MapStyleId): MapThemePalette {
  return MAP_THEMES[id];
}