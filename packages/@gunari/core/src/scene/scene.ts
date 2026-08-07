import type {
  SceneCapabilities,
  SceneInput,
  SceneViewport,
} from "./types";

export type { SceneCapabilities, SceneInput, SceneViewport } from "./types";

/**
 * Opaque marker types. Each scene defines its own `SceneData` and
 * `SceneGeometry` (e.g. `MapGeometry`, `MapRenderGeometry`). The platform
 * never inspects these — it only knows the contract surface.
 */
export type SceneData = { readonly __sceneDataBrand: unique symbol };
export type SceneGeometry = { readonly __sceneGeometryBrand: unique symbol };

export interface Scene<D = SceneData, G = SceneGeometry> {
  readonly id: string;
  readonly capabilities: SceneCapabilities;
  load(input: SceneInput, signal: AbortSignal): Promise<D>;
  project(data: D, viewport: SceneViewport, rotation: number): G;
  render(ctx: CanvasRenderingContext2D, geometry: G, palette: unknown): void;
}

export type SceneRegistry = Record<string, Scene>;