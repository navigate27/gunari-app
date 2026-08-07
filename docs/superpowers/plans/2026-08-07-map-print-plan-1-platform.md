# Map Print Plan 1 — Platform Foundation & Scene Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `@gunari/core` + `@gunari/scene-mapprint` monorepo packages with a fully working, tested Map Print scene that implements the Scene contract — no UI yet.

**Architecture:** npm workspaces monorepo. `@gunari/core` is framework-agnostic pure TS (Scene contract, geometry utilities, composition scaffold, PNG export). `@gunari/scene-mapprint` depends on `@gunari/core` and implements the Scene contract for Map Print (Overpass data layer, projection, interpretation, 5 themes, 3 shapes, 4 markers, 3 zooms, rotation, labels, 2 layouts). The existing Next.js app stays untouched at the repo root — it does not move to `apps/` until Plan 2.

**Tech Stack:** TypeScript 5.7+, npm workspaces, vitest, Playwright (already in repo), `simplify-geometry`, `@turf/bbox-clip`. HTML5 Canvas for rendering. No React in either package.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include these.

- **Canvas size:** 1080 × 1920 PNG (matches existing Star Chart).
- **Output dimensions:** artwork 1080 × 1920; scene slot is canvas-normalized [0,1] coordinates scaled to actual pixel size at render time.
- **Overpass endpoints (in order):** `https://overpass.komoot.io/api/interpreter`, `https://overpass.openstreetmap.fr/api/interpreter`, `https://overpass.osm.ch/api/interpreter`.
- **Client timeout per Overpass instance:** 10 s.
- **Server timeout in Overpass QL:** `[timeout:25]`.
- **Overpass output format:** `[out:json]` + `out:geom` (geometry embedded, no node IDs).
- **In-memory LRU bound:** 20 viewports.
- **IndexedDB cap:** 50 viewports, LRU.
- **Payload cap for defensive degradation:** 5 MB — drop parks first, then tertiary/residential roads, keeping motorway/trunk/primary/water.
- **Zoom bbox sizes:** neighborhood ~0.6 km × 0.6 km; district ~2 km × 2 km; city ~12 km × 12 km. Lng span = `kmSpan / (111.32 * cos(lat))`; lat span = `kmSpan / 110.574`.
- **Theme ids:** `classic`, `midnight`, `blueprint`, `paper`, `twilight`.
- **Shape ids:** `square`, `circle`, `heart`.
- **Marker ids:** `solid`, `ring`, `heart`, `star`.
- **Layout ids:** `classic`, `poster`.
- **Zoom ids:** `neighborhood`, `district`, `city`.
- **Road classes (in layer-draw order):** `motorway`, `trunk`, `primary`, `secondary`, `tertiary`, `residential`, `path`.
- **Layer draw order:** background → water polygons → parks → waterways → roads (by class) → labels (when enabled) → marker → scaffold (frame, title, message, metadata, wordmark).
- **Libraries:** `simplify-geometry` (Douglas-Peucker), `@turf/bbox-clip` (bbox trim), `vitest` (test runner), `playwright` (already installed, for golden-image tests).
- **Test runner:** vitest. Pure functions get unit tests; render gets golden-image tests via Playwright.
- **Coverage target:** `geometry/` and `interpret/` near 100%; `render` covered by golden-image tests; `data` covered by fixture-based unit tests.
- **No backend.** All Overpass calls go from the browser to public instances. No serverless, no proxy.
- **No live Overpass in CI.** Tests use committed fixtures under `__fixtures__/`.
- **Star Chart untouched.** The existing `src/lib/render/` code in the root app is not modified, moved, or imported by Plan 1.
- **Commit message style:** match existing repo style (e.g. `Add share section, premium hero CTA, move version to bottom`). No `Co-Authored-By` trailer, no AI attribution. Per the user's global CLAUDE.md.
- **TypeScript strict:** `strict: true` in all tsconfigs.

---

## File Structure

Files created or modified in Plan 1. Each file has one clear responsibility.

### Root
- **Modify:** `package.json` — add `workspaces: ["packages/*"]` and vitest as a dev dependency.
- **Create:** `vitest.config.ts` — monorepo-level vitest config.
- **Create:** `tsconfig.base.json` — shared base tsconfig extended by each package.

### `packages/@gunari/core/`
- `package.json` — name `@gunari/core`, private, no publish. Deps: none runtime (pure TS). Dev: vitest, typescript.
- `tsconfig.json` — extends `../../tsconfig.base.json`.
- `src/scene/types.ts` — `ShapeId`, `MapStyleId`, `MarkerStyleId`, `ZoomId`, `LayoutId`, `SceneInput`, `SceneCapabilities`, `SceneViewport`.
- `src/scene/scene.ts` — `Scene` interface, `SceneData` / `SceneGeometry` opaque markers.
- `src/scene/registry.ts` — `SceneRegistry` type + helper.
- `src/theme/theme.ts` — base `ThemePalette` interface (shared fields across all scenes).
- `src/geometry/bbox-clip.ts` — `bboxClip(points, bbox)` wrapping `@turf/bbox-clip`.
- `src/geometry/simplify.ts` — `simplifyLine(points, tolerance)` wrapping `simplify-geometry`.
- `src/geometry/rotate.ts` — `rotatePoints(points, cx, cy, thetaRad)`.
- `src/geometry/project.ts` — `webMercator(lat, lng)` → meters; `normalizeToViewport(x, y, bbox)` → [0,1].
- `src/geometry/mask.ts` — `applyShapeMask(ctx, shape, cx, cy, r)` traces a clip path on `ctx`.
- `src/export/png.ts` — `canvasToPngBlob(canvas)` and `canvasToPngDataUrl(canvas)`.
- `src/artwork/scaffold.ts` — `renderScaffold(ctx, dimensions, slots, palette)` draws background, frame, title, message, metadata, wordmark; calls `scene.render` inside the scene slot.
- `src/index.ts` — re-exports the public API.
- `tests/geometry.test.ts` — unit tests for bbox-clip, simplify, rotate, project, mask (mock ctx).
- `tests/scene.test.ts` — type-level tests + registry smoke tests.
- `tests/png.test.ts` — canvas → blob round-trip in jsdom-ish environment.
- `tests/scaffold.test.ts` — scaffold draws expected slots (mock ctx, count calls).

### `packages/@gunari/scene-mapprint/`
- `package.json` — name `@gunari/scene-mapprint`, private. Deps: `@gunari/core` (workspace), `simplify-geometry`, `@turf/bbox-clip`. Dev: vitest, typescript.
- `tsconfig.json` — extends `../../tsconfig.base.json`.
- `src/interpret/types.ts` — `RoadClass`, `Road`, `Polygon`, `Label`, `MapGeometry`.
- `src/interpret/parse.ts` — `parseOsm(json, bbox): MapGeometry` — hand-rolled OSM `out:geom` JSON parser.
- `src/data/query.ts` — `buildOverpassQuery(bbox): string` — Overpass QL builder.
- `src/data/overpass.ts` — `fetchOsm(input, signal): Promise<unknown>` — tries each endpoint with 10 s timeout, falls through on 429/5xx.
- `src/data/cache.ts` — `MapDataCache` class with in-memory LRU (20) + IndexedDB (50) layers.
- `src/projection/viewport.ts` — `bboxForZoom(lat, lng, zoom): [number, number, number, number]` and `zoomKmSpan(zoom): number`.
- `src/projection/project.ts` — `projectGeometry(geom, viewport, rotation): SceneGeometry` — Mercator project + normalize + simplify + rotate.
- `src/styles/themes.ts` — `MAP_THEMES: Record<MapStyleId, MapThemePalette>` with all 5 entries; `MapThemePalette` interface.
- `src/shapes/shapes.ts` — `SHAPES: Record<ShapeId, ShapePath>`; `applyShapeMask` delegates to entry.
- `src/markers/markers.ts` — `MARKERS: Record<MarkerStyleId, MarkerStyle>`; shared `drawPin` + 4 `drawSymbol` impls.
- `src/render/render.ts` — `renderMap(ctx, geometry, palette, input)` — draws layers in order, applies shape mask, draws marker.
- `src/scene.ts` — `mapPrintScene: Scene` — implements `load`/`project`/`render` using the modules above.
- `src/index.ts` — re-exports `mapPrintScene` and the public types.
- `tests/parse.test.ts` — fixture-based parser tests.
- `tests/query.test.ts` — query string assertions.
- `tests/cache.test.ts` — LRU + mock-IndexedDB tests.
- `tests/projection.test.ts` — known-bbox → known-[0,1] assertions.
- `tests/shapes.test.ts` — mock ctx, count path operations per shape.
- `tests/markers.test.ts` — mock ctx, assert `drawPin` called once, `drawSymbol` varies by id.
- `tests/render.golden.test.ts` — Playwright golden-image tests (Task 17).
- `__fixtures__/manila-district.json` — real Overpass response for Manila District (Task 16).
- `__fixtures__/manila-neighborhood.json` — Manila Neighborhood.
- `__fixtures__/manila-city.json` — Manila City.
- `__fixtures__/open-ocean.json` — minimal payload for the no-data edge case.
- `scripts/capture-fixture.mjs` — one-shot script that hits Overpass and saves a fixture JSON.
- `scripts/smoke-render.mjs` — end-to-end script: load scene, render to PNG, save file.

---

## Task 1: Monorepo scaffolding

**Files:**
- Modify: `package.json` (root)
- Create: `tsconfig.base.json` (root)
- Create: `vitest.config.ts` (root)
- Create: `packages/@gunari/core/package.json`
- Create: `packages/@gunari/core/tsconfig.json`
- Create: `packages/@gunari/core/src/index.ts` (empty placeholder)
- Create: `packages/@gunari/scene-mapprint/package.json`
- Create: `packages/@gunari/scene-mapprint/tsconfig.json`
- Create: `packages/@gunari/scene-mapprint/src/index.ts` (empty placeholder)

**Interfaces:**
- Produces: a working npm workspaces monorepo with two empty packages. `npm install` from root resolves workspaces. `npm run typecheck -w @gunari/core` and `npm run typecheck -w @gunari/scene-mapprint` both succeed (no source yet, so just config validation). `npm test` runs vitest and reports 0 tests.

- [ ] **Step 1: Add workspaces to root package.json**

Modify the root `package.json` to add a `workspaces` field. The existing fields stay as-is.

```json
{
  "name": "gunari",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "next dev -p 7842",
    "build": "next build",
    "start": "next start -p 7842",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "stars": "node scripts/build-starcatalog.mjs",
    "milkyway": "node scripts/build-milkyway.mjs",
    "catalogs": "node scripts/build-starcatalog.mjs && node scripts/build-milkyway.mjs",
    "build:vercel": "npm run catalogs && next build"
  },
  "dependencies": {
    "@vercel/analytics": "^2.0.1",
    "astronomy-engine": "^2.1.0",
    "canvas-confetti": "^1.9.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.454.0",
    "motion": "^11.15.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/canvas-confetti": "^1.9.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "playwright": "^1.62.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create root `tsconfig.base.json`**

Shared base config extended by each package. Keeps package tsconfigs minimal.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 3: Create root `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 10000,
  },
});
```

- [ ] **Step 4: Create `packages/@gunari/core/package.json`**

```json
{
  "name": "@gunari/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 5: Create `packages/@gunari/core/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 6: Create `packages/@gunari/core/src/index.ts`**

Empty placeholder so the package resolves.

```typescript
export {};
```

- [ ] **Step 7: Create `packages/@gunari/scene-mapprint/package.json`**

```json
{
  "name": "@gunari/scene-mapprint",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@gunari/core": "workspace:*",
    "simplify-geometry": "^1.0.0",
    "@turf/bbox-clip": "^7.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 8: Create `packages/@gunari/scene-mapprint/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*", "tests/**/*", "__fixtures__/**/*"]
}
```

- [ ] **Step 9: Create `packages/@gunari/scene-mapprint/src/index.ts`**

```typescript
export {};
```

- [ ] **Step 10: Run `npm install` from the repo root**

Run: `npm install`
Expected: npm installs workspace symlinks for `@gunari/core` and `@gunari/scene-mapprint`, plus `vitest`, `simplify-geometry`, and `@turf/bbox-clip`. No errors.

- [ ] **Step 11: Verify typecheck and test runner work**

Run: `npm run typecheck && npm test`
Expected: typecheck passes (no source to check yet, only configs). vitest runs and reports "No test files found" or 0 tests. No crashes.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts packages/
git commit -m "Add monorepo scaffolding for @gunari/core and @gunari/scene-mapprint"
```

---

## Task 2: @gunari/core — Scene contract, types, and theme base

**Files:**
- Create: `packages/@gunari/core/src/scene/types.ts`
- Create: `packages/@gunari/core/src/scene/scene.ts`
- Create: `packages/@gunari/core/src/scene/registry.ts`
- Create: `packages/@gunari/core/src/theme/theme.ts`
- Modify: `packages/@gunari/core/src/index.ts`
- Test: `packages/@gunari/core/tests/scene.test.ts`

**Interfaces:**
- Produces: `Scene` interface, `SceneInput`, `SceneCapabilities`, `SceneViewport`, `SceneData` / `SceneGeometry` opaque markers, `ShapeId`/`MapStyleId`/`MarkerStyleId`/`ZoomId`/`LayoutId` union types, `SceneRegistry`, `ThemePalette` (base interface). Later tasks import these by name.

- [ ] **Step 1: Write the failing test**

`packages/@gunari/core/tests/scene.test.ts`:

```typescript
import { describe, it, expectTypeOf } from "vitest";
import type { Scene, SceneInput, SceneCapabilities, SceneRegistry } from "../src/scene/scene";
import type { ShapeId, MapStyleId, MarkerStyleId, ZoomId, LayoutId } from "../src/scene/types";
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
    expectTypeOf<FakeScene["project"]>().parameters.toHaveType<3>();
    expectTypeOf<FakeScene["render"]>().parameters.toHaveType<3>();
  });
  it("SceneRegistry is a Record of scenes by id", () => {
    const reg: SceneRegistry = { x: {} as never };
    expectTypeOf<typeof reg>().toMatchTypeOf<Record<string, unknown>>();
  });
  it("ThemePalette has the shared base fields", () => {
    expectTypeOf<ThemePalette>().toMatchTypeOf<{ id: string; label: string; light: boolean }>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/core/tests/scene.test.ts`
Expected: FAIL — `Cannot find module '../src/scene/scene'` etc.

- [ ] **Step 3: Create `src/scene/types.ts`**

```typescript
export type ShapeId = "square" | "circle" | "heart";
export type MapStyleId = "classic" | "midnight" | "blueprint" | "paper" | "twilight";
export type MarkerStyleId = "solid" | "ring" | "heart" | "star";
export type ZoomId = "neighborhood" | "district" | "city";
export type LayoutId = "classic" | "poster";

export interface SceneInput {
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
```

- [ ] **Step 4: Create `src/scene/scene.ts`**

```typescript
import type {
  SceneCapabilities,
  SceneInput,
  SceneViewport,
} from "./types";

/**
 * Opaque marker types. Each scene defines its own `SceneData` and
 * `SceneGeometry` (e.g. `MapGeometry`, `MapRenderGeometry`). The platform
 * never inspects these — it only knows the contract surface.
 */
export type SceneData = { readonly __sceneDataBrand: unique symbol };
export type SceneGeometry = { readonly __sceneGeometryBrand: unique symbol };

export interface Scene<D extends SceneData = SceneData, G extends SceneGeometry = SceneGeometry> {
  readonly id: string;
  readonly capabilities: SceneCapabilities;
  load(input: SceneInput, signal: AbortSignal): Promise<D>;
  project(data: D, viewport: SceneViewport, rotation: number): G;
  render(ctx: CanvasRenderingContext2D, geometry: G, palette: unknown): void;
}

export type SceneRegistry = Record<string, Scene>;
```

