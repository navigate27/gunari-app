export type ShapeId = "square" | "circle" | "heart";
export type MapStyleId = "classic" | "midnight" | "blueprint" | "paper" | "twilight";
export type MarkerStyleId = "solid" | "ring" | "heart" | "star";
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
  cx: number;
  cy: number;
  r: number;
}