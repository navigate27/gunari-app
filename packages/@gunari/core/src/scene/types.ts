export type ShapeId = "square" | "circle" | "heart";
export type MapStyleId =
  | "classic" | "midnight" | "blueprint" | "paper" | "twilight"
  | "atlas" | "ink" | "mist" | "nocturne" | "lagoon" | "chalk";
export type MarkerStyleId = "solid" | "ring" | "heart" | "star" | "home";

/** Kinds of named places that can be shown on the map. */
export type PlaceCategory = "food" | "shops" | "landmarks" | "lodging" | "community";
export type ZoomId = "neighborhood" | "district" | "city";
export type LayoutId = "classic" | "poster";

export interface SceneLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface SceneInput {
  location: SceneLocation;
  shape: ShapeId;
  style: MapStyleId;
  marker: MarkerStyleId;
  zoom: ZoomId;
  rotation: number;
  labels: boolean;
  layout: LayoutId;
  /** Where the pin sits. Omitted = at the map centre. */
  pin?: { lat: number; lng: number };
  /** Which kinds of named places to show. Omitted or empty = none. */
  places?: readonly PlaceCategory[];
}

export interface SceneCapabilities {
  shapes: readonly ShapeId[];
  styles: readonly MapStyleId[];
  markers: readonly MarkerStyleId[];
  zooms: readonly ZoomId[];
  layouts: readonly LayoutId[];
  supportsRotation: boolean;
  supportsLabels: boolean;
}

export interface SceneViewport {
  /** Slot center, as a fraction of the canvas width / height. */
  cx: number;
  cy: number;
  /** Slot radius, as a fraction of the shorter canvas side. */
  r: number;
  /** Canvas size the fractions refer to. Defaults to the 1080x1920 story canvas. */
  canvasW?: number;
  canvasH?: number;
  /**
   * Shifts the map content inside the slot by this much (canvas-normalized,
   * screen space) without moving the slot itself. Used for drag-to-pan.
   */
  panX?: number;
  panY?: number;
  /** Drawing progress 0..1 for the build-up animation. Omitted = fully drawn. */
  reveal?: number;
  /** Enlarges (>1) or shrinks (<1) the map inside the slot. Omitted = 1. */
  zoomScale?: number;
}