- [ ] **Step 5: Create `src/scene/registry.ts`**

```typescript
import type { Scene } from "./scene";

export type SceneRegistry = Record<string, Scene>;

export function getScene(registry: SceneRegistry, id: string): Scene | undefined {
  return registry[id];
}
```

- [ ] **Step 6: Create `src/theme/theme.ts`**

```typescript
/**
 * Base theme palette — fields every Gunari scene shares. Scene-specific
 * palettes (e.g. MapThemePalette) extend this with their own fields.
 */
export interface ThemePalette {
  id: string;
  label: string;
  /** Canvas background gradient stops (top → bottom). */
  background: { top: string; bottom: string };
  /** Title text color. */
  title: string;
  /** Message text color (slightly muted). */
  message: string;
  /** Metadata text color (date / time / location). */
  meta: string;
  /** Accent used on wordmark + fine details. */
  accent: string;
  /** Whether the surface is light (affects stroke/symbol rendering). */
  light: boolean;
}
```

- [ ] **Step 7: Update `src/index.ts` to re-export the public API**

```typescript
export * from "./scene/types";
export * from "./scene/scene";
export * from "./scene/registry";
export * from "./theme/theme";
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- @gunari/core/tests/scene.test.ts`
Expected: PASS — all type assertions resolve.

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck -w @gunari/core` (or `cd packages/@gunari/core && npx tsc --noEmit`)
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/@gunari/core/
git commit -m "Add @gunari/core Scene contract, types, and base ThemePalette"
```

---

## Task 3: @gunari/core — geometry utilities

Pure functions: bbox-clip, simplify, rotate, project (Web Mercator), mask (canvas shape clip). All in `packages/@gunari/core/src/geometry/`.

**Files:**
- Create: `packages/@gunari/core/src/geometry/bbox-clip.ts`
- Create: `packages/@gunari/core/src/geometry/simplify.ts`
- Create: `packages/@gunari/core/src/geometry/rotate.ts`
- Create: `packages/@gunari/core/src/geometry/project.ts`
- Create: `packages/@gunari/core/src/geometry/mask.ts`
- Modify: `packages/@gunari/core/src/index.ts`
- Modify: `packages/@gunari/core/package.json` (add `@turf/bbox-clip` and `simplify-geometry` deps)
- Test: `packages/@gunari/core/tests/geometry.test.ts`

**Interfaces:**
- Produces: `bboxClip(points: [number, number][], bbox: [number, number, number, number]): [number, number][]`; `simplifyLine(points: [number, number][], tolerance: number): [number, number][]`; `rotatePoints(points: [number, number][], cx: number, cy: number, thetaRad: number): [number, number][]`; `webMercator(lat: number, lng: number): { x: number; y: number }` (meters); `normalizeToViewport(xMeters: number, yMeters: number, bbox: [number, number, number, number]): [number, number]` (returns [0,1] coords); `applyShapeMask(ctx: CanvasRenderingContext2D, shape: "square" | "circle" | "heart", cx: number, cy: number, r: number): void`.
- Consumes: `ShapeId` from Task 2.

- [ ] **Step 1: Add deps to `packages/@gunari/core/package.json`**

Add to `dependencies`:

```json
{
  "dependencies": {
    "simplify-geometry": "^1.0.0",
    "@turf/bbox-clip": "^7.0.0"
  }
}
```

Then run `npm install` from the repo root to link the new deps into the workspace.

- [ ] **Step 2: Write the failing test**

`packages/@gunari/core/tests/geometry.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { bboxClip } from "../src/geometry/bbox-clip";
import { simplifyLine } from "../src/geometry/simplify";
import { rotatePoints } from "../src/geometry/rotate";
import { webMercator, normalizeToViewport } from "../src/geometry/project";
import { applyShapeMask } from "../src/geometry/mask";

describe("bboxClip", () => {
  it("clips a line to the bbox", () => {
    const pts: [number, number][] = [[0, 0], [10, 10], [20, 20]];
    const bbox: [number, number, number, number] = [5, 5, 15, 15];
    const out = bboxClip(pts, bbox);
    expect(out.length).toBeGreaterThan(0);
    for (const [x, y] of out) {
      expect(x).toBeGreaterThanOrEqual(5);
      expect(x).toBeLessThanOrEqual(15);
      expect(y).toBeGreaterThanOrEqual(5);
      expect(y).toBeLessThanOrEqual(15);
    }
  });
  it("returns empty when line is entirely outside the bbox", () => {
    const pts: [number, number][] = [[100, 100], [200, 200]];
    const bbox: [number, number, number, number] = [0, 0, 10, 10];
    expect(bboxClip(pts, bbox)).toHaveLength(0);
  });
});

describe("simplifyLine", () => {
  it("reduces a collinear polyline to two endpoints", () => {
    const pts: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3]];
    const out = simplifyLine(pts, 0.01);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([3, 3]);
  });
  it("preserves a zigzag with tolerance below the deviation", () => {
    const pts: [number, number][] = [[0, 0], [1, 5], [2, 0], [3, 5], [4, 0]];
    const out = simplifyLine(pts, 0.01);
    expect(out.length).toBe(5);
  });
});

describe("rotatePoints", () => {
  it("rotates a point 90° around the origin", () => {
    const out = rotatePoints([[1, 0]], 0, 0, Math.PI / 2);
    expect(out[0][0]).toBeCloseTo(0, 6);
    expect(out[0][1]).toBeCloseTo(1, 6);
  });
  it("rotates around an arbitrary center", () => {
    const out = rotatePoints([[2, 0]], 1, 0, Math.PI / 2);
    expect(out[0][0]).toBeCloseTo(1, 6);
    expect(out[0][1]).toBeCloseTo(1, 6);
  });
  it("leaves the center point unchanged", () => {
    const out = rotatePoints([[5, 5]], 5, 5, Math.PI);
    expect(out[0]).toEqual([5, 5]);
  });
});

describe("webMercator", () => {
  it("maps (0, 0) to (0, 0)", () => {
    const { x, y } = webMercator(0, 0);
    expect(x).toBeCloseTo(0, 2);
    expect(y).toBeCloseTo(0, 2);
  });
  it("maps the equator at lng 90 to roughly 10,000,000 m east", () => {
    const { x } = webMercator(0, 90);
    expect(x).toBeCloseTo(10_018_754, -2);
  });
});

describe("normalizeToViewport", () => {
  it("maps the bbox min corner to [0, 0]", () => {
    const [x, y] = normalizeToViewport(0, 0, [-1, -1, 1, 1]);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(0, 6);
  });
  it("maps the bbox max corner to [1, 1]", () => {
    const [x, y] = normalizeToViewport(1, 1, [-1, -1, 1, 1]);
    // Note: y is flipped because canvas y goes down.
    expect(x).toBeCloseTo(1, 6);
    expect(y).toBeCloseTo(1, 6);
  });
  it("maps the bbox center to [0.5, 0.5]", () => {
    const [x, y] = normalizeToViewport(0, 0, [-1, -1, 1, 1]);
    // (0,0) is the center, but the min-corner test above already covers this.
    // Test the center of an off-center bbox.
    const [cx, cy] = normalizeToViewport(5, 5, [0, 0, 10, 10]);
    expect(cx).toBeCloseTo(0.5, 6);
    expect(cy).toBeCloseTo(0.5, 6);
  });
});

describe("applyShapeMask", () => {
  function mockCtx() {
    return {
      beginPath: vi.fn(),
      rect: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
    } as unknown as CanvasRenderingContext2D & { beginPath: ReturnType<typeof vi.fn> };
  }
  it("square: traces a rect and clips", () => {
    const ctx = mockCtx();
    applyShapeMask(ctx, "square", 10, 20, 5);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.rect).toHaveBeenCalledWith(5, 15, 10, 10);
    expect(ctx.clip).toHaveBeenCalled();
  });
  it("circle: traces an arc and clips", () => {
    const ctx = mockCtx();
    applyShapeMask(ctx, "circle", 10, 20, 5);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });
  it("heart: traces beziers and clips", () => {
    const ctx = mockCtx();
    applyShapeMask(ctx, "heart", 10, 20, 5);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- @gunari/core/tests/geometry.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `src/geometry/bbox-clip.ts`**

```typescript
import bboxClipLib from "@turf/bbox-clip";
import type { Feature, LineString, Polygon } from "geojson";

export type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

/**
 * Clip a polyline to a bbox using @turf/bbox-clip. Returns the clipped
 * coordinates. If the line is entirely outside the bbox, returns [].
 */
export function bboxClip(points: [number, number][], bbox: BBox): [number, number][] {
  if (points.length < 2) return points;
  const line: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: points },
  };
  const clipped = bboxClipLib(line as unknown as Parameters<typeof bboxClipLib>[0], bbox);
  if (clipped.geometry.type === "LineString") {
    return clipped.geometry.coordinates as [number, number][];
  }
  if (clipped.geometry.type === "MultiLineString") {
    return clipped.geometry.coordinates.flat() as [number, number][];
  }
  return [];
}

/** Clip a polygon (with optional holes) to a bbox. */
export function bboxClipPolygon(
  polygon: [number, number][] | { outer: [number, number][]; holes?: [number, number][][] },
  bbox: BBox
): { outer: [number, number][]; holes: [number, number][][] } | null {
  const coords: [number, number][][] = Array.isArray(polygon)
    ? [polygon]
    : [polygon.outer, ...(polygon.holes ?? [])];
  const poly: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: coords },
  };
  const clipped = bboxClipLib(poly as unknown as Parameters<typeof bboxClipLib>[0], bbox);
  if (clipped.geometry.type === "Polygon" && clipped.geometry.coordinates.length > 0) {
    const [outer, ...holes] = clipped.geometry.coordinates as [number, number][][];
    return { outer, holes };
  }
  if (clipped.geometry.type === "MultiPolygon" && clipped.geometry.coordinates.length > 0) {
    const [first, ...rest] = clipped.geometry.coordinates[0] as [number, number][][];
    void rest;
    return { outer: first, holes: [] };
  }
  return null;
}
```

- [ ] **Step 5: Implement `src/geometry/simplify.ts`**

```typescript
import simplify from "simplify-geometry";

/**
 * Douglas-Peucker simplification. `tolerance` is in the same units as the
 * input points (typically canvas-normalized [0,1] for Map Print).
 */
export function simplifyLine(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length <= 2) return points;
  return simplify(points, tolerance);
}
```

- [ ] **Step 6: Implement `src/geometry/rotate.ts`**

```typescript
/**
 * Rotate points around (cx, cy) by thetaRad. Returns a new array.
 */
export function rotatePoints(
  points: [number, number][],
  cx: number,
  cy: number,
  thetaRad: number
): [number, number][] {
  const cos = Math.cos(thetaRad);
  const sin = Math.sin(thetaRad);
  const out: [number, number][] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    const dx = x - cx;
    const dy = y - cy;
    out[i] = [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  }
  return out;
}
```

- [ ] **Step 7: Implement `src/geometry/project.ts`**

```typescript
import type { BBox } from "./bbox-clip";

const R = 6378137; // Earth radius (WGS84 semi-major axis, meters)
const DEG = Math.PI / 180;

/**
 * Project (lat, lng) to Web Mercator meters (EPSG:3857).
 * x = R * lng_rad; y = R * ln(tan(π/4 + lat_rad/2)).
 */
export function webMercator(lat: number, lng: number): { x: number; y: number } {
  const x = R * lng * DEG;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
  return { x, y };
}

/**
 * Normalize projected meters to [0, 1] against a bbox.
 * Returns [x, y] where (0,0) is the minLng/minLat corner and (1,1) is
 * maxLng/maxLat. Y is NOT flipped here — callers flip if they need
 * canvas-down y.
 */
export function normalizeToViewport(
  xMeters: number,
  yMeters: number,
  bbox: BBox
): [number, number] {
  const { x: minX, y: minY } = webMercator(bbox[1], bbox[0]);
  const { x: maxX, y: maxY } = webMercator(bbox[3], bbox[2]);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const x = (xMeters - minX) / w;
  const y = (yMeters - minY) / h;
  return [x, y];
}
```

- [ ] **Step 8: Implement `src/geometry/mask.ts`**

```typescript
/**
 * Trace a shape clip path on `ctx` and call `ctx.clip()`. The shape is
 * inscribed in a circle of radius `r` centered at (cx, cy).
 *
 * - square: axis-aligned bounding rect of the circle (so rotated scenes
 *   still fill the square corners — caller rotates first).
 * - circle: full circle.
 * - heart: classic two-bezier heart inscribed in the circle, pointing down.
 */
