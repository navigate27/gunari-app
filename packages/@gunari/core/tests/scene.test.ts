import { describe, it, expectTypeOf, expect } from "vitest";
import type { Scene, SceneInput, SceneCapabilities, SceneRegistry } from "../src/scene/scene";
import type { ShapeId, MapStyleId, MarkerStyleId, ZoomId, LayoutId, SceneViewport, SceneLocation } from "../src/scene/types";
import type { ThemePalette } from "../src/theme/theme";

describe("Scene contract types", () => {
  it("ShapeId is the expected union", () => {
    expectTypeOf<ShapeId>().toEqualTypeOf<"square" | "circle" | "heart">();
  });
  it("MapStyleId is the expected union", () => {
    expectTypeOf<MapStyleId>().toEqualTypeOf<"classic" | "midnight" | "blueprint" | "paper" | "twilight">();
  });
  it("MarkerStyleId is the expected union", () => {
    expectTypeOf<MarkerStyleId>().toEqualTypeOf<"solid" | "ring" | "heart" | "star">();
  });
  it("ZoomId is the expected union", () => {
    expectTypeOf<ZoomId>().toEqualTypeOf<"neighborhood" | "district" | "city">();
  });
  it("LayoutId is the expected union", () => {
    expectTypeOf<LayoutId>().toEqualTypeOf<"classic" | "poster">();
  });
  it("Scene has the three methods and capabilities", () => {
    type FakeScene = Scene<{ foo: number }, { bar: number }>;
    expectTypeOf<FakeScene["id"]>().toEqualTypeOf<string>();
    expectTypeOf<FakeScene["capabilities"]>().toEqualTypeOf<SceneCapabilities>();
    expectTypeOf<FakeScene["load"]>().parameters.toEqualTypeOf<[SceneInput, AbortSignal]>();
    expectTypeOf<FakeScene["project"]>().parameters.toEqualTypeOf<[{ foo: number }, SceneViewport, number]>();
    expectTypeOf<FakeScene["render"]>().parameters.toEqualTypeOf<[CanvasRenderingContext2D, { bar: number }, unknown, SceneInput, SceneViewport, number, number]>();
  });
  it("SceneRegistry is a Record of scenes by id", () => {
    const reg: SceneRegistry = { x: {} as never };
    expectTypeOf<typeof reg>().toMatchTypeOf<Record<string, unknown>>();
  });
  it("ThemePalette has the shared base fields", () => {
    expectTypeOf<ThemePalette>().toMatchTypeOf<{ id: string; label: string; light: boolean }>();
  });
});

describe("SceneInput", () => {
  it("includes a location field with lat, lng, label", () => {
    const loc: SceneLocation = { lat: 14.5995, lng: 120.9842, label: "Manila, Metro Manila, Philippines" };
    const input: SceneInput = {
      location: loc,
      shape: "square",
      style: "classic",
      marker: "solid",
      zoom: "district",
      rotation: 0,
      labels: false,
      layout: "classic",
    };
    expect(input.location.lat).toBe(14.5995);
    expect(input.location.lng).toBe(120.9842);
    expect(input.location.label).toBe("Manila, Metro Manila, Philippines");
    expect(input.shape).toBe("square");
  });
});