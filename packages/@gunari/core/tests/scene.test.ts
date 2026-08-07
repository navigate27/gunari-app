import { describe, it, expectTypeOf } from "vitest";
import type { Scene, SceneInput, SceneCapabilities, SceneRegistry } from "../src/scene/scene";
import type { ShapeId, MapStyleId, MarkerStyleId, ZoomId, LayoutId, SceneViewport } from "../src/scene/types";
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
    expectTypeOf<FakeScene["render"]>().parameters.toEqualTypeOf<[CanvasRenderingContext2D, { bar: number }, unknown]>();
  });
  it("SceneRegistry is a Record of scenes by id", () => {
    const reg: SceneRegistry = { x: {} as never };
    expectTypeOf<typeof reg>().toMatchTypeOf<Record<string, unknown>>();
  });
  it("ThemePalette has the shared base fields", () => {
    expectTypeOf<ThemePalette>().toMatchTypeOf<{ id: string; label: string; light: boolean }>();
  });
});