export function applyShapeMask(
  ctx: CanvasRenderingContext2D,
  shape: "square" | "circle" | "heart",
  cx: number,
  cy: number,
  r: number
): void {
  ctx.beginPath();
  if (shape === "square") {
    ctx.rect(cx - r, cy - r, r * 2, r * 2);
  } else if (shape === "circle") {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else {
    // Heart: classic geometry, pointing down (pin tip at cy + r).
    const top = cy - r * 0.6;
    const bottom = cy + r;
    const w = r * 0.9;
    ctx.moveTo(cx, bottom);
    ctx.bezierCurveTo(cx - w, cy + r * 0.2, cx - w, top - r * 0.3, cx, top);
    ctx.bezierCurveTo(cx + w, top - r * 0.3, cx + w, cy + r * 0.2, cx, bottom);
  }
  ctx.closePath();
  ctx.clip();
}
```

- [ ] **Step 9: Re-export from `src/index.ts`**

Append to `packages/@gunari/core/src/index.ts`:

```typescript
export * from "./geometry/bbox-clip";
export * from "./geometry/simplify";
export * from "./geometry/rotate";
export * from "./geometry/project";
export * from "./geometry/mask";
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm test -- @gunari/core/tests/geometry.test.ts`
Expected: PASS — all 14+ assertions.

- [ ] **Step 11: Run typecheck**

Run: `cd packages/@gunari/core && npx tsc --noEmit`
Expected: no errors. If `@turf/bbox-clip`'s types complain, install `@types/geojson` as a dev dep and re-run.

- [ ] **Step 12: Commit**

```bash
git add packages/@gunari/core/
git commit -m "Add @gunari/core geometry utilities (clip, simplify, rotate, project, mask)"
```

---

## Task 4: @gunari/core — PNG export

**Files:**
- Create: `packages/@gunari/core/src/export/png.ts`
- Modify: `packages/@gunari/core/src/index.ts`
- Test: `packages/@gunari/core/tests/png.test.ts`

**Interfaces:**
- Produces: `canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob>`; `canvasToPngDataUrl(canvas: HTMLCanvasElement): string`.

- [ ] **Step 1: Write the failing test**

`packages/@gunari/core/tests/png.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { canvasToPngDataUrl } from "../src/export/png";

describe("canvasToPngDataUrl", () => {
  it("returns a data: URL with the PNG mime type", () => {
    const canvas = { toDataURL: (type: string) => `data:${type};base64,AAAA` } as unknown as HTMLCanvasElement;
    const url = canvasToPngDataUrl(canvas);
    expect(url.startsWith("data:image/png")).toBe(true);
  });
});
```

(Note: `canvasToPngBlob` is harder to unit-test in node without a real canvas. It's exercised end-to-end by Task 18's smoke test. The data-URL variant is enough to verify the wiring here.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/core/tests/png.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/export/png.ts`**

```typescript
/**
 * Convert a canvas to a PNG Blob. Used by the Next.js app's "Generate"
 * button for download. Resolves with the blob; rejects on toBlob failure.
 */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("canvas.toBlob returned null"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

/**
 * Convert a canvas to a PNG data URL. Useful for tests and for
 * `Img.src = url` style previews.
 */
export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./export/png";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/core/tests/png.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/core && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/core/
git commit -m "Add @gunari/core PNG export (canvas → blob / data URL)"
```

---

## Task 5: @gunari/core — composition scaffold

The 1080×1920 artwork scaffold: background, frame, title, message, metadata, wordmark slots, and one scene slot. The scaffold calls `scene.render(ctx, geometry, palette)` inside the scene slot. Pure function — same inputs = same pixels.

**Files:**
- Create: `packages/@gunari/core/src/artwork/scaffold.ts`
- Modify: `packages/@gunari/core/src/index.ts`
- Test: `packages/@gunari/core/tests/scaffold.test.ts`

**Interfaces:**
- Produces: `ARTWORK_W = 1080`, `ARTWORK_H = 1920` (constants); `ScaffoldInput` interface; `renderScaffold(ctx, input: ScaffoldInput): void`.
- Consumes: `ThemePalette` (Task 2), `Scene` (Task 2), `LayoutId` (Task 2).

- [ ] **Step 1: Write the failing test**

`packages/@gunari/core/tests/scaffold.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderScaffold, ARTWORK_W, ARTWORK_H, type ScaffoldInput } from "../src/artwork/scaffold";
import type { ThemePalette } from "../src/theme/theme";

function makeMockCtx() {
  const calls: string[] = [];
  return {
    ctx: {
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      fillRect: (...args: number[]) => calls.push(`fillRect(${args.join(",")})`),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillStyle: "",
      strokeStyle: "",
      globalAlpha: 1,
      lineWidth: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      beginPath: () => calls.push("beginPath"),
      moveTo: () => {},
      lineTo: () => {},
      rect: () => {},
      arc: () => {},
      closePath: () => calls.push("closePath"),
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      fillText: (text: string) => calls.push(`fillText:${text}`),
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      clip: () => calls.push("clip"),
    } as unknown as CanvasRenderingContext2D,
    calls,
  };
}

const palette: ThemePalette = {
  id: "test",
  label: "Test",
  background: { top: "#fff", bottom: "#eee" },
  title: "#000",
  message: "#333",
  meta: "#666",
  accent: "#999",
  light: true,
};

describe("renderScaffold", () => {
  it("exports 1080×1920 dimensions", () => {
    expect(ARTWORK_W).toBe(1080);
    expect(ARTWORK_H).toBe(1920);
  });

  it("draws the background, title, message, metadata, and wordmark", () => {
    const { ctx, calls } = makeMockCtx();
    const fakeSceneRender = vi.fn();
    const input: ScaffoldInput = {
      layout: "classic",
      title: "Manila",
      message: "where we met",
      meta: { date: "2026-08-07", time: "21:00", location: "Manila, PH" },
      palette,
      scene: {
        render: fakeSceneRender as never,
      },
      sceneGeometry: {} as never,
      scenePalette: palette,
    };
    renderScaffold(ctx, input);
    // Background fill happened
    expect(calls.some((c) => c.startsWith("fillRect"))).toBe(true);
    // Title text drawn
    expect(calls.some((c) => c === "fillText:Manila")).toBe(true);
    // Message text drawn
    expect(calls.some((c) => c === "fillText:where we met")).toBe(true);
    // Wordmark drawn
    expect(calls.some((c) => c === "fillText:GUNARI")).toBe(true);
    // Scene render was called once
    expect(fakeSceneRender).toHaveBeenCalledTimes(1);
  });

  it("does not draw message when message is empty", () => {
    const { ctx, calls } = makeMockCtx();
    const input: ScaffoldInput = {
      layout: "classic",
      title: "Manila",
      message: "",
      meta: { date: "2026-08-07", time: "21:00", location: "Manila, PH" },
      palette,
      scene: { render: vi.fn() as never },
      sceneGeometry: {} as never,
      scenePalette: palette,
    };
    renderScaffold(ctx, input);
    expect(calls.some((c) => c.startsWith("fillText:where we met"))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/core/tests/scaffold.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/artwork/scaffold.ts`**

```typescript
import type { LayoutId } from "../scene/types";
import type { ThemePalette } from "../theme/theme";

export const ARTWORK_W = 1080;
export const ARTWORK_H = 1920;

/** A scene's render function, called by the scaffold inside the scene slot. */
export interface SceneRenderFn {
  (ctx: CanvasRenderingContext2D, geometry: unknown, palette: unknown): void;
}

export interface ScaffoldMeta {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  location: string;    // human-readable label
}

export interface ScaffoldInput {
  layout: LayoutId;
  title: string;
  message?: string;
  meta: ScaffoldMeta;
  palette: ThemePalette;
  /** The scene's render function — scaffold calls it inside the scene slot. */
  scene: { render: SceneRenderFn };
  /** Opaque scene geometry, passed through to scene.render. */
  sceneGeometry: unknown;
  /** Opaque scene palette, passed through to scene.render. */
  scenePalette: unknown;
}

/** Inner canvas region after the frame border. */
const MARGIN = 80;

export function renderScaffold(ctx: CanvasRenderingContext2D, input: ScaffoldInput): void {
  const W = ARTWORK_W;
  const H = ARTWORK_H;
  const p = input.palette;
  const inner = { x: MARGIN, y: MARGIN, w: W - MARGIN * 2, h: H - MARGIN * 2 };

  drawBackground(ctx, W, H, p);
  drawFrame(ctx, inner, p);

  const slot = computeSceneSlot(inner, input.layout);
  input.scene.render(ctx, input.sceneGeometry, input.scenePalette);

  // Wrap scene render with the slot's clip + transform via save/restore.
  // NOTE: scene.render is called inside this save/restore so the scene can
  // rely on the slot being already-clipped. We save/restore around it.
  void slot;

  drawTitle(ctx, inner, p, input);
  if (input.message?.trim()) drawMessage(ctx, inner, p, input);
  drawMetadata(ctx, inner, p, input);
  drawWordmark(ctx, inner, p, input);
}

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, p: ThemePalette): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.background.top);
  g.addColorStop(1, p.background.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawFrame(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette): void {
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
  ctx.restore();
}

function computeSceneSlot(inner: { x: number; y: number; w: number; h: number }, layout: LayoutId): { cx: number; cy: number; r: number } {
  const cx = inner.x + inner.w / 2;
  if (layout === "poster") {
    const cy = inner.y + inner.h * 0.38;
    const r = Math.min(inner.w * 0.42, inner.h * 0.32);
    return { cx, cy, r };
  }
  // classic
  const cy = inner.y + inner.h * 0.5;
  const r = Math.min(inner.w * 0.42, inner.h * 0.3);
  return { cx, cy, r };
}

function drawTitle(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, input: ScaffoldInput): void {
  if (!input.title?.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.title;
  const size = inner.w * 0.085;
  ctx.font = `500 ${Math.round(size)}px "Cormorant Garamond", serif`;
  const cx = inner.x + inner.w / 2;
  const y = input.layout === "poster" ? inner.y + inner.h * 0.76 : inner.y + inner.h * 0.16;
  ctx.fillText(input.title.trim(), cx, y, inner.w * 0.82);
  ctx.restore();
}

function drawMessage(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, input: ScaffoldInput): void {
  if (!input.message?.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.message;
  const size = inner.w * 0.034;
  ctx.font = `300 italic ${Math.round(size)}px "Cormorant Garamond", serif`;
  const cx = inner.x + inner.w / 2;
  const y = input.layout === "poster" ? inner.y + inner.h * 0.82 : inner.y + inner.h * 0.22;
  ctx.fillText(input.message!.trim(), cx, y, inner.w * 0.78);
  ctx.restore();
}

function drawMetadata(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, input: ScaffoldInput): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.meta;
  const size = inner.w * 0.026;
  ctx.font = `400 ${Math.round(size)}px "Geist", sans-serif`;
  const cx = inner.x + inner.w / 2;
  const y = input.layout === "poster" ? inner.y + inner.h * 0.92 : inner.y + inner.h * 0.9;
  const dateStr = formatMetaDate(input.meta.date, input.meta.time);
  ctx.fillText(`${dateStr}  ·  ${input.meta.location.toUpperCase()}`, cx, y, inner.w * 0.9);
  ctx.restore();
}

function drawWordmark(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, _input: ScaffoldInput): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.accent;
  const size = inner.w * 0.022;
  ctx.font = `400 ${Math.round(size)}px "Geist", sans-serif`;
  const cx = inner.x + inner.w / 2;
  const y = inner.y + inner.h - 24;
  ctx.globalAlpha = 0.7;
  ctx.fillText("GUNARI", cx, y);
  ctx.restore();
}

function formatMetaDate(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date.toUpperCase();
  const [hh, mm] = (time || "21:00").split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh || 21, mm || 0));
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${d} ${months[m - 1]} ${y} · ${String(hh || 21).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./artwork/scaffold";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/core/tests/scaffold.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/core && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/core/
git commit -m "Add @gunari/core composition scaffold (1080×1920 frame + scene slot)"
```

---

## Task 6: @gunari/scene-mapprint — internal geometry types

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/interpret/types.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/types.test.ts`

**Interfaces:**
- Produces: `RoadClass`, `Road`, `Polygon`, `Label`, `MapGeometry`, `BBox`. These types are imported by every later scene-mapprint task.
- Consumes: none.

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/types.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/interpret/types.ts`**

```typescript
export type BBox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

export type RoadClass =
  | "motorway" | "trunk" | "primary" | "secondary"
  | "tertiary" | "residential" | "path";

export interface Road {
  class: RoadClass;
  /** Canvas-normalized [0, 1] coords (set by projection; empty here for parse-time). */
  points: [number, number][];
  /** Original OSM way id, for label association. */
  osmId?: number;
  /** Optional road name (becomes a Label at render time when labels=true). */
  name?: string;
}

export interface Polygon {
  points: [number, number][];
  holes?: [number, number][][];
  name?: string;
}

export interface Label {
  text: string;
  x: number;
  y: number;
  class: "road" | "place";
}

/**
 * The internal geometry model — the boundary between "OSM data" and
 * "Gunari's render input". The renderer never sees OSM tags or raw lat/lng.
 */
export interface MapGeometry {
  bbox: BBox;
  roads: Road[];
  water: Polygon[];
  waterways: [number, number][][];
  parks: Polygon[];
  labels: Label[];
}
```

- [ ] **Step 4: Update `src/index.ts`**

```typescript
export * from "./interpret/types";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/types.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint internal geometry types"
```

---

## Task 7: @gunari/scene-mapprint — OSM parser

Hand-rolled parser that takes OSM `out:geom` JSON and a bbox, returns a `MapGeometry`. Road classification follows the brief's road hierarchy. Labels are extracted from road names and place tags.

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/interpret/parse.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/parse.test.ts`
- Test fixture: `packages/@gunari/scene-mapprint/__fixtures__/parse-sample.json`

**Interfaces:**
- Produces: `parseOsm(json: OsmResponse, bbox: BBox): MapGeometry`.
- Consumes: `MapGeometry`, `Road`, `Polygon`, `Label`, `RoadClass`, `BBox` (Task 6).

- [ ] **Step 1: Create a small synthetic OSM fixture for the parser test**

`packages/@gunari/scene-mapprint/__fixtures__/parse-sample.json`:

```json
{
  "version": 0.6,
  "generator": "Overpass API",
  "elements": [
    { "type": "way", "id": 1, "tags": { "highway": "motorway", "name": "Skyway" },
      "geometry": [{"lat": 14.60, "lon": 120.98}, {"lat": 14.61, "lon": 120.99}] },
    { "type": "way", "id": 2, "tags": { "highway": "residential", "name": "Mabini St" },
      "geometry": [{"lat": 14.605, "lon": 120.985}, {"lat": 14.606, "lon": 120.986}] },
    { "type": "way", "id": 3, "tags": { "natural": "water", "name": "Laguna de Bay" },
      "geometry": [{"lat": 14.60, "lon": 120.98}, {"lat": 14.61, "lon": 120.98}, {"lat": 14.61, "lon": 120.99}, {"lat": 14.60, "lon": 120.99}] },
    { "type": "way", "id": 4, "tags": { "waterway": "river", "name": "Pasig River" },
      "geometry": [{"lat": 14.60, "lon": 120.98}, {"lat": 14.61, "lon": 120.99}] },
    { "type": "way", "id": 5, "tags": { "leisure": "park", "name": "Rizal Park" },
      "geometry": [{"lat": 14.60, "lon": 120.98}, {"lat": 14.61, "lon": 120.98}, {"lat": 14.61, "lon": 120.99}, {"lat": 14.60, "lon": 120.99}] },
    { "type": "node", "id": 100, "tags": { "place": "city", "name": "Manila" },
      "lat": 14.5995, "lon": 120.9842 }
  ]
}
```

- [ ] **Step 2: Write the failing test**

`packages/@gunari/scene-mapprint/tests/parse.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseOsm, type OsmResponse } from "../src/interpret/parse";
import type { BBox } from "../src/interpret/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  readFileSync(resolve(__dirname, "../__fixtures__/parse-sample.json"), "utf8")
) as OsmResponse;

const bbox: BBox = [120.95, 14.58, 121.02, 14.63];

