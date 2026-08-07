import { describe, it, expectTypeOf } from "vitest";
import type { RoadClass, Road, Polygon, Label, MapGeometry, BBox } from "../src/interpret/types";

describe("scene-mapprint types", () => {
  it("RoadClass is the 7-way union in draw order", () => {
    expectTypeOf<RoadClass>().toEqualTypeOf<
      "motorway" | "trunk" | "primary" | "secondary" | "tertiary" | "residential" | "path"
    >();
  });
  it("Road has class and points", () => {
    expectTypeOf<Road>().toMatchTypeOf<{ class: RoadClass; points: [number, number][] }>();
  });
  it("Polygon has points and optional holes", () => {
    expectTypeOf<Polygon>().toMatchTypeOf<{ points: [number, number][]; holes?: [number, number][][] }>();
  });
  it("Label has text, x, y, class", () => {
    expectTypeOf<Label>().toMatchTypeOf<{ text: string; x: number; y: number; class: "road" | "place" }>();
  });
  it("MapGeometry has the expected shape", () => {
    expectTypeOf<MapGeometry>().toMatchTypeOf<{
      bbox: BBox;
      roads: Road[];
      water: Polygon[];
      waterways: [number, number][][];
      parks: Polygon[];
      labels: Label[];
    }>();
  });
});