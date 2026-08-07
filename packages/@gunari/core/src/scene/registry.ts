import type { Scene } from "./scene";

export type SceneRegistry = Record<string, Scene>;

export function getScene(registry: SceneRegistry, id: string): Scene | undefined {
  return registry[id];
}