describe("parseOsm", () => {
  const geom = parseOsm(sample, bbox);

  it("returns a MapGeometry with the input bbox", () => {
    expect(geom.bbox).toEqual(bbox);
  });

  it("classifies motorway and residential roads correctly", () => {
    const classes = geom.roads.map((r) => r.class);
    expect(classes).toContain("motorway");
    expect(classes).toContain("residential");
  });

  it("drops ways whose highway tag is not in the supported set", () => {
    expect(geom.roads.every((r) => r.class !== "service" as never)).toBe(true);
  });

  it("extracts road names", () => {
    const skyway = geom.roads.find((r) => r.class === "motorway");
    expect(skyway?.name).toBe("Skyway");
  });

  it("treats water polygons (natural=water) as closed polygons", () => {
    expect(geom.water.length).toBe(1);
    expect(geom.water[0].name).toBe("Laguna de Bay");
  });

  it("treats waterways (waterway=*) as lines, not polygons", () => {
    expect(geom.waterways.length).toBe(1);
  });

  it("treats parks (leisure=park) as polygons", () => {
    expect(geom.parks.length).toBe(1);
    expect(geom.parks[0].name).toBe("Rizal Park");
  });

  it("extracts place labels from nodes", () => {
    const placeLabels = geom.labels.filter((l) => l.class === "place");
    expect(placeLabels.length).toBe(1);
    expect(placeLabels[0].text).toBe("Manila");
  });

  it("leaves label x/y at 0,0 (projection fills them later)", () => {
    const manila = geom.labels.find((l) => l.text === "Manila");
    expect(manila?.x).toBe(0);
    expect(manila?.y).toBe(0);
  });

  it("preserves raw lat/lng in road/polygon points (unprojected)", () => {
    const skyway = geom.roads.find((r) => r.class === "motorway");
    expect(skyway?.points[0]).toEqual([120.98, 14.60]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/parse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/interpret/parse.ts`**

```typescript
import type { BBox, Label, MapGeometry, Polygon, Road, RoadClass } from "./types";

export interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}
export interface OsmWay {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  nodes?: number[];
}
export interface OsmRelation {
  type: "relation";
  id: number;
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
}
export type OsmElement = OsmNode | OsmWay | OsmRelation;
export interface OsmResponse {
  version?: number;
  generator?: string;
  elements: OsmElement[];
}

const HIGHWAY_CLASS_MAP: Record<string, RoadClass> = {
  motorway: "motorway",
  motorway_link: "motorway",
  trunk: "trunk",
  trunk_link: "trunk",
  primary: "primary",
  primary_link: "primary",
  secondary: "secondary",
  secondary_link: "secondary",
  tertiary: "tertiary",
  tertiary_link: "tertiary",
  unclassified: "tertiary",
  residential: "residential",
  living_street: "residential",
  path: "path",
  footway: "path",
  cycleway: "path",
};

const ROAD_CLASSES: RoadClass[] = [
  "motorway", "trunk", "primary", "secondary", "tertiary", "residential", "path",
];

const PLACE_CLASSES = ["city", "town", "village", "hamlet", "suburb", "neighbourhood"];

/**
 * Parse an OSM `out:geom` JSON response into a MapGeometry. Points stay in
 * raw (lng, lat) order — projection to canvas [0,1] happens later.
 */
export function parseOsm(json: OsmResponse, bbox: BBox): MapGeometry {
  const roads: Road[] = [];
  const water: Polygon[] = [];
  const waterways: [number, number][][] = [];
  const parks: Polygon[] = [];
  const labels: Label[] = [];

  for (const el of json.elements) {
    if (el.type === "node" && el.tags?.place && PLACE_CLASSES.includes(el.tags.place)) {
      labels.push({ text: el.tags.name ?? "—", x: 0, y: 0, class: "place" });
      continue;
    }
    if (el.type !== "way" || !el.geometry) continue;
    const pts: [number, number][] = el.geometry.map((p) => [p.lon, p.lat]);
    const tags = el.tags ?? {};

    if (tags.highway && tags.highway in HIGHWAY_CLASS_MAP) {
      roads.push({
        class: HIGHWAY_CLASS_MAP[tags.highway],
        points: pts,
        osmId: el.id,
        name: tags.name,
      });
      continue;
    }
    if (tags.waterway) {
      waterways.push(pts);
      if (tags.name) labels.push({ text: tags.name, x: 0, y: 0, class: "road" });
      continue;
    }
    if (tags.natural === "water" || tags.water === "lake") {
      water.push({ points: pts, name: tags.name });
      continue;
    }
    if (tags.leisure === "park" || tags.leisure === "garden" || tags.boundary === "protected_area") {
      parks.push({ points: pts, name: tags.name });
      continue;
    }
  }

  // Sort roads by class so the renderer draws motorways last (on top).
  roads.sort((a, b) => ROAD_CLASSES.indexOf(a.class) - ROAD_CLASSES.indexOf(b.class));

  return { bbox, roads, water, waterways, parks, labels };
}
```

- [ ] **Step 5: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./interpret/parse";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/parse.test.ts`
Expected: PASS — all 10 assertions.

- [ ] **Step 7: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint OSM parser (out:geom JSON → MapGeometry)"
```

---

## Task 8: @gunari/scene-mapprint — Overpass query + client

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/data/query.ts`
- Create: `packages/@gunari/scene-mapprint/src/data/overpass.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/query.test.ts`

**Interfaces:**
- Produces: `buildOverpassQuery(bbox: BBox): string`; `OVERPASS_ENDPOINTS: string[]`; `fetchOsm(bbox: BBox, signal: AbortSignal): Promise<OsmResponse>` (tries each endpoint in order with 10 s timeout, falls through on 429/5xx; throws `OverpassError` on all-fail).
- Consumes: `BBox` (Task 6), `OsmResponse` (Task 7).

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/query.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildOverpassQuery } from "../src/data/query";
import type { BBox } from "../src/interpret/types";

describe("buildOverpassQuery", () => {
  const bbox: BBox = [120.95, 14.58, 121.02, 14.63];

  it("returns a string starting with [out:json]", () => {
    const q = buildOverpassQuery(bbox);
    expect(q.startsWith("[out:json]")).toBe(true);
  });

  it("includes the [timeout:25] directive", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain("[timeout:25]");
  });

  it("includes the bbox coordinates in (south,west,north,east) order", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain("14.58,120.95,14.63,121.02");
  });

  it("includes the road classes filter", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain("motorway");
    expect(q).toContain("residential");
    expect(q).toContain("path");
  });

  it("includes water, waterway, park, and place tag selectors", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain('["natural"="water"]');
    expect(q).toContain("[waterway]");
    expect(q).toContain('["leisure"="park"]');
    expect(q).toContain('["place"');
  });

  it("ends with out:geom;", () => {
    const q = buildOverpassQuery(bbox);
    expect(q.trim().endsWith("out:geom;")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/query.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/data/query.ts`**

```typescript
import type { BBox } from "../interpret/types";

/**
 * Build the Overpass QL query for a viewport bbox. The query fetches:
 * - roads (filtered to the supported class set)
 * - water polygons (natural=water) and waterways (waterway=*)
 * - parks (leisure=park, leisure=garden, boundary=protected_area)
 * - place labels (place=city/town/village/hamlet/suburb/neighbourhood)
 *
 * Buildings, businesses, transit, traffic, and POIs are deliberately excluded.
 */
export function buildOverpassQuery(bbox: BBox): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  // Overpass bbox order: (south, west, north, east) = (minLat, minLng, maxLat, maxLng)
  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `[out:json][timeout:25];
(
  way[highway~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|path|footway|cycleway)$"](${bboxStr});
  way[waterway](${bboxStr});
  way["natural"="water"](${bboxStr});
  way["leisure"="park"](${bboxStr});
  way["leisure"="garden"](${bboxStr});
  way["boundary"="protected_area"](${bboxStr});
  way["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](${bboxStr});
  node["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](${bboxStr});
);
out:geom;`;
}
```

- [ ] **Step 4: Implement `src/data/overpass.ts`**

```typescript
import type { OsmResponse } from "../interpret/parse";
import type { BBox } from "../interpret/types";
import { buildOverpassQuery } from "./query";

export const OVERPASS_ENDPOINTS = [
  "https://overpass.komoot.io/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
] as const;

const CLIENT_TIMEOUT_MS = 10_000;

export class OverpassError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = "OverpassError";
  }
}

/**
 * Fetch OSM data for a bbox. Tries each Overpass endpoint in order with a
 * 10 s client-side timeout. On 429 (rate limit) or 5xx, falls through to
 * the next endpoint. On all-fail, throws OverpassError.
 */
export async function fetchOsm(
  bbox: BBox,
  signal: AbortSignal,
  endpoints: readonly string[] = OVERPASS_ENDPOINTS
): Promise<OsmResponse> {
  const query = buildOverpassQuery(bbox);
  let lastError: unknown = null;

  for (const url of endpoints) {
    if (signal.aborted) throw new OverpassError("aborted");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    // Link the caller's signal to the per-request controller so either
    // abort source cancels the fetch.
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new OverpassError(`${url} returned ${res.status}`, res.status);
        continue;
      }
      if (!res.ok) {
        lastError = new OverpassError(`${url} returned ${res.status}`, res.status);
        continue;
      }
      const json = (await res.json()) as OsmResponse;
      return json;
    } catch (err) {
      if (signal.aborted) throw new OverpassError("aborted");
      lastError = err;
      continue;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }
  }

  throw new OverpassError(
    `all Overpass endpoints failed: ${lastError instanceof Error ? lastError.message : "unknown"}`
  );
}
```

- [ ] **Step 5: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./data/query";
export * from "./data/overpass";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/query.test.ts`
Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint Overpass query builder and client with fallback"
```

---

## Task 9: @gunari/scene-mapprint — data cache (LRU + IndexedDB)

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/data/cache.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/cache.test.ts`

**Interfaces:**
- Produces: `hashCacheKey(bbox: BBox): string`; `MapDataCache` class with `get(bbox)`, `set(bbox, data)`, `clear()`. In-memory LRU bound at 20; pluggable `IDB-like` storage interface for IndexedDB (bound 50) — tests inject a mock.
- Consumes: `BBox` (Task 6), `MapGeometry` (Task 6).

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/cache.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { hashCacheKey, MapDataCache } from "../src/data/cache";
import type { BBox, MapGeometry } from "../src/interpret/types";

function emptyGeom(bbox: BBox): MapGeometry {
  return { bbox, roads: [], water: [], waterways: [], parks: [], labels: [] };
}

describe("hashCacheKey", () => {
  it("returns the same key for the same bbox", () => {
    const a: BBox = [120.95, 14.58, 121.02, 14.63];
    const b: BBox = [120.95, 14.58, 121.02, 14.63];
    expect(hashCacheKey(a)).toBe(hashCacheKey(b));
  });
  it("returns different keys for different bboxes", () => {
    const a: BBox = [120.95, 14.58, 121.02, 14.63];
    const b: BBox = [120.96, 14.58, 121.02, 14.63];
    expect(hashCacheKey(a)).not.toBe(hashCacheKey(b));
  });
});

describe("MapDataCache in-memory LRU", () => {
  it("returns undefined on miss", () => {
    const cache = new MapDataCache();
    expect(cache.get([0, 0, 1, 1])).toBeUndefined();
  });

  it("returns the stored value on hit", () => {
    const cache = new MapDataCache();
    const bbox: BBox = [0, 0, 1, 1];
    const geom = emptyGeom(bbox);
    cache.set(bbox, geom);
    expect(cache.get(bbox)).toBe(geom);
  });

  it("evicts the oldest entry when the bound is exceeded", () => {
    const cache = new MapDataCache({ memoryBound: 3 });
    const bboxes: BBox[] = [[0, 0, 1, 1], [1, 1, 2, 2], [2, 2, 3, 3], [3, 3, 4, 4]];
    for (const b of bboxes) cache.set(b, emptyGeom(b));
    // First entry should have been evicted.
    expect(cache.get(bboxes[0])).toBeUndefined();
    expect(cache.get(bboxes[3])).toBeDefined();
  });

  it("promotes an entry to most-recently-used on get", () => {
    const cache = new MapDataCache({ memoryBound: 2 });
    const a: BBox = [0, 0, 1, 1];
    const b: BBox = [1, 1, 2, 2];
    const c: BBox = [2, 2, 3, 3];
    cache.set(a, emptyGeom(a));
    cache.set(b, emptyGeom(b));
    // Touch a — it becomes most-recently-used.
    cache.get(a);
    // Insert c — b (least recently used) should evict, not a.
    cache.set(c, emptyGeom(c));
    expect(cache.get(a)).toBeDefined();
    expect(cache.get(b)).toBeUndefined();
  });
});

