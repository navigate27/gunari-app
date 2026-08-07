import type { RoadClass, BBox } from "../interpret/types";

export interface ProjectedRoad {
  class: RoadClass;
  points: [number, number][];   // canvas-normalized [0, 1]
  name?: string;
}

export interface ProjectedPolygon {
  points: [number, number][];
  holes?: [number, number][][];
  name?: string;
}

export interface ProjectedLabel {
  text: string;
  x: number;
  y: number;
  class: "road" | "place";
}

export interface ProjectedMapGeometry {
  roads: ProjectedRoad[];
  water: ProjectedPolygon[];
  waterways: [number, number][][];
  parks: ProjectedPolygon[];
  labels: ProjectedLabel[];
  bbox: BBox;
  rotation: number;
}