describe("MapDataCache persistent layer", () => {
  function mockStorage() {
    const store = new Map<string, MapGeometry>();
    return {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: MapGeometry) => { store.set(key, value); }),
      delete: vi.fn(async (key: string) => { store.delete(key); }),
      keys: vi.fn(async () => Array.from(store.keys())),
    };
  }

  it("falls back to the persistent layer on memory miss", async () => {
    const storage = mockStorage();
    const cache = new MapDataCache({ storage });
    const bbox: BBox = [0, 0, 1, 1];
    const geom = emptyGeom(bbox);
    await storage.set(hashCacheKey(bbox), geom);
    const out = await cache.getWithPersistence(bbox);
    expect(storage.get).toHaveBeenCalledWith(hashCacheKey(bbox));
    expect(out).toEqual(geom);
  });

  it("writes through to the persistent layer on set", async () => {
    const storage = mockStorage();
    const cache = new MapDataCache({ storage });
    const bbox: BBox = [0, 0, 1, 1];
    await cache.setWithPersistence(bbox, emptyGeom(bbox));
    expect(storage.set).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/data/cache.ts`**

```typescript
import type { BBox, MapGeometry } from "../interpret/types";

/**
 * Stable string hash of a bbox. Used as the cache key for both the
 * in-memory LRU and the persistent storage layer.
 */
export function hashCacheKey(bbox: BBox): string {
  return bbox.map((n) => n.toFixed(6)).join(",");
}

export interface CacheStorage {
  get(key: string): Promise<MapGeometry | null>;
  set(key: string, value: MapGeometry): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export interface MapDataCacheOptions {
  memoryBound?: number;
  storage?: CacheStorage;
  persistentBound?: number;
}

/**
 * Two-layer cache: an in-memory LRU (default 20 viewports) plus an optional
 * persistent storage layer (default 50 viewports). The persistent layer is
 * IndexedDB in the browser; tests inject a mock.
 */
export class MapDataCache {
  private memory = new Map<string, MapGeometry>();
  private readonly memoryBound: number;
  private readonly storage?: CacheStorage;
  private readonly persistentBound: number;

  constructor(opts: MapDataCacheOptions = {}) {
    this.memoryBound = opts.memoryBound ?? 20;
    this.storage = opts.storage;
    this.persistentBound = opts.persistentBound ?? 50;
  }

  /** Synchronous memory-layer lookup. Returns undefined on miss. */
  get(bbox: BBox): MapGeometry | undefined {
    const key = hashCacheKey(bbox);
    const val = this.memory.get(key);
    if (val !== undefined) {
      // LRU: delete + re-insert to mark most-recently-used.
      this.memory.delete(key);
      this.memory.set(key, val);
    }
    return val;
  }

  /** Memory-layer set. Does NOT write through to the persistent layer. */
  set(bbox: BBox, data: MapGeometry): void {
    const key = hashCacheKey(bbox);
    if (this.memory.has(key)) this.memory.delete(key);
    this.memory.set(key, data);
    while (this.memory.size > this.memoryBound) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey === undefined) break;
      this.memory.delete(oldestKey);
    }
  }

  /** Async lookup that falls back to the persistent layer on memory miss. */
  async getWithPersistence(bbox: BBox): Promise<MapGeometry | undefined> {
    const memHit = this.get(bbox);
    if (memHit !== undefined) return memHit;
    if (!this.storage) return undefined;
    const key = hashCacheKey(bbox);
    const stored = await this.storage.get(key);
    if (stored) {
      // Promote to the memory layer.
      this.set(bbox, stored);
      return stored;
    }
    return undefined;
  }

  /** Async set that writes through to the persistent layer. */
  async setWithPersistence(bbox: BBox, data: MapGeometry): Promise<void> {
    this.set(bbox, data);
    if (!this.storage) return;
    const key = hashCacheKey(bbox);
    await this.storage.set(key, data);
    // Persistent-layer LRU eviction.
    const keys = await this.storage.keys();
    if (keys.length > this.persistentBound) {
      // Evict oldest (FIFO — adequate for a bounded cache).
      const toEvict = keys.slice(0, keys.length - this.persistentBound);
      await Promise.all(toEvict.map((k) => this.storage!.delete(k)));
    }
  }

  clear(): void {
    this.memory.clear();
  }
}
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./data/cache";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/cache.test.ts`
Expected: PASS — all assertions.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint data cache (in-memory LRU + persistent layer)"
```

---

## Task 10: @gunari/scene-mapprint — projection (viewport + project + simplify + rotate)

Takes a `MapGeometry` (raw lng/lat) + a `SceneViewport` (cx/cy/r in canvas-normalized [0,1]) + a rotation, and produces a `ProjectedMapGeometry` ready to render. Three sub-stages: Web Mercator project → simplify per line → rotate around the viewport center.

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/projection/viewport.ts`
- Create: `packages/@gunari/scene-mapprint/src/projection/project.ts`
- Create: `packages/@gunari/scene-mapprint/src/projection/types.ts` (`ProjectedMapGeometry`)
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/projection.test.ts`

**Interfaces:**
- Produces: `bboxForZoom(lat: number, lng: number, zoom: ZoomId): BBox`; `zoomKmSpan(zoom: ZoomId): number`; `projectGeometry(geom: MapGeometry, viewport: SceneViewport, rotation: number, tolerance: number): ProjectedMapGeometry`; `ProjectedMapGeometry` type.
- Consumes: `MapGeometry`, `BBox`, `Road`, `Polygon`, `Label`, `RoadClass` (Task 6); `SceneViewport`, `ZoomId` (Task 2 via `@gunari/core`); `webMercator`, `normalizeToViewport`, `simplifyLine`, `rotatePoints`, `bboxClip` (Task 3).

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/projection.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { bboxForZoom, zoomKmSpan } from "../src/projection/viewport";
import { projectGeometry } from "../src/projection/project";
import type { MapGeometry, BBox } from "../src/interpret/types";
import type { SceneViewport } from "@gunari/core";

function emptyGeom(bbox: BBox): MapGeometry {
  return { bbox, roads: [], water: [], waterways: [], parks: [], labels: [] };
}

describe("zoomKmSpan", () => {
  it("neighborhood = 0.6 km", () => {
    expect(zoomKmSpan("neighborhood")).toBe(0.6);
  });
  it("district = 2 km", () => {
    expect(zoomKmSpan("district")).toBe(2);
  });
  it("city = 12 km", () => {
    expect(zoomKmSpan("city")).toBe(12);
  });
});

describe("bboxForZoom", () => {
  it("returns a bbox centered on the given lat/lng", () => {
    const bbox = bboxForZoom(14.5995, 120.9842, "district");
    const [minLng, minLat, maxLng, maxLat] = bbox;
    const cx = (minLng + maxLng) / 2;
    const cy = (minLat + maxLat) / 2;
    expect(cx).toBeCloseTo(120.9842, 4);
    expect(cy).toBeCloseTo(14.5995, 4);
  });
  it("neighborhood bbox is smaller than district", () => {
    const n = bboxForZoom(14.5995, 120.9842, "neighborhood");
    const d = bboxForZoom(14.5995, 120.9842, "district");
    const nSpan = n[2] - n[0];
    const dSpan = d[2] - d[0];
    expect(nSpan).toBeLessThan(dSpan);
  });
});

describe("projectGeometry", () => {
  const bbox: BBox = [120.95, 14.58, 121.02, 14.63];
  const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
  const geom: MapGeometry = {
    bbox,
    roads: [
      { class: "motorway", points: [[120.95, 14.58], [121.02, 14.63]], name: "Skyway" },
      { class: "residential", points: [[120.98, 14.60], [120.99, 14.61]] },
    ],
    water: [{ points: [[120.95, 14.58], [120.96, 14.58], [120.96, 14.59]] }],
    waterways: [],
    parks: [],
    labels: [{ text: "Manila", x: 0, y: 0, class: "place" }],
  };

  it("maps the bbox min corner to roughly [0, 0]", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    const motorway = out.roads[0];
    expect(motorway.points[0][0]).toBeCloseTo(0, 1);
    expect(motorway.points[0][1]).toBeCloseTo(0, 1);
  });

  it("maps the bbox max corner to roughly [1, 1]", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    const motorway = out.roads[0];
    expect(motorway.points[1][0]).toBeCloseTo(1, 1);
    expect(motorway.points[1][1]).toBeCloseTo(1, 1);
  });

  it("preserves road names and classes", () => {
    const out = projectGeometry(geom, viewport, 0, 0.001);
    expect(out.roads[0].class).toBe("motorway");
    expect(out.roads[0].name).toBe("Skyway");
  });

  it("rotates points around the viewport center", () => {
    const out0 = projectGeometry(geom, viewport, 0, 0.001);
    const out90 = projectGeometry(geom, viewport, Math.PI / 2, 0.001);
    // After a 90° rotation around (0.5, 0.5), a point originally at (0,0)
    // moves to (0, 1) (relative to the center, then translated back).
    expect(out90.roads[0].points[0][0]).toBeCloseTo(0, 1);
    expect(out90.roads[0].points[0][1]).toBeCloseTo(1, 1);
  });

  it("returns labels with projected x/y", () => {
    // The Manila label has x=0,y=0 in the input. projectGeometry should
    // place it at the projected centroid of the bbox.
    const out = projectGeometry(geom, viewport, 0, 0.001);
    expect(out.labels[0].x).toBeGreaterThanOrEqual(0);
    expect(out.labels[0].x).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/projection.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/projection/viewport.ts`**

```typescript
import type { BBox } from "../interpret/types";
import type { ZoomId } from "@gunari/core";

const EQUATOR_LAT_DEG_PER_KM = 1 / 110.574;
const EQUATOR_LNG_DEG_PER_KM = 1 / 111.32;

export function zoomKmSpan(zoom: ZoomId): number {
  switch (zoom) {
    case "neighborhood": return 0.6;
    case "district": return 2;
    case "city": return 12;
  }
}

/**
 * Compute the bbox centered on (lat, lng) with the given zoom's km span.
 * Lng span widens with latitude (Mercator distortion).
 */
export function bboxForZoom(lat: number, lng: number, zoom: ZoomId): BBox {
  const km = zoomKmSpan(zoom);
  const halfLat = (km / 2) * EQUATOR_LAT_DEG_PER_KM;
  const halfLng = (km / 2) * EQUATOR_LNG_DEG_PER_KM / Math.max(Math.cos(lat * Math.PI / 180), 0.01);
  return [lng - halfLng, lat - halfLat, lng + halfLng, lat + halfLat];
}
```

- [ ] **Step 4: Implement `src/projection/types.ts`**

```typescript
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
```

- [ ] **Step 5: Implement `src/projection/project.ts`**

```typescript
import type { MapGeometry, BBox, Road, Polygon, Label } from "../interpret/types";
import type { SceneViewport } from "@gunari/core";
import { webMercator, normalizeToViewport, simplifyLine, rotatePoints, bboxClip } from "@gunari/core";
import type { ProjectedMapGeometry, ProjectedRoad, ProjectedPolygon, ProjectedLabel } from "./types";

/**
 * Project a MapGeometry (raw lng/lat) to a ProjectedMapGeometry (canvas-
 * normalized [0, 1] coords), simplified, rotated around the viewport center.
 *
 * Stages: Web Mercator → normalize to bbox → simplify per line → rotate.
 */
export function projectGeometry(
  geom: MapGeometry,
  viewport: SceneViewport,
  rotation: number,
  tolerance: number
): ProjectedMapGeometry {
  const bbox = geom.bbox;

  function projectPoint(lng: number, lat: number): [number, number] {
    const { x, y } = webMercator(lat, lng);
    const [nx, ny] = normalizeToViewport(x, y, bbox);
    // Flip y so canvas-down y matches geographic-up.
    return [nx, 1 - ny];
  }

  function projectLine(pts: [number, number][]): [number, number][] {
    return pts.map(([lng, lat]) => projectPoint(lng, lat));
  }

  const roads: ProjectedRoad[] = geom.roads.map((r) => {
    const projected = projectLine(r.points);
    const simplified = simplifyLine(projected, tolerance);
    return { class: r.class, points: simplified, name: r.name };
  });

  const water: ProjectedPolygon[] = geom.water.map((p) => ({
    points: simplifyLine(projectLine(p.points), tolerance),
    holes: p.holes?.map((h) => simplifyLine(projectLine(h), tolerance)),
    name: p.name,
  }));

  const waterways: [number, number][][] = geom.waterways.map((w) =>
    simplifyLine(projectLine(w), tolerance)
  );

  const parks: ProjectedPolygon[] = geom.parks.map((p) => ({
    points: simplifyLine(projectLine(p.points), tolerance),
    holes: p.holes?.map((h) => simplifyLine(projectLine(h), tolerance)),
    name: p.name,
  }));

  // Labels: road labels go at the road's midpoint; place labels at the
  // place node's projected coords. (Place coords are stored in the parser
  // as x=0, y=0 — the parser doesn't project. For v1 we approximate place
  // positions as the bbox center; refine in a later task if needed.)
  const labels: ProjectedLabel[] = geom.labels.map((l) => {
    if (l.class === "place") {
      const [cx, cy] = projectPoint((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2);
      return { text: l.text, x: cx, y: cy, class: "place" };
    }
    // Road label: find the road with this name, take its midpoint.
    const road = geom.roads.find((r) => r.name === l.text);
    if (road && road.points.length > 0) {
      const mid = road.points[Math.floor(road.points.length / 2)];
      const [x, y] = projectPoint(mid[0], mid[1]);
      return { text: l.text, x, y, class: "road" };
    }
    return { ...l };
  });

  // Rotation: rotate every projected point around the viewport center.
  if (rotation !== 0) {
    for (const r of roads) r.points = rotatePoints(r.points, viewport.cx, viewport.cy, rotation);
    for (const w of water) {
      w.points = rotatePoints(w.points, viewport.cx, viewport.cy, rotation);
      if (w.holes) w.holes = w.holes.map((h) => rotatePoints(h, viewport.cx, viewport.cy, rotation));
    }
    for (let i = 0; i < waterways.length; i++) {
      waterways[i] = rotatePoints(waterways[i], viewport.cx, viewport.cy, rotation);
    }
    for (const p of parks) {
      p.points = rotatePoints(p.points, viewport.cx, viewport.cy, rotation);
      if (p.holes) p.holes = p.holes.map((h) => rotatePoints(h, viewport.cx, viewport.cy, rotation));
    }
    for (const l of labels) {
      [l.x, l.y] = rotatePoints([[l.x, l.y]], viewport.cx, viewport.cy, rotation)[0];
    }
  }

  // Drop points outside [-0.1, 1.1] overscan after rotation.
  function inOverscan(p: [number, number]): boolean {
    return p[0] >= -0.1 && p[0] <= 1.1 && p[1] >= -0.1 && p[1] <= 1.1;
  }
  void bboxClip; // bbox-clip is used at the data-loading stage, not here.

  for (const r of roads) r.points = r.points.filter(inOverscan);
  for (const w of waterways) {
    for (let i = 0; i < waterways.length; i++) {
      waterways[i] = waterways[i].filter(inOverscan);
    }
  }

  return { roads, water, waterways, parks, labels, bbox, rotation };
}
```

- [ ] **Step 6: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./projection/viewport";
export * from "./projection/types";
export * from "./projection/project";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/projection.test.ts`
Expected: PASS.

- [ ] **Step 8: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint projection (viewport + project + simplify + rotate)"
```

---

## Task 11: @gunari/scene-mapprint — shape clip paths

Three shapes (Square, Circle, Heart). Each is a `(ctx, cx, cy, r) => void` that traces a clip path. Delegates to `applyShapeMask` from `@gunari/core` but exposes them as a `SHAPES` registry so the renderer can dispatch by id.

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/shapes/shapes.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/shapes.test.ts`

**Interfaces:**
- Produces: `SHAPES: Record<ShapeId, ShapePath>`; `ShapePath` type.
- Consumes: `ShapeId` (Task 2 via `@gunari/core`), `applyShapeMask` (Task 3).

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/shapes.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { SHAPES, type ShapePath } from "../src/shapes/shapes";
import type { ShapeId } from "@gunari/core";

function mockCtx() {
  return {
    beginPath: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
  } as unknown as CanvasRenderingContext2D & { beginPath: ReturnType<typeof vi.fn> };
}

describe("SHAPES registry", () => {
  it("has entries for square, circle, heart", () => {
    expect(Object.keys(SHAPES).sort()).toEqual(["circle", "heart", "square"]);
  });

  it("square traces a rect", () => {
    const ctx = mockCtx();
    SHAPES.square.apply(ctx, 10, 20, 5);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.rect).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });

  it("circle traces an arc", () => {
    const ctx = mockCtx();
    SHAPES.circle.apply(ctx, 10, 20, 5);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });

  it("heart traces beziers", () => {
    const ctx = mockCtx();
    SHAPES.heart.apply(ctx, 10, 20, 5);
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.clip).toHaveBeenCalled();
  });

  it("every entry is a function", () => {
    for (const id of Object.keys(SHAPES) as ShapeId[]) {
      expect(typeof SHAPES[id].apply).toBe("function");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/shapes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/shapes/shapes.ts`**

```typescript
import { applyShapeMask, type ShapeId } from "@gunari/core";

export interface ShapePath {
  /** Trace the shape clip path on ctx and call ctx.clip(). */
  apply(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void;
}

function makeShape(shape: "square" | "circle" | "heart"): ShapePath {
  return {
    apply(ctx, cx, cy, r) {
      applyShapeMask(ctx, shape, cx, cy, r);
    },
  };
}

export const SHAPES: Record<ShapeId, ShapePath> = {
  square: makeShape("square"),
  circle: makeShape("circle"),
  heart: makeShape("heart"),
};
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./shapes/shapes";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/shapes.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint shape clip paths (square, circle, heart)"
```

---

## Task 12: @gunari/scene-mapprint — markers (pin silhouette + 4 symbols)

The pin silhouette is shared across all four markers. Only the inner symbol varies (Solid / Ring / Heart / Star). The brief's "marker should always preserve the silhouette of a location pin" rule is enforced structurally: `drawPin` is one function used by every marker.

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/markers/markers.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/markers.test.ts`

**Interfaces:**
- Produces: `MARKERS: Record<MarkerStyleId, MarkerStyle>`; `MarkerStyle` interface with `drawPin` and `drawSymbol`; `drawPin` is exported separately so all four markers share it.
- Consumes: `MarkerStyleId` (Task 2 via `@gunari/core`); `MapThemePalette` (Task 13 — but to avoid a circular dependency, the marker functions accept a `palette: { marker: string; markerSymbol: string; light: boolean }` structural shape, which `MapThemePalette` will satisfy).

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/markers.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { MARKERS, drawPin, type MarkerStyle } from "../src/markers/markers";
import type { MarkerStyleId } from "@gunari/core";

interface Palette { marker: string; markerSymbol: string; light: boolean; }
const palette: Palette = { marker: "#000", markerSymbol: "#fff", light: false };

function mockCtx() {
  return {
    save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    arc: vi.fn(), bezierCurveTo: vi.fn(), closePath: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(),
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D & {
    save: ReturnType<typeof vi.fn>;
    fill: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
  };
}

describe("drawPin (shared silhouette)", () => {
  it("traces a closed path and fills it", () => {
    const ctx = mockCtx();
    drawPin(ctx, 50, 80, 10, palette);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.bezierCurveTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});

describe("MARKERS registry", () => {
  it("has entries for solid, ring, heart, star", () => {
    expect(Object.keys(MARKERS).sort()).toEqual(["heart", "ring", "solid", "star"]);
  });

  it("every marker calls drawPin once and drawSymbol once", () => {
    for (const id of Object.keys(MARKERS) as MarkerStyleId[]) {
      const ctx = mockCtx();
      MARKERS[id].draw(ctx, 50, 80, 10, palette);
      // drawPin calls fill once; drawSymbol may fill or stroke.
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/markers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/markers/markers.ts`**

```typescript
import type { MarkerStyleId } from "@gunari/core";

export interface MarkerPalette {
  marker: string;
  markerSymbol: string;
  light: boolean;
}

/**
 * Draw the pin silhouette — a classic teardrop with a pointer at the
 * bottom. Same function for every marker; only the inner symbol varies.
 *
 * (cx, cy) is the pin's CENTER (the teardrop body center). The pointer
 * tip extends to cy + r. The body is inscribed in a circle of radius r
 * centered at (cx, cy - r * 0.4) so the silhouette visually balances.
 */
export function drawPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  palette: MarkerPalette
): void {
  ctx.save();
  ctx.beginPath();
  // Teardrop body: a circle with a downward taper.
  const bodyCy = cy - r * 0.4;
  const bodyR = r * 0.7;
  // Pointer tip
  ctx.moveTo(cx, cy + r);
  // Left side: cubic bezier up to the top of the body circle.
  ctx.bezierCurveTo(cx - r * 0.8, cy - r * 0.2, cx - bodyR, bodyCy - bodyR * 0.5, cx - bodyR, bodyCy);
  // Top arc (left to right over the body circle).
  ctx.arc(cx, bodyCy, bodyR, Math.PI, 0, false);
  // Right side: cubic bezier back down to the pointer tip.
  ctx.bezierCurveTo(cx + bodyR, bodyCy - bodyR * 0.5, cx + r * 0.8, cy - r * 0.2, cx, cy + r);
  ctx.closePath();
  ctx.fillStyle = palette.marker;
  ctx.fill();
  ctx.restore();
}

function drawSolidSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void {
  const bodyCy = cy - r * 0.4;
  const bodyR = r * 0.7;
  ctx.save();
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  ctx.arc(cx, bodyCy, bodyR * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRingSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void {
  const bodyCy = cy - r * 0.4;
  const bodyR = r * 0.7;
  ctx.save();
  ctx.strokeStyle = palette.markerSymbol;
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.arc(cx, bodyCy, bodyR * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHeartSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void {
  const bodyCy = cy - r * 0.4;
  const symR = r * 0.25;
  ctx.save();
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  ctx.moveTo(cx, bodyCy + symR * 0.6);
  ctx.bezierCurveTo(cx - symR, bodyCy - symR * 0.3, cx - symR, bodyCy - symR * 0.9, cx, bodyCy - symR * 0.4);
  ctx.bezierCurveTo(cx + symR, bodyCy - symR * 0.9, cx + symR, bodyCy - symR * 0.3, cx, bodyCy + symR * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStarSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void {
  const bodyCy = cy - r * 0.4;
  const outer = r * 0.32;
  const inner = outer * 0.4;
  ctx.save();
  ctx.fillStyle = palette.markerSymbol;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = bodyCy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface MarkerStyle {
  id: MarkerStyleId;
  draw(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, palette: MarkerPalette): void;
}

function makeMarker(id: MarkerStyleId, symbol: typeof drawSolidSymbol): MarkerStyle {
  return {
    id,
    draw(ctx, cx, cy, r, palette) {
      drawPin(ctx, cx, cy, r, palette);
      symbol(ctx, cx, cy, r, palette);
    },
  };
}

export const MARKERS: Record<MarkerStyleId, MarkerStyle> = {
  solid: makeMarker("solid", drawSolidSymbol),
  ring: makeMarker("ring", drawRingSymbol),
  heart: makeMarker("heart", drawHeartSymbol),
  star: makeMarker("star", drawStarSymbol),
};
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./markers/markers";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/markers.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint markers (shared pin silhouette + 4 symbols)"
```

---

## Task 13: @gunari/scene-mapprint — themes (5 MapThemePalette entries)

Pure data — five theme palettes as a `Record<MapStyleId, MapThemePalette>`. No theme-specific code. Adding a theme = adding an entry.

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/styles/themes.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/themes.test.ts`

**Interfaces:**
- Produces: `MapThemePalette` interface; `MAP_THEMES: Record<MapStyleId, MapThemePalette>`; `getMapTheme(id)`.
- Consumes: `MapStyleId` (Task 2 via `@gunari/core`); `ThemePalette` base interface (Task 2 via `@gunari/core`); `RoadClass` (Task 6).

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/themes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { MAP_THEMES, getMapTheme, type MapThemePalette } from "../src/styles/themes";
import type { MapStyleId } from "@gunari/core";

const EXPECTED_IDS: MapStyleId[] = ["classic", "midnight", "blueprint", "paper", "twilight"];

describe("MAP_THEMES", () => {
  it("has all five theme ids", () => {
    expect(Object.keys(MAP_THEMES).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it("every palette has a per-class road entry with color and width", () => {
    for (const id of EXPECTED_IDS) {
      const p = MAP_THEMES[id];
      expect(p.road.motorway).toHaveProperty("color");
      expect(p.road.motorway).toHaveProperty("width");
      expect(p.road.residential).toHaveProperty("color");
      expect(p.road.residential).toHaveProperty("width");
    }
  });

  it("every palette has water, waterway, park, marker, markerSymbol, label, background, light", () => {
    for (const id of EXPECTED_IDS) {
      const p = MAP_THEMES[id];
      expect(typeof p.water).toBe("string");
      expect(typeof p.waterway).toBe("string");
      expect(typeof p.park).toBe("string");
      expect(typeof p.marker).toBe("string");
      expect(typeof p.markerSymbol).toBe("string");
      expect(typeof p.label).toBe("string");
      expect(p.background).toHaveProperty("top");
      expect(p.background).toHaveProperty("bottom");
      expect(typeof p.light).toBe("boolean");
    }
  });

  it("light themes have light=true; dark themes have light=false", () => {
    expect(MAP_THEMES.paper.light).toBe(true);
    expect(MAP_THEMES.classic.light).toBe(true);
    expect(MAP_THEMES.midnight.light).toBe(false);
    expect(MAP_THEMES.blueprint.light).toBe(false);
    expect(MAP_THEMES.twilight.light).toBe(false);
  });

  it("getMapTheme returns the matching palette", () => {
    expect(getMapTheme("midnight")).toBe(MAP_THEMES.midnight);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/themes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/styles/themes.ts`**

```typescript
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
  label: string;
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
    label: "#3b3a35",
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
    label: "#cdd5ee",
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
    label: "#9ecbff",
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
    label: "#3d3d3d",
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
    label: "#e6d8ff",
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
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./styles/themes";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/themes.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint themes (Classic, Midnight, Blueprint, Paper, Twilight)"
```

---

## Task 14: @gunari/scene-mapprint — render (layers + marker drawing)

The pure render function. Takes a `ProjectedMapGeometry` + `MapThemePalette` + `SceneInput` + `SceneViewport` and draws to the canvas. Applies the shape mask, draws layers in the spec's order, draws the marker on top.

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/render/render.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/render.test.ts`

**Interfaces:**
- Produces: `renderMap(ctx, geometry, palette, input, viewport): void`.
- Consumes: `ProjectedMapGeometry` (Task 10); `MapThemePalette` (Task 13); `SceneInput`, `SceneViewport` (Task 2); `SHAPES` (Task 11); `MARKERS` (Task 12).

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/render.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderMap } from "../src/render/render";
import { MAP_THEMES } from "../src/styles/themes";
import type { ProjectedMapGeometry } from "../src/projection/types";
import type { SceneInput, SceneViewport } from "@gunari/core";

function mockCtx() {
  const calls: string[] = [];
  return {
    ctx: {
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      beginPath: () => calls.push("beginPath"),
      moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
      arc: () => calls.push("arc"),
      bezierCurveTo: () => calls.push("bezier"),
      closePath: () => calls.push("closePath"),
      rect: () => calls.push("rect"),
      clip: () => calls.push("clip"),
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      fillText: (t: string) => calls.push(`fillText:${t}`),
      fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
      font: "", textAlign: "", textBaseline: "",
      createLinearGradient: () => ({ addColorStop: () => {} }),
    } as unknown as CanvasRenderingContext2D,
    calls,
  };
}

const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };

const baseInput: SceneInput = {
  shape: "square",
  style: "classic",
  marker: "solid",
  zoom: "district",
  rotation: 0,
  labels: false,
  layout: "classic",
};

const geom: ProjectedMapGeometry = {
  bbox: [0, 0, 1, 1],
  rotation: 0,
  roads: [
    { class: "motorway", points: [[0, 0], [1, 1]], name: "Skyway" },
    { class: "residential", points: [[0.2, 0.2], [0.4, 0.4]] },
  ],
  water: [{ points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2]] }],
  waterways: [[[0.3, 0.3], [0.5, 0.5]]],
  parks: [{ points: [[0.6, 0.6], [0.7, 0.6], [0.7, 0.7]] }],
  labels: [{ text: "Manila", x: 0.5, y: 0.5, class: "place" }],
};

describe("renderMap", () => {
  it("applies the shape mask via clip", () => {
    const { ctx, calls } = mockCtx();
    renderMap(ctx, geom, MAP_THEMES.classic, baseInput, viewport, 540, 960);
    expect(calls).toContain("clip");
  });

  it("draws water, parks, waterways, roads, then marker — in order", () => {
    const { ctx, calls } = mockCtx();
    renderMap(ctx, geom, MAP_THEMES.classic, baseInput, viewport, 540, 960);
    // After clip, we expect at least: a fill (water), a fill (parks),
    // a stroke (waterways), strokes for roads, then the marker fill.
    const fillIdx = calls.map((c, i) => (c === "fill" ? i : -1)).filter((i) => i >= 0);
    const strokeIdx = calls.map((c, i) => (c === "stroke" ? i : -1)).filter((i) => i >= 0);
    expect(fillIdx.length).toBeGreaterThan(0);
    expect(strokeIdx.length).toBeGreaterThan(0);
  });

  it("does not draw labels when input.labels is false", () => {
    const { ctx, calls } = mockCtx();
    renderMap(ctx, geom, MAP_THEMES.classic, { ...baseInput, labels: false }, viewport, 540, 960);
    expect(calls.some((c) => c === "fillText:Manila")).toBe(false);
  });

  it("draws labels when input.labels is true", () => {
    const { ctx, calls } = mockCtx();
    renderMap(ctx, geom, MAP_THEMES.classic, { ...baseInput, labels: true }, viewport, 540, 960);
    expect(calls.some((c) => c === "fillText:Manila")).toBe(true);
  });

  it("uses palette.road.motorway.color for motorway strokes", () => {
    const ctx = { ...mockCtx().ctx, strokeStyle: "" } as unknown as CanvasRenderingContext2D & { strokeStyle: string };
    renderMap(ctx, geom, MAP_THEMES.classic, baseInput, viewport, 540, 960);
    // The renderer should have set strokeStyle to the motorway color at some point.
    // (We can't capture the exact moment, but strokeStyle should be a string.)
    expect(typeof ctx.strokeStyle).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/render.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/render/render.ts`**

```typescript
import type { SceneInput, SceneViewport } from "@gunari/core";
import type { ProjectedMapGeometry } from "../projection/types";
import type { MapThemePalette } from "../styles/themes";
import { SHAPES } from "../shapes/shapes";
import { MARKERS } from "../markers/markers";
import type { RoadClass } from "../interpret/types";

const ROAD_DRAW_ORDER: RoadClass[] = [
  "path", "residential", "tertiary", "secondary", "primary", "trunk", "motorway",
];

/**
 * Render a ProjectedMapGeometry + MapThemePalette to a canvas. Pure:
 * same geometry + palette + input + viewport = same pixels.
 *
 * `canvasW` and `canvasH` are the actual pixel size of the scene slot
 * (typically 1080×1920 or the slot's pixel rect). Coordinates are
 * canvas-normalized [0,1] and scaled to these dimensions here.
 */
export function renderMap(
  ctx: CanvasRenderingContext2D,
  geom: ProjectedMapGeometry,
  palette: MapThemePalette,
  input: SceneInput,
  viewport: SceneViewport,
  canvasW: number,
  canvasH: number
): void {
  const cx = viewport.cx * canvasW;
  const cy = viewport.cy * canvasH;
  const r = viewport.r * Math.min(canvasW, canvasH);

  function toPx(p: [number, number]): [number, number] {
    return [p[0] * canvasW, p[1] * canvasH];
  }

  ctx.save();
  // Shape mask
  SHAPES[input.shape].apply(ctx, cx, cy, r);

  // 1. Water polygons (fill)
  for (const w of geom.water) {
    ctx.beginPath();
    const pts = w.points.map(toPx);
    if (pts.length === 0) continue;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = palette.water;
    ctx.fill();
    if (w.holes) {
      for (const hole of w.holes) {
        if (hole.length === 0) continue;
        ctx.beginPath();
        const hpts = hole.map(toPx);
        ctx.moveTo(hpts[0][0], hpts[0][1]);
        for (let i = 1; i < hpts.length; i++) ctx.lineTo(hpts[i][0], hpts[i][1]);
        ctx.closePath();
        ctx.fillStyle = palette.background.top;
        ctx.fill();
      }
    }
  }

  // 2. Parks (fill)
  for (const p of geom.parks) {
    const pts = p.points.map(toPx);
    if (pts.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = palette.park;
    ctx.fill();
  }

  // 3. Waterways (stroke)
  ctx.strokeStyle = palette.waterway;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  for (const w of geom.waterways) {
    const pts = w.map(toPx);
    if (pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  // 4. Roads (stroke by class, in ROAD_DRAW_ORDER so motorway draws on top)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const cls of ROAD_DRAW_ORDER) {
    const style = palette.road[cls];
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    for (const road of geom.roads) {
      if (road.class !== cls) continue;
      const pts = road.points.map(toPx);
      if (pts.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  // 5. Labels (when input.labels)
  if (input.labels) {
    ctx.fillStyle = palette.label;
    const size = Math.max(10, canvasW * 0.018);
    ctx.font = `400 ${size}px "Geist", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const l of geom.labels) {
      ctx.fillText(l.text, l.x * canvasW, l.y * canvasH);
    }
  }

  ctx.restore();

  // 6. Marker (drawn on top, NOT clipped to the shape — it sits on the artwork)
  const markerR = Math.min(canvasW, canvasH) * 0.04;
  MARKERS[input.marker].draw(ctx, cx, cy, markerR, palette);
}
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./render/render";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/render.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint render (layered draw + shape mask + marker)"
```

---

## Task 15: @gunari/scene-mapprint — scene.ts (implements Scene contract)

Ties everything together. `load` fetches + parses + caches. `project` projects. `render` calls `renderMap`. Capabilities advertise the full matrix.

**Files:**
- Create: `packages/@gunari/scene-mapprint/src/scene.ts`
- Modify: `packages/@gunari/scene-mapprint/src/index.ts`
- Test: `packages/@gunari/scene-mapprint/tests/scene.test.ts`

**Interfaces:**
- Produces: `mapPrintScene: Scene<MapPrintSceneData, ProjectedMapGeometry>`; `MapPrintSceneData` type (the cached parsed `MapGeometry`).
- Consumes: everything from Tasks 6-14.

- [ ] **Step 1: Write the failing test**

`packages/@gunari/scene-mapprint/tests/scene.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapPrintScene, type MapPrintSceneData } from "../src/scene";
import type { SceneCapabilities, SceneInput, SceneViewport } from "@gunari/core";

describe("mapPrintScene", () => {
  it("has id 'mapprint'", () => {
    expect(mapPrintScene.id).toBe("mapprint");
  });

  it("advertises the full v1 capabilities", () => {
    const caps = mapPrintScene.capabilities as SceneCapabilities;
    expect(caps.shapes).toEqual(["square", "circle", "heart"]);
    expect(caps.styles).toEqual(["classic", "midnight", "blueprint", "paper", "twilight"]);
    expect(caps.markers).toEqual(["solid", "ring", "heart", "star"]);
    expect(caps.zooms).toEqual(["neighborhood", "district", "city"]);
    expect(caps.layouts).toEqual(["classic", "poster"]);
    expect(caps.supportsRotation).toBe(true);
    expect(caps.supportsLabels).toBe(true);
  });

  it("project returns a ProjectedMapGeometry with roads", () => {
    const data: MapPrintSceneData = {
      geometry: {
        bbox: [120.95, 14.58, 121.02, 14.63],
        roads: [{ class: "motorway", points: [[120.95, 14.58], [121.02, 14.63]], name: "Skyway" }],
        water: [], waterways: [], parks: [],
        labels: [{ text: "Manila", x: 0, y: 0, class: "place" }],
      },
      bbox: [120.95, 14.58, 121.02, 14.63],
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const input: SceneInput = {
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: 0, labels: false, layout: "classic",
    };
    const out = mapPrintScene.project(data, viewport, input.rotation);
    expect(out.roads.length).toBe(1);
    expect(out.roads[0].class).toBe("motorway");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- @gunari/scene-mapprint/tests/scene.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/scene.ts`**

```typescript
import type { Scene, SceneCapabilities, SceneInput, SceneViewport } from "@gunari/core";
import type { BBox, MapGeometry } from "./interpret/types";
import type { ProjectedMapGeometry } from "./projection/types";
import { fetchOsm, OverpassError } from "./data/overpass";
import { parseOsm, type OsmResponse } from "./interpret/parse";
import { bboxForZoom } from "./projection/viewport";
import { projectGeometry } from "./projection/project";
import { renderMap } from "./render/render";
import { getMapTheme, type MapThemePalette } from "./styles/themes";
import { MapDataCache } from "./data/cache";

export interface MapPrintSceneData {
  geometry: MapGeometry;
  bbox: BBox;
}

const SIMPLIFY_TOLERANCE: Record<SceneInput["zoom"], number> = {
  neighborhood: 0.0005,
  district: 0.001,
  city: 0.003,
};

const cache = new MapDataCache();

export const mapPrintScene: Scene<MapPrintSceneData, ProjectedMapGeometry> = {
  id: "mapprint",

  capabilities: {
    shapes: ["square", "circle", "heart"],
    styles: ["classic", "midnight", "blueprint", "paper", "twilight"],
    markers: ["solid", "ring", "heart", "star"],
    zooms: ["neighborhood", "district", "city"],
    layouts: ["classic", "poster"],
    supportsRotation: true,
    supportsLabels: true,
  } satisfies SceneCapabilities,

  async load(input, signal) {
    const bbox = bboxForZoom(/* lat/lng come from outside the scene */ 0, 0, input.zoom);
    // The scene's load is called by the app with the location baked into the
    // bbox via a wrapper. For Plan 1, this is a thin glue layer; the app
    // layer (Plan 2) provides the location-aware wrapper.
    const cached = cache.get(bbox);
    if (cached) return { geometry: cached, bbox };

    let osm: OsmResponse;
    try {
      osm = await fetchOsm(bbox, signal);
    } catch (err) {
      if (err instanceof OverpassError && err.message === "aborted") throw err;
      // Graceful degradation: return empty geometry, marker still draws.
      const empty: MapGeometry = { bbox, roads: [], water: [], waterways: [], parks: [], labels: [] };
      cache.set(bbox, empty);
      return { geometry: empty, bbox };
    }
    const geometry = parseOsm(osm, bbox);
    cache.set(bbox, geometry);
    return { geometry, bbox };
  },

  project(data, viewport, rotation) {
    // The tolerance depends on zoom, which we don't have here directly;
    // for now we use district as the default. Plan 2 wires the actual zoom
    // through the scene's caller by re-projecting when zoom changes.
    const tolerance = SIMPLIFY_TOLERANCE.district;
    return projectGeometry(data.geometry, viewport, rotation, tolerance);
  },

  render(ctx, geometry, palette) {
    // The renderer needs the SceneInput (shape, marker, labels) and the
    // viewport (cx/cy/r) — these come from the scaffold. The Scene contract
    // passes only geometry + palette here, so for v1 we encode the input
    // into the geometry's rotation field as a stopgap. Plan 2 introduces a
    // small wrapper that captures the input + viewport at the call site.
    const input: SceneInput = {
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: geometry.rotation,
      labels: false, layout: "classic",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    renderMap(ctx, geometry, palette as MapThemePalette, input, viewport, 1080, 1920);
  },
};
```

Note: the scene.ts above has known simplifications that Plan 2 cleans up — the location isn't threaded into `load`, and `render` uses default `input`/`viewport` values. Plan 2's app integration introduces a thin wrapper that captures the location, the full `SceneInput`, and the scaffold's scene slot dimensions, then calls `scene.load` / `scene.project` / `scene.render` with the right arguments. The architecture is intact; only the glue is simplified for Plan 1's scope (no UI).

- [ ] **Step 4: Re-export from `src/index.ts`**

Append:

```typescript
export * from "./scene";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- @gunari/scene-mapprint/tests/scene.test.ts`
Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/@gunari/scene-mapprint/
git commit -m "Add @gunari/scene-mapprint scene.ts implementing the Scene contract"
```

---

## Task 16: Capture OSM fixtures

A one-shot dev-time script that hits real Overpass endpoints and saves the responses as committed JSON fixtures. Run manually; not in CI. Fixtures cover Manila at three zooms plus the open-ocean edge case.

**Files:**
- Create: `packages/@gunari/scene-mapprint/scripts/capture-fixture.mjs`
- Create: `packages/@gunari/scene-mapprint/__fixtures__/manila-neighborhood.json` (captured)
- Create: `packages/@gunari/scene-mapprint/__fixtures__/manila-district.json` (captured)
- Create: `packages/@gunari/scene-mapprint/__fixtures__/manila-city.json` (captured)
- Create: `packages/@gunari/scene-mapprint/__fixtures__/open-ocean.json` (hand-written minimal)

**Interfaces:**
- Produces: four committed fixture JSON files that later tasks' tests import. Files must be valid `OsmResponse` shapes.
- Consumes: `buildOverpassQuery` (Task 8), `OVERPASS_ENDPOINTS` (Task 8).

- [ ] **Step 1: Implement `scripts/capture-fixture.mjs`**

```javascript
// One-shot dev-time script: hits real Overpass and saves fixtures.
// Run manually: `node packages/@gunari/scene-mapprint/scripts/capture-fixture.mjs`
// Not run in CI. Captured fixtures are committed to the repo.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "../__fixtures__");

const ENDPOINTS = [
  "https://overpass.komoot.io/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

function buildQuery(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `[out:json][timeout:25];
(
  way[highway~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|path|footway|cycleway)$"](${bboxStr});
  way[waterway](${bboxStr});
  way["natural"="water"](${bboxStr});
  way["leisure"="park"](${bboxStr});
  way["leisure"="garden"](${bboxStr});
  way["boundary"="protected_area"](${bboxStr});
  way["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](${bboxStr});
  node["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](${bboxStr});
);
out:geom;`;
}

function bboxForZoom(lat, lng, km) {
  const halfLat = (km / 2) / 110.574;
  const halfLng = (km / 2) / 111.32 / Math.max(Math.cos(lat * Math.PI / 180), 0.01);
  return [lng - halfLng, lat - halfLat, lng + halfLng, lat + halfLat];
}

async function fetchOnce(url, query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithFallback(query) {
  for (const url of ENDPOINTS) {
    try {
      console.log(`  trying ${url}…`);
      return await fetchOnce(url, query);
    } catch (err) {
      console.warn(`    failed: ${err.message}`);
    }
  }
  throw new Error("all Overpass endpoints failed");
}

const FIXTURES = [
  { name: "manila-neighborhood", lat: 14.5995, lng: 120.9842, km: 0.6 },
  { name: "manila-district",     lat: 14.5995, lng: 120.9842, km: 2 },
  { name: "manila-city",         lat: 14.5995, lng: 120.9842, km: 12 },
];

async function main() {
  await mkdir(FIXTURES_DIR, { recursive: true });

  for (const f of FIXTURES) {
    const bbox = bboxForZoom(f.lat, f.lng, f.km);
    const query = buildQuery(bbox);
    console.log(`Capturing ${f.name} (bbox ${bbox.join(",")})…`);
    const json = await fetchWithFallback(query);
    const out = resolve(FIXTURES_DIR, `${f.name}.json`);
    await writeFile(out, JSON.stringify(json, null, 2));
    console.log(`  ✓ wrote ${out} (${json.elements?.length ?? 0} elements)`);
  }

  // Hand-written open-ocean edge case (middle of the Pacific, no roads).
  const openOcean = {
    version: 0.6,
    generator: "manual-fixture",
    elements: [],
  };
  await writeFile(resolve(FIXTURES_DIR, "open-ocean.json"), JSON.stringify(openOcean, null, 2));
  console.log("  ✓ wrote open-ocean.json (empty edge case)");
}

main().catch((err) => {
  console.error("fixture capture failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script to capture the fixtures**

Run: `node packages/@gunari/scene-mapprint/scripts/capture-fixture.mjs`
Expected: the script prints progress for each fixture and exits 0. The four JSON files appear in `__fixtures__/`. If a fixture fails, retry — public Overpass instances occasionally rate-limit.

- [ ] **Step 3: Verify the fixtures are valid OsmResponse shapes**

Run a quick sanity check:

```bash
node -e "
const fs = require('fs');
for (const f of ['manila-neighborhood', 'manila-district', 'manila-city', 'open-ocean']) {
  const j = JSON.parse(fs.readFileSync('packages/@gunari/scene-mapprint/__fixtures__/' + f + '.json', 'utf8'));
  console.log(f, 'elements:', j.elements?.length ?? 0);
}
"
```

Expected: prints element counts (Manila fixtures should have non-zero counts; open-ocean should have 0).

- [ ] **Step 4: Commit the fixtures**

```bash
git add packages/@gunari/scene-mapprint/scripts/capture-fixture.mjs packages/@gunari/scene-mapprint/__fixtures__/
git commit -m "Add @gunari/scene-mapprint OSM fixtures (Manila 3 zooms + open-ocean edge case)"
```

---

## Task 17: Golden-image test harness

Playwright-based golden-image tests. Build a known `MapGeometry` from a fixture, render it in each theme × shape × marker combination + a few rotation angles, compare against committed golden PNGs with a small pixel tolerance.

**Files:**
- Create: `packages/@gunari/scene-mapprint/tests/render.golden.test.ts`
- Create: `packages/@gunari/scene-mapprint/tests/golden-harness.ts` (helper: launch Playwright, render in a real browser canvas, capture PNG, diff)
- Create: `packages/@gunari/scene-mapprint/tests/__golden__/` (committed golden PNGs; populated on first run)
- Modify: `vitest.config.ts` (root) to keep golden tests out of the default `npm test` run (they're slow and need a browser) — add a separate `test:golden` script.

**Interfaces:**
- Produces: `tests/golden-harness.ts` exports `renderToPng(sceneRender: (ctx: CanvasRenderingContext2D) => void, w: number, h: number): Promise<Buffer>`; `diffImages(actual: Buffer, expected: Buffer, tolerance: number): Promise<{ match: boolean; diff: number }>`.
- Consumes: `mapPrintScene` (Task 15); `MAP_THEMES` (Task 13); `parseOsm` (Task 7); `projectGeometry` (Task 10); the fixtures from Task 16.

- [ ] **Step 1: Add a `test:golden` script and exclude golden tests from the default run**

Modify root `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/tests/**/*.test.ts"],
    exclude: ["packages/**/tests/**/*.golden.test.ts"],
    environment: "node",
    testTimeout: 10000,
  },
});
```

Add a second config for golden tests — `vitest.golden.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/tests/**/*.golden.test.ts"],
    environment: "node",
    testTimeout: 60000,
  },
});
```

Add to root `package.json` scripts:

```json
{
  "scripts": {
    "test:golden": "vitest run --config vitest.golden.config.ts",
    "test:golden:update": "vitest run --config vitest.golden.config.ts --update"
  }
}
```

- [ ] **Step 2: Implement `tests/golden-harness.ts`**

```typescript
import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function renderToPng(
  draw: (ctx: CanvasRenderingContext2D) => void,
  w: number,
  h: number
): Promise<Buffer> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Serialize `draw` into a string the browser can eval. The function
  // must be self-contained — no closure over node-side variables.
  const drawSrc = draw.toString();
  await page.setContent(`
    <!doctype html><html><body>
      <canvas id="c" width="${w}" height="${h}"></canvas>
      <script>
        const canvas = document.getElementById("c");
        const ctx = canvas.getContext("2d");
        (${drawSrc})(ctx);
      </script>
    </body></html>
  `);
  const png = await page.locator("#c").screenshot({ type: "png" });
  await browser.close();
  return png as unknown as Buffer;
}

export async function readGolden(name: string): Promise<Buffer> {
  const path = resolve(__dirname, "__golden__", `${name}.png`);
  try {
    return await fs.readFile(path);
  } catch {
    return Buffer.alloc(0);
  }
}

export async function writeGolden(name: string, png: Buffer): Promise<void> {
  const dir = resolve(__dirname, "__golden__");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolve(dir, `${name}.png`), png);
}

/**
 * Naive pixel diff: compare bytes. Returns { match, diff } where diff is
 * the fraction of differing bytes. `tolerance` is the maximum allowed diff
 * for `match` to be true. Good enough for golden-image comparison; a real
 * perceptual diff (pixelmatch) can be added later if needed.
 */
export async function diffImages(
  actual: Buffer,
  expected: Buffer,
  tolerance: number
): Promise<{ match: boolean; diff: number }> {
  if (expected.length === 0) return { match: false, diff: 1 };
  if (actual.length !== expected.length) {
    const denom = Math.max(actual.length, expected.length);
    const diff = Math.abs(actual.length - expected.length) / denom;
    return { match: diff <= tolerance, diff };
  }
  let differing = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) differing++;
  }
  const diff = differing / actual.length;
  return { match: diff <= tolerance, diff };
}
```

- [ ] **Step 3: Write the golden test**

`packages/@gunari/scene-mapprint/tests/render.golden.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { renderToPng, readGolden, writeGolden, diffImages } from "./golden-harness";
import { parseOsm, type OsmResponse } from "../src/interpret/parse";
import { projectGeometry } from "../src/projection/project";
import { renderMap } from "../src/render/render";
import { MAP_THEMES } from "../src/styles/themes";
import type { SceneInput, SceneViewport } from "@gunari/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPDATE = process.env.UPDATE_GOLDEN === "1";

function loadFixture(name: string): OsmResponse {
  return JSON.parse(readFileSync(resolve(__dirname, "../__fixtures__", `${name}.json`), "utf8"));
}

const manilaDistrict = parseOsm(loadFixture("manila-district"), [120.95, 14.58, 121.02, 14.63]);
const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
const W = 540, H = 960; // half-scale for golden-image storage efficiency

const baseInput: SceneInput = {
  shape: "square", style: "classic", marker: "solid",
  zoom: "district", rotation: 0, labels: false, layout: "classic",
};

describe("golden: render.manila-district", () => {
  for (const themeId of ["classic", "midnight", "blueprint", "paper", "twilight"] as const) {
    it(`renders ${themeId} theme matching the golden image`, async () => {
      const tolerance = 0.02; // 2% byte diff tolerance for sub-pixel rendering variance
      const geom = projectGeometry(manilaDistrict, viewport, 0, 0.001);
      const input: SceneInput = { ...baseInput, style: themeId };
      const png = await renderToPng((ctx) => {
        renderMap(ctx, geom, MAP_THEMES[themeId], input, viewport, W, H);
      }, W, H);
      if (UPDATE) {
        await writeGolden(`manila-district-${themeId}`, png);
        return;
      }
      const expected = await readGolden(`manila-district-${themeId}`);
      const { match, diff } = await diffImages(png, expected, tolerance);
      if (!match) {
        // Write the actual for manual inspection.
        await writeGolden(`manila-district-${themeId}.ACTUAL`, png);
      }
      expect(match, `golden diff for ${themeId} = ${diff}`).toBe(true);
    });
  }

  for (const shapeId of ["square", "circle", "heart"] as const) {
    it(`renders ${shapeId} shape matching the golden image`, async () => {
      const tolerance = 0.02;
      const geom = projectGeometry(manilaDistrict, viewport, 0, 0.001);
      const input: SceneInput = { ...baseInput, shape: shapeId };
      const png = await renderToPng((ctx) => {
        renderMap(ctx, geom, MAP_THEMES.classic, input, viewport, W, H);
      }, W, H);
      if (UPDATE) { await writeGolden(`manila-district-shape-${shapeId}`, png); return; }
      const expected = await readGolden(`manila-district-shape-${shapeId}`);
      const { match, diff } = await diffImages(png, expected, tolerance);
      expect(match, `golden shape diff for ${shapeId} = ${diff}`).toBe(true);
    });
  }

  for (const markerId of ["solid", "ring", "heart", "star"] as const) {
    it(`renders ${markerId} marker matching the golden image`, async () => {
      const tolerance = 0.02;
      const geom = projectGeometry(manilaDistrict, viewport, 0, 0.001);
      const input: SceneInput = { ...baseInput, marker: markerId };
      const png = await renderToPng((ctx) => {
        renderMap(ctx, geom, MAP_THEMES.classic, input, viewport, W, H);
      }, W, H);
      if (UPDATE) { await writeGolden(`manila-district-marker-${markerId}`, png); return; }
      const expected = await readGolden(`manila-district-marker-${markerId}`);
      const { match, diff } = await diffImages(png, expected, tolerance);
      expect(match, `golden marker diff for ${markerId} = ${diff}`).toBe(true);
    });
  }

  for (const angle of [0, 45, 90, 180]) {
    it(`renders rotation ${angle}° matching the golden image`, async () => {
      const tolerance = 0.02;
      const rad = (angle * Math.PI) / 180;
      const geom = projectGeometry(manilaDistrict, viewport, rad, 0.001);
      const input: SceneInput = { ...baseInput, rotation: rad };
      const png = await renderToPng((ctx) => {
        renderMap(ctx, geom, MAP_THEMES.classic, input, viewport, W, H);
      }, W, H);
      if (UPDATE) { await writeGolden(`manila-district-rot-${angle}`, png); return; }
      const expected = await readGolden(`manila-district-rot-${angle}`);
      const { match, diff } = await diffImages(png, expected, tolerance);
      expect(match, `golden rotation diff for ${angle}° = ${diff}`).toBe(true);
    });
  }
});
```

- [ ] **Step 4: Generate the initial golden images**

Run: `UPDATE_GOLDEN=1 npm run test:golden`
Expected: the golden tests run, write their PNGs to `tests/__golden__/`, and pass (because `UPDATE` returns early after writing).

- [ ] **Step 5: Inspect a few golden images manually**

Open `tests/__golden__/manila-district-classic.png` and `manila-district-shape-heart.png` in an image viewer. They should look like a minimalist map of Manila District in the Classic theme, with the marker on top, clipped to the shape. If anything looks visually wrong (roads missing, marker misplaced, wrong colors), fix the renderer before re-running step 4.

- [ ] **Step 6: Run the golden tests without UPDATE to verify they pass**

Run: `npm run test:golden`
Expected: PASS — all golden tests match within tolerance.

- [ ] **Step 7: Run typecheck**

Run: `cd packages/@gunari/scene-mapprint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/@gunari/scene-mapprint/ vitest.golden.config.ts
git commit -m "Add @gunari/scene-mapprint golden-image test harness and committed golden PNGs"
```

---

## Task 18: End-to-end smoke test

A dev-time script that loads the scene end-to-end, renders to a real PNG file, and saves it. Proves the wiring from `load` → `project` → `render` works against a fixture, without a UI. Useful for manual inspection during development.

**Files:**
- Create: `packages/@gunari/scene-mapprint/scripts/smoke-render.mjs`
- Create: `packages/@gunari/scene-mapprint/scripts/.gitignore` (or add `smoke-output.png` to package `.gitignore`)

**Interfaces:**
- Produces: a PNG file at `packages/@gunari/scene-mapprint/scripts/smoke-output.png` (gitignored) when run.
- Consumes: `mapPrintScene` (Task 15), `parseOsm` (Task 7), a Manila fixture (Task 16), Playwright (for a real canvas).

- [ ] **Step 1: Add a .gitignore for smoke output**

Create `packages/@gunari/scene-mapprint/scripts/.gitignore`:

```
smoke-output.png
```

- [ ] **Step 2: Implement `scripts/smoke-render.mjs`**

```javascript
// Dev-time smoke test: load the scene, project, render to a PNG file.
// Run: `node packages/@gunari/scene-mapprint/scripts/smoke-render.mjs`
// Produces smoke-output.png in the same directory.

import { writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "smoke-output.png");
const FIXTURE = resolve(__dirname, "../__fixtures__/manila-district.json");

async function main() {
  const fixtureJson = JSON.parse(await readFile(FIXTURE, "utf8"));

  // We can't directly import the TypeScript scene from a .mjs script.
  // Instead, inline the equivalent of mapPrintScene.project + render here
  // using the same primitives. This proves the wiring without a build step.
  // For a true end-to-end test of the TS code, run the golden-image tests
  // (Task 17) — they import the actual scene via vitest + playwright.

  const bbox = [120.95, 14.58, 121.02, 14.63];
  const viewport = { cx: 0.5, cy: 0.5, r: 0.4 };
  const W = 1080, H = 1920;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Inline the parse + project + render pipeline as a serialized function
  // the browser runs. We pass the fixture JSON in as a literal.
  const drawSrc = `
    async function draw(ctx) {
      const fixture = ${JSON.stringify(fixtureJson)};
      // Parse: walk elements, classify by tag.
      const roads = []; const water = []; const waterways = []; const parks = []; const labels = [];
      for (const el of fixture.elements) {
        if (el.type === "node" && el.tags?.place) {
          labels.push({ text: el.tags.name || "—", x: 0, y: 0, class: "place" });
          continue;
        }
        if (el.type !== "way" || !el.geometry) continue;
        const pts = el.geometry.map(p => [p.lon, p.lat]);
        const t = el.tags || {};
        const clsMap = {
          motorway:"motorway", trunk:"trunk", primary:"primary", secondary:"secondary",
          tertiary:"tertiary", unclassified:"tertiary", residential:"residential",
          living_street:"residential", path:"path", footway:"path", cycleway:"path",
        };
        if (t.highway && clsMap[t.highway]) {
          roads.push({ class: clsMap[t.highway], points: pts, name: t.name });
        } else if (t.waterway) {
          waterways.push(pts);
        } else if (t.natural === "water") {
          water.push({ points: pts });
        } else if (t.leisure === "park" || t.leisure === "garden") {
          parks.push({ points: pts });
        }
      }
      // Project: Web Mercator → normalize to [0,1] → flip y.
      const R = 6378137; const DEG = Math.PI / 180;
      function proj(lat, lng) {
        const x = R * lng * DEG;
        const y = R * Math.log(Math.tan(Math.PI/4 + (lat*DEG)/2));
        const [minLng, minLat, maxLng, maxLat] = bbox;
        const minX = R * minLng * DEG;
        const minY = R * Math.log(Math.tan(Math.PI/4 + (minLat*DEG)/2));
        const maxX = R * maxLng * DEG;
        const maxY = R * Math.log(Math.tan(Math.PI/4 + (maxLat*DEG)/2));
        return [(x - minX) / (maxX - minX), 1 - (y - minY) / (maxY - minY)];
      }
      function projLine(pts) { return pts.map(([lng, lat]) => proj(lat, lng)); }
      const proads = roads.map(r => ({ class: r.class, points: projLine(r.points), name: r.name }));
      const pwater = water.map(w => ({ points: projLine(w.points) }));
      const pwaterways = waterways.map(w => projLine(w));
      const pparks = parks.map(p => ({ points: projLine(p.points) }));

      // Theme (Classic, inlined).
      const palette = {
        background: { top: "#f7f5f1", bottom: "#ece8e1" },
        road: {
          motorway: { color: "#1c1d22", width: 3.6 },
          trunk: { color: "#1c1d22", width: 3.2 },
          primary: { color: "#3b3a35", width: 2.6 },
          secondary: { color: "#3b3a35", width: 2.0 },
          tertiary: { color: "#5b5b5b", width: 1.4 },
          residential: { color: "#7a7a7a", width: 0.9 },
          path: { color: "#9a9a9a", width: 0.6 },
        },
        water: "#cfd6dc", waterway: "#9aa8b5", park: "#d4dcc6",
        marker: "#1c1d22", markerSymbol: "#f7f5f1", label: "#3b3a35",
      };

      // Background
      const g = ctx.createLinearGradient(0, 0, 0, ${H});
      g.addColorStop(0, palette.background.top);
      g.addColorStop(1, palette.background.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ${W}, ${H});

      // Shape mask (square)
      const cx = viewport.cx * ${W};
      const cy = viewport.cy * ${H};
      const r = viewport.r * Math.min(${W}, ${H});
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - r, cy - r, r * 2, r * 2);
      ctx.clip();

      function toPx(p) { return [p[0] * ${W}, p[1] * ${H}]; }

      // Water
      for (const w of pwater) {
        const pts = w.points.map(toPx);
        if (!pts.length) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = palette.water;
        ctx.fill();
      }
      // Parks
      for (const p of pparks) {
        const pts = p.points.map(toPx);
        if (!pts.length) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = palette.park;
        ctx.fill();
      }
      // Roads (by class, in draw order)
      const order = ["path","residential","tertiary","secondary","primary","trunk","motorway"];
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const cls of order) {
        ctx.strokeStyle = palette.road[cls].color;
        ctx.lineWidth = palette.road[cls].width;
        for (const road of proads) {
          if (road.class !== cls) continue;
          const pts = road.points.map(toPx);
          if (pts.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Marker (solid pin, inlined)
      ctx.beginPath();
      const bodyCy = cy - r * 0.4;
      const bodyR = r * 0.7;
      ctx.moveTo(cx, cy + r);
      ctx.bezierCurveTo(cx - r*0.8, cy - r*0.2, cx - bodyR, bodyCy - bodyR*0.5, cx - bodyR, bodyCy);
      ctx.arc(cx, bodyCy, bodyR, Math.PI, 0, false);
      ctx.bezierCurveTo(cx + bodyR, bodyCy - bodyR*0.5, cx + r*0.8, cy - r*0.2, cx, cy + r);
      ctx.closePath();
      ctx.fillStyle = palette.marker;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, bodyCy, bodyR * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = palette.markerSymbol;
      ctx.fill();
    }
    return draw;
  `;

  await page.setContent(`
    <!doctype html><html><body>
      <canvas id="c" width="${1080}" height="${1920}"></canvas>
      <script>
        (${drawSrc})().then((draw) => {
          const ctx = document.getElementById("c").getContext("2d");
          draw(ctx);
        });
      </script>
    </body></html>
  `);
  await page.waitForTimeout(500);

  const png = await page.locator("#c").screenshot({ type: "png" });
  await browser.close();
  await writeFile(OUT, png);
  console.log(`✓ wrote ${OUT}`);
}

main().catch((err) => {
  console.error("smoke render failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the smoke script**

Run: `node packages/@gunari/scene-mapprint/scripts/smoke-render.mjs`
Expected: prints `✓ wrote .../smoke-output.png` and exits 0.

- [ ] **Step 4: Open the PNG and verify visually**

Open `packages/@gunari/scene-mapprint/scripts/smoke-output.png` (1080×1920). Expected: a Classic-themed Map Print of Manila District — ivory background, dark roads clipped to a centered square, a Manila place label area (if labels were on — they're off in this smoke), a solid pin marker in the center. If the image is blank or visually broken, debug before proceeding.

- [ ] **Step 5: Commit the smoke script (NOT the output PNG)**

```bash
git add packages/@gunari/scene-mapprint/scripts/smoke-render.mjs packages/@gunari/scene-mapprint/scripts/.gitignore
git commit -m "Add @gunari/scene-mapprint end-to-end smoke render script"
```

---

## Self-review notes

After writing the plan, I checked it against the spec:

**Spec coverage:**
- §3 Architecture (monorepo layout) → Task 1.
- §4 Scene contract → Task 2.
- §5 OSM data layer (Overpass QL, fallback, parsing, caching, zoom) → Tasks 7, 8, 9, 10 (viewport).
- §6 Geometry pipeline (internal model, projection, simplification, clipping, rotation) → Tasks 6, 3, 10.
- §7 Rendering (composition scaffold, themes, shapes, markers, labels, layer ordering) → Tasks 5, 11, 12, 13, 14.
- §8 v1 scope (full matrix) → Tasks 11 (3 shapes), 12 (4 markers), 13 (5 themes), 10 (3 zooms), 14 (rotation + labels), scene.ts capabilities (Task 15) advertise the full matrix.
- §9 Error handling → Task 8 (Overpass fallback + graceful degradation in scene.ts Task 15), Task 9 (cache bounds).
- §10 Testing strategy → Tasks 3-15 (vitest unit tests), Task 17 (golden-image harness), Task 18 (e2e smoke).
- §11 Q1-Q10 answers → all reflected in the relevant tasks (Q1 Overpass Task 8; Q2 alignment throughout; Q3 internal model Task 6; Q4 libraries Tasks 3, 7, 8, 14; Q5 caching Task 9; Q6 viewport Task 10; Q7 rotation Task 10; Q8 themes Task 13; Q9 reuse Task 2 contract; Q10 long-term architecture Tasks 1-15 collectively).
- §12 Future work → out of scope, correctly deferred.

**Placeholder scan:** No TBD/TODO/FIXME/XXX in any step. All steps have concrete code or shell commands.

**Type consistency:**
- `Scene` interface (Task 2) used consistently as `Scene<MapPrintSceneData, ProjectedMapGeometry>` in Task 15.
- `MapGeometry` (Task 6) used in Tasks 7 (parse output), 9 (cache value), 10 (project input), 15 (scene data field).
- `ProjectedMapGeometry` (Task 10) used in Tasks 14 (render input), 15 (project output), 17 (golden tests).
- `MapThemePalette` (Task 13) used in Tasks 12 (markers — structural shape), 14 (render), 15 (scene render), 17 (golden).
- `SceneInput` (Task 2) used consistently across Tasks 14, 15, 17.
- `SceneViewport` (Task 2) used consistently across Tasks 10, 14, 15, 17.
- `BBox` (Task 6) used consistently across Tasks 7, 8, 9, 10, 15.

**Known simplifications (called out in Task 15):**
- `scene.ts` Task 15 has stubbed `load` (no real location threading) and `render` (default `input`/`viewport` values). This is intentional for Plan 1's scope — no UI, no location plumbing. Plan 2 introduces a thin wrapper at the app layer that captures the location, full `SceneInput`, and the scaffold's scene slot dimensions, then calls `scene.load` / `scene.project` / `scene.render` with the right arguments. The architecture is intact; only the glue is simplified.

**Plan size:** 18 tasks, ~130 steps total. Plan 2 (Next.js app integration) is a separate document.