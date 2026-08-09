# Map Print — Plan 2: Next.js App Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `@gunari/scene-mapprint` (built in Plan 1) into a new `/map` route with full-matrix customizer, live preview, PNG export, and fix the `Scene` contract gap Plan 1 flagged.

**Architecture:** Extend the `Scene` contract in `@gunari/core` (`SceneInput.location`, `Scene.render` signature, `ScaffoldInput` fields). Make `mapPrintScene` real in `@gunari/scene-mapprint`. Build the `/map` route, hook, customizer, live preview, export in `gunari-app/src/`. Add a second CTA on the landing page. Star Chart (`/create`) untouched.

**Tech Stack:** Next.js 15, TypeScript 5.7 strict, Tailwind v4, shadcn/ui, motion.react, vitest 2.1, `@testing-library/react`, Playwright 1.62, node-canvas, npm workspaces (`@gunari/core` + `@gunari/scene-mapprint`).

## Global Constraints

- npm 10.9.8 — `workspace:*` unsupported; use `"*"` for intra-workspace deps
- TypeScript 5.7+ strict (`strict: true`, `noUnusedLocals`, `noUnusedParameters`)
- Per-workspace `tsconfig.json` extends `../../../tsconfig.base.json`
- Package tests: `npx vitest run packages/@gunari/<name>` (NOT `npm test -w` — root-resolution quirk)
- App tests: `npx vitest run src/` (new — needs jsdom environment per-test)
- Golden tests: `npm run test:golden` (unchanged from Plan 1)
- Typecheck: `npm run typecheck -w @gunari/<name>` for packages; `npx tsc --noEmit` for app
- Scene contract: `load` (async, cached) / `project` (pure, sync) / `render` (pure, sync)
- Overpass API: `out geom;` (NOT `out:geom;`), 3-endpoint fallback + 10s per-instance timeout (existing from Plan 1)
- In-memory LRU (20) + IndexedDB (50, FIFO) cache layers (existing from Plan 1)
- Commit messages: never add `Co-Authored-By` or any AI/attribution trailer (per project CLAUDE.md)
- No push to remote unless explicitly asked
- Star Chart (`/create`, `useGunariState`, `src/components/create/*`, `src/lib/render/png.ts`, `src/lib/render/starChart.ts`, `src/lib/astronomy/*`) untouched

## File Structure

### `@gunari/core` (3 modified, 2 tests modified)

- `packages/@gunari/core/src/scene/types.ts` — add `SceneLocation`; add `location: SceneLocation` to `SceneInput`
- `packages/@gunari/core/src/scene/scene.ts` — extend `Scene.render` signature to 7 args
- `packages/@gunari/core/src/artwork/scaffold.ts` — `SceneRenderFn` matches; `ScaffoldInput` gains `sceneInput` + `sceneViewport`; `renderScaffold` threads them; `drawMetadata` skips empty date/time
- `packages/@gunari/core/tests/scene.test.ts` — test extended `SceneInput`
- `packages/@gunari/core/tests/scaffold.test.ts` — test scaffold threading + empty meta

### `@gunari/scene-mapprint` (1 modified, 1 test modified)

- `packages/@gunari/scene-mapprint/src/scene.ts` — real `load` (location-aware), `project` (reads `data.zoom`), `render` (real input/viewport/dims); `MapPrintSceneData` gains `zoom`
- `packages/@gunari/scene-mapprint/tests/scene.test.ts` — update for new types

### `gunari-app/src/` (10 new, 2 modified)

- `vitest.config.ts` (modified) — include `src/**/*.test.{ts,tsx}`
- `src/test/setup.ts` (new) — `@testing-library/jest-dom` setup
- `src/test/smoke.test.tsx` (new) — verifies React testing infra
- `src/hooks/useMapPrintState.ts` (new) — state + OSM fetch lifecycle
- `src/hooks/useMapPrintState.test.ts` (new)
- `src/components/map/Customizer.tsx` (new) — 10 controls
- `src/components/map/Customizer.test.tsx` (new)
- `src/components/map/LivePreview.tsx` (new) — canvas at 540×960
- `src/components/map/LivePreview.test.tsx` (new)
- `src/lib/render/png-map.ts` (new) — `exportMapPng`
- `src/lib/render/png-map.test.ts` (new)
- `src/app/map/layout.tsx` (new) — metadata + layout shell
- `src/app/map/page.tsx` (new) — the route
- `src/app/map/page.test.tsx` (new) — smoke test
- `src/app/page.tsx` (modified) — second CTA "Map Print" → `/map`
- `e2e/map.spec.ts` (new) — Playwright e2e
- `playwright.config.ts` (new) — Playwright test runner config

---

## Task 1: Extend the Scene contract in `@gunari/core`

**Files:**
- Modify: `packages/@gunari/core/src/scene/types.ts`
- Modify: `packages/@gunari/core/src/scene/scene.ts`
- Modify: `packages/@gunari/core/src/artwork/scaffold.ts`
- Modify: `packages/@gunari/core/tests/scene.test.ts`
- Modify: `packages/@gunari/core/tests/scaffold.test.ts`

**Interfaces:**
- Consumes: existing `SceneInput` (7 fields), existing `Scene.render` (3 args), existing `ScaffoldInput` (no sceneInput/sceneViewport), existing `drawMetadata` (renders date+time+location unconditionally)
- Produces:
  - `SceneLocation` type: `{ lat: number; lng: number; label: string }`
  - `SceneInput.location: SceneLocation` (new field)
  - `Scene.render(ctx, geometry, palette, input: SceneInput, viewport: SceneViewport, w: number, h: number): void` (extended signature)
  - `SceneRenderFn` matches the new 7-arg signature
  - `ScaffoldInput.sceneInput: SceneInput` (new field)
  - `ScaffoldInput.sceneViewport: SceneViewport` (new field)
  - `renderScaffold` threads `sceneInput` + `sceneViewport` + `ARTWORK_W` + `ARTWORK_H` to `scene.render`
  - `drawMetadata` skips rendering when `meta.date` AND `meta.time` are both empty (only location shows)

- [ ] **Step 1: Add `SceneLocation` and `location` to `SceneInput`**

Replace the `SceneInput` interface in `packages/@gunari/core/src/scene/types.ts`:

```typescript
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
```

Keep `SceneCapabilities`, `SceneViewport`, and the type unions (`ShapeId`, `MapStyleId`, etc.) unchanged.

- [ ] **Step 2: Extend `Scene.render` signature in `scene.ts`**

In `packages/@gunari/core/src/scene/scene.ts`, replace the `render` line in the `Scene` interface:

```typescript
export interface Scene<D = SceneData, G = SceneGeometry> {
  readonly id: string;
  readonly capabilities: SceneCapabilities;
  load(input: SceneInput, signal: AbortSignal): Promise<D>;
  project(data: D, viewport: SceneViewport, rotation: number): G;
  render(
    ctx: CanvasRenderingContext2D,
    geometry: G,
    palette: unknown,
    input: SceneInput,
    viewport: SceneViewport,
    w: number,
    h: number,
  ): void;
}
```

Also update the import from `./types` to include `SceneLocation`:

```typescript
import type {
  SceneCapabilities,
  SceneInput,
  SceneLocation,
  SceneViewport,
} from "./types";

export type { SceneCapabilities, SceneInput, SceneLocation, SceneViewport } from "./types";
```

- [ ] **Step 3: Update `scaffold.ts` — `SceneRenderFn`, `ScaffoldInput`, `renderScaffold`**

In `packages/@gunari/core/src/artwork/scaffold.ts`:

Replace `SceneRenderFn`:

```typescript
import type { SceneInput, SceneViewport } from "../scene/types";
import type { LayoutId } from "../scene/types";
import type { ThemePalette } from "../theme/theme";

export const ARTWORK_W = 1080;
export const ARTWORK_H = 1920;

/** A scene's render function, called by the scaffold inside the scene slot. */
export interface SceneRenderFn {
  (
    ctx: CanvasRenderingContext2D,
    geometry: unknown,
    palette: unknown,
    input: SceneInput,
    viewport: SceneViewport,
    w: number,
    h: number,
  ): void;
}
```

Replace `ScaffoldInput`:

```typescript
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
  /** The user's scene input (shape, marker, theme, labels, layout, rotation, location, zoom). */
  sceneInput: SceneInput;
  /** The scene slot's viewport (cx/cy/r in canvas-normalized 0..1). */
  sceneViewport: SceneViewport;
}
```

Replace the `renderScaffold` body to thread the new args:

```typescript
export function renderScaffold(ctx: CanvasRenderingContext2D, input: ScaffoldInput): void {
  const W = ARTWORK_W;
  const H = ARTWORK_H;
  const p = input.palette;
  const inner = { x: MARGIN, y: MARGIN, w: W - MARGIN * 2, h: H - MARGIN * 2 };

  drawBackground(ctx, W, H, p);
  drawFrame(ctx, inner, p);

  input.scene.render(
    ctx,
    input.sceneGeometry,
    input.scenePalette,
    input.sceneInput,
    input.sceneViewport,
    W,
    H,
  );

  drawTitle(ctx, inner, p, input);
  if (input.message?.trim()) drawMessage(ctx, inner, p, input);
  drawMetadata(ctx, inner, p, input);
  drawWordmark(ctx, inner, p, input);
}
```

- [ ] **Step 4: Update `drawMetadata` to skip empty date/time**

In the same `scaffold.ts` file, replace `drawMetadata`:

```typescript
function drawMetadata(ctx: CanvasRenderingContext2D, inner: { x: number; y: number; w: number; h: number }, p: ThemePalette, input: ScaffoldInput): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.meta;
  const size = inner.w * 0.026;
  ctx.font = `400 ${Math.round(size)}px "Geist", sans-serif`;
  const cx = inner.x + inner.w / 2;
  const y = input.layout === "poster" ? inner.y + inner.h * 0.92 : inner.y + inner.h * 0.9;
  const hasDateTime = input.meta.date?.trim() && input.meta.time?.trim();
  const text = hasDateTime
    ? `${formatMetaDate(input.meta.date, input.meta.time)}  ·  ${input.meta.location.toUpperCase()}`
    : input.meta.location.toUpperCase();
  ctx.fillText(text, cx, y, inner.w * 0.9);
  ctx.restore();
}
```

- [ ] **Step 5: Update `tests/scene.test.ts`**

In `packages/@gunari/core/tests/scene.test.ts`, add a test for the extended `SceneInput`. If the file doesn't exist, create it. If it exists, append:

```typescript
import { describe, it, expect } from "vitest";
import type { SceneInput, SceneLocation } from "../src/scene/types";

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
```

If `packages/@gunari/core/tests/scene.test.ts` already has tests, append the above `describe` block at the end.

- [ ] **Step 6: Update `tests/scaffold.test.ts`**

In `packages/@gunari/core/tests/scaffold.test.ts`, replace the existing `ScaffoldInput` literals to include `sceneInput` and `sceneViewport`, and add a test verifying `scene.render` receives the 7 args.

Update the existing `input` literals in both tests to add:

```typescript
sceneInput: {
  location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
  shape: "square",
  style: "classic",
  marker: "solid",
  zoom: "district",
  rotation: 0,
  labels: false,
  layout: "classic",
},
sceneViewport: { cx: 0.5, cy: 0.5, r: 0.4 },
```

Add a new test verifying the scaffold threads args to `scene.render`:

```typescript
it("threads sceneInput, sceneViewport, ARTWORK_W, ARTWORK_H to scene.render", () => {
  const { ctx } = makeMockCtx();
  const fakeSceneRender = vi.fn();
  const sceneInput = {
    location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
    shape: "square", style: "classic", marker: "solid",
    zoom: "district", rotation: 0, labels: false, layout: "classic",
  };
  const sceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
  const input: ScaffoldInput = {
    layout: "classic",
    title: "Manila",
    message: "",
    meta: { date: "2026-08-07", time: "21:00", location: "Manila, PH" },
    palette,
    scene: { render: fakeSceneRender as never },
    sceneGeometry: {} as never,
    scenePalette: palette,
    sceneInput,
    sceneViewport,
  };
  renderScaffold(ctx, input);
  expect(fakeSceneRender).toHaveBeenCalledTimes(1);
  const args = fakeSceneRender.mock.calls[0];
  expect(args[0]).toBe(ctx);
  expect(args[3]).toBe(sceneInput);
  expect(args[4]).toBe(sceneViewport);
  expect(args[5]).toBe(ARTWORK_W);
  expect(args[6]).toBe(ARTWORK_H);
});

it("draws metadata with location only when date and time are empty", () => {
  const { ctx, calls } = makeMockCtx();
  const input: ScaffoldInput = {
    layout: "classic",
    title: "Manila",
    message: "",
    meta: { date: "", time: "", location: "Manila, PH" },
    palette,
    scene: { render: vi.fn() as never },
    sceneGeometry: {} as never,
    scenePalette: palette,
    sceneInput: {
      location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: 0, labels: false, layout: "classic",
    },
    sceneViewport: { cx: 0.5, cy: 0.5, r: 0.4 },
  };
  renderScaffold(ctx, input);
  // Should draw "MANILA, PH" (location only, uppercased)
  expect(calls.some((c) => c === "fillText:MANILA, PH")).toBe(true);
});
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run packages/@gunari/core`
Expected: PASS — all tests including the new ones.

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck -w @gunari/core`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/@gunari/core/src/scene/types.ts packages/@gunari/core/src/scene/scene.ts packages/@gunari/core/src/artwork/scaffold.ts packages/@gunari/core/tests/scene.test.ts packages/@gunari/core/tests/scaffold.test.ts
git commit -m "Extend Scene contract: SceneInput.location + Scene.render 7-arg signature + scaffold threading"
```

---

## Task 2: Make `mapPrintScene` real in `@gunari/scene-mapprint`

**Files:**
- Modify: `packages/@gunari/scene-mapprint/src/scene.ts`
- Modify: `packages/@gunari/scene-mapprint/tests/scene.test.ts`

**Interfaces:**
- Consumes: extended `Scene` contract from Task 1 (`SceneInput.location`, `Scene.render` 7 args)
- Produces:
  - `MapPrintSceneData` becomes `{ geometry: MapGeometry; bbox: BBox; zoom: ZoomId }`
  - `mapPrintScene.load(input, signal)` reads `input.location.lat/lng` + `input.zoom` → `bboxForZoom(lat, lng, zoom)` → fetch + parse + cache → returns `{ geometry, bbox, zoom: input.zoom }`
  - `mapPrintScene.project(data, viewport, rotation)` reads `data.zoom` → `SIMPLIFY_TOLERANCE[data.zoom]`
  - `mapPrintScene.render(ctx, geometry, palette, input, viewport, w, h)` calls `renderMap(ctx, geometry, palette as MapThemePalette, input, viewport, w, h)`

- [ ] **Step 1: Update `MapPrintSceneData` and `load`**

In `packages/@gunari/scene-mapprint/src/scene.ts`, replace the file with:

```typescript
import type { Scene, SceneCapabilities, SceneInput, SceneViewport } from "@gunari/core";
import type { BBox, MapGeometry } from "./interpret/types";
import type { ProjectedMapGeometry } from "./projection/types";
import { fetchOsm, OverpassError } from "./data/overpass";
import { parseOsm, type OsmResponse } from "./interpret/parse";
import { bboxForZoom } from "./projection/viewport";
import { projectGeometry } from "./projection/project";
import { renderMap } from "./render/render";
import { type MapThemePalette } from "./styles/themes";
import { MapDataCache } from "./data/cache";

export interface MapPrintSceneData {
  geometry: MapGeometry;
  bbox: BBox;
  zoom: SceneInput["zoom"];
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
    const { lat, lng } = input.location;
    const bbox = bboxForZoom(lat, lng, input.zoom);
    const cached = cache.get(bbox);
    if (cached) return { geometry: cached, bbox, zoom: input.zoom };

    let osm: OsmResponse;
    try {
      osm = await fetchOsm(bbox, signal);
    } catch (err) {
      if (err instanceof OverpassError && err.message === "aborted") throw err;
      const empty: MapGeometry = { bbox, roads: [], water: [], waterways: [], parks: [], labels: [] };
      cache.set(bbox, empty);
      return { geometry: empty, bbox, zoom: input.zoom };
    }
    const geometry = parseOsm(osm, bbox);
    cache.set(bbox, geometry);
    return { geometry, bbox, zoom: input.zoom };
  },

  project(data, viewport, rotation) {
    const tolerance = SIMPLIFY_TOLERANCE[data.zoom];
    return projectGeometry(data.geometry, viewport, rotation, tolerance);
  },

  render(ctx, geometry, palette, input, viewport, w, h) {
    renderMap(ctx, geometry, palette as MapThemePalette, input, viewport, w, h);
  },
};
```

- [ ] **Step 2: Update `tests/scene.test.ts`**

In `packages/@gunari/scene-mapprint/tests/scene.test.ts`, replace the file with:

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
      zoom: "district",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const out = mapPrintScene.project(data, viewport, 0);
    expect(out.roads.length).toBe(1);
    expect(out.roads[0].class).toBe("motorway");
  });

  it("project uses data.zoom to pick tolerance (neighborhood = 0.0005)", () => {
    const data: MapPrintSceneData = {
      geometry: {
        bbox: [120.98, 14.59, 120.99, 14.60],
        roads: [{ class: "residential", points: [[120.98, 14.59], [120.985, 14.595], [120.99, 14.60]], name: "" }],
        water: [], waterways: [], parks: [], labels: [],
      },
      bbox: [120.98, 14.59, 120.99, 14.60],
      zoom: "neighborhood",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const out = mapPrintScene.project(data, viewport, 0);
    // neighborhood tolerance is finer — the 3-point road should NOT be simplified to 2 points
    expect(out.roads[0].points.length).toBe(3);
  });

  it("project uses data.zoom to pick tolerance (city = 0.003, coarser)", () => {
    const data: MapPrintSceneData = {
      geometry: {
        bbox: [120.9, 14.55, 121.1, 14.65],
        roads: [{ class: "residential", points: [[120.98, 14.59], [120.985, 14.595], [120.99, 14.60]], name: "" }],
        water: [], waterways: [], parks: [], labels: [],
      },
      bbox: [120.9, 14.55, 121.1, 14.65],
      zoom: "city",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const out = mapPrintScene.project(data, viewport, 0);
    // city tolerance is coarser — the middle point may be simplified away
    // (the exact result depends on the simplification algorithm; just assert roads exist)
    expect(out.roads.length).toBe(1);
  });

  it("render calls renderMap with the full 7 args", () => {
    const ctx = {
      save: () => {}, restore: () => {}, fillRect: () => {}, fillStyle: "", strokeStyle: "",
      globalAlpha: 1, lineWidth: 1, lineCap: "" as CanvasLineCap, lineJoin: "" as CanvasLineJoin,
      createLinearGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
      fill: () => {}, stroke: () => {}, clip: () => {}, rect: () => {}, arc: () => {},
      bezierCurveTo: () => {}, textAlign: "" as CanvasTextAlign, textBaseline: "" as CanvasTextBaseline,
      font: "", fillText: () => {},
    } as unknown as CanvasRenderingContext2D;
    const data: MapPrintSceneData = {
      geometry: { bbox: [120.95, 14.58, 121.02, 14.63], roads: [], water: [], waterways: [], parks: [], labels: [] },
      bbox: [120.95, 14.58, 121.02, 14.63],
      zoom: "district",
    };
    const viewport: SceneViewport = { cx: 0.5, cy: 0.5, r: 0.4 };
    const geom = mapPrintScene.project(data, viewport, 0);
    const input: SceneInput = {
      location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: 0, labels: false, layout: "classic",
    };
    const palette = { id: "classic", label: "Classic", background: { top: "#f7f5f1", bottom: "#ece8e1" }, title: "#1c1d22", message: "#3b3a35", meta: "#3b3a35", accent: "#1c1d22", light: true, labelColor: "#3b3a35" } as never;
    // Should not throw
    expect(() => mapPrintScene.render(ctx, geom, palette, input, viewport, 540, 960)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `npx vitest run packages/@gunari/scene-mapprint/tests/scene.test.ts`
Expected: PASS.

- [ ] **Step 4: Run the full scene-mapprint suite to verify no regression**

Run: `npx vitest run packages/@gunari/scene-mapprint`
Expected: all tests pass (including the golden tests if run separately; golden tests are excluded from the default run).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck -w @gunari/scene-mapprint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/@gunari/scene-mapprint/src/scene.ts packages/@gunari/scene-mapprint/tests/scene.test.ts
git commit -m "Make mapPrintScene real: location-aware load, zoom-derived tolerance, full-input render"
```

---

## Task 3: Set up React testing infrastructure

**Files:**
- Modify: `package.json` (add devDeps: `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`)
- Modify: `vitest.config.ts` (include `src/**/*.test.{ts,tsx}`)
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: React testing infra — jsdom env available via `// @vitest-environment jsdom` per-test, `@testing-library/react` available, `@testing-library/jest-dom` matchers loaded globally, vitest picks up `src/**/*.test.{ts,tsx}`

- [ ] **Step 1: Install devDeps**

Run: `npm install -D jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
Expected: packages added to `package.json` devDependencies + `package-lock.json` updated.

- [ ] **Step 2: Update `vitest.config.ts`**

Replace `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/tests/**/*.test.ts",
      "src/**/*.test.{ts,tsx}",
    ],
    exclude: ["packages/**/tests/**/*.golden.test.ts"],
    environment: "node",
    testTimeout: 10000,
    setupFiles: ["src/test/setup.ts"],
  },
});
```

Note: the default environment stays `"node"` (the package tests rely on it). React component tests use the `// @vitest-environment jsdom` per-file override.

- [ ] **Step 3: Create `src/test/setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Write a smoke test**

Create `src/test/smoke.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

function Hello({ name }: { name: string }) {
  return <div>Hello, {name}</div>;
}

describe("React testing infra smoke test", () => {
  it("renders a React component", () => {
    render(<Hello name="Gunari" />);
    expect(screen.getByText("Hello, Gunari")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the smoke test**

Run: `npx vitest run src/test/smoke.test.tsx`
Expected: PASS — the React component renders, the jest-dom matcher `toBeInTheDocument()` works.

- [ ] **Step 6: Run the full test suite to verify no regression**

Run: `npx vitest run`
Expected: all existing package tests still pass (94 from Plan 1), plus the new smoke test.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test/setup.ts src/test/smoke.test.tsx
git commit -m "Set up React testing infra: jsdom + @testing-library/react + vitest setup"
```

---

## Task 4: `useMapPrintState` hook

**Files:**
- Create: `src/hooks/useMapPrintState.ts`
- Create: `src/hooks/useMapPrintState.test.ts`

**Interfaces:**
- Consumes:
  - `mapPrintScene` from `@gunari/scene-mapprint` (Task 2)
  - `SceneInput`, `SceneViewport`, `SceneLocation` from `@gunari/core` (Task 1)
  - `pickRandomPair` from `@/lib/content/pairs` (existing)
  - `MapPrintSceneData`, `ProjectedMapGeometry` types from `@gunari/scene-mapprint`
- Produces:
  - `MapPrintInput` type = `SceneInput & { title: string; message?: string }` (location + 7 scene fields + title/message)
  - `useMapPrintState()` hook returning `{ input, update, updateLocation, randomize, data, geometry, loading, error }`
  - `MAP_PREVIEW_VIEWPORT(layout)` helper: returns `{ cx: 0.5, cy: 0.5, r: layout === "poster" ? 0.42 : 0.4 }`
  - Default input: Manila location, `pickRandomPair()` for title/message, classic/square/solid/district/0/false/classic

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useMapPrintState.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMapPrintState } from "./useMapPrintState";
import { mapPrintScene } from "@gunari/scene-mapprint";

vi.mock("@gunari/scene-mapprint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gunari/scene-mapprint")>();
  return {
    ...actual,
    mapPrintScene: {
      ...actual.mapPrintScene,
      load: vi.fn(actual.mapPrintScene.load),
    },
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useMapPrintState", () => {
  it("initializes with Manila defaults", () => {
    const { result } = renderHook(() => useMapPrintState());
    expect(result.current.input.location.lat).toBe(14.5995);
    expect(result.current.input.location.lng).toBe(120.9842);
    expect(result.current.input.location.label).toContain("Manila");
    expect(result.current.input.shape).toBe("square");
    expect(result.current.input.style).toBe("classic");
    expect(result.current.input.zoom).toBe("district");
    expect(result.current.input.rotation).toBe(0);
    expect(result.current.input.labels).toBe(false);
    expect(result.current.input.layout).toBe("classic");
  });

  it("update changes a field", () => {
    const { result } = renderHook(() => useMapPrintState());
    act(() => result.current.update("shape", "circle"));
    expect(result.current.input.shape).toBe("circle");
  });

  it("updateLocation changes location fields", () => {
    const { result } = renderHook(() => useMapPrintState());
    act(() => result.current.updateLocation({ lat: 1, lng: 2, label: "Test" }));
    expect(result.current.input.location).toEqual({ lat: 1, lng: 2, label: "Test" });
  });

  it("rotation update does NOT trigger load (data unchanged)", async () => {
    const { result } = renderHook(() => useMapPrintState());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const loadCallsBefore = (mapPrintScene.load as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => result.current.update("rotation", Math.PI / 4));
    // No new load call for rotation
    expect((mapPrintScene.load as ReturnType<typeof vi.fn>).mock.calls.length).toBe(loadCallsBefore);
  });

  it("randomize changes 7 cosmetic fields, leaves location/title/message", () => {
    const { result } = renderHook(() => useMapPrintState());
    const beforeLoc = { ...result.current.input.location };
    const beforeTitle = result.current.input.title;
    const beforeMessage = result.current.input.message;
    act(() => result.current.randomize());
    expect(result.current.input.location).toEqual(beforeLoc);
    expect(result.current.input.title).toBe(beforeTitle);
    expect(result.current.input.message).toBe(beforeMessage);
    // At least one of theme/shape/marker/zoom/rotation/labels/layout changed
    const changed =
      result.current.input.style !== "classic" ||
      result.current.input.shape !== "square" ||
      result.current.input.marker !== "solid" ||
      result.current.input.zoom !== "district" ||
      result.current.input.rotation !== 0 ||
      result.current.input.labels !== false ||
      result.current.input.layout !== "classic";
    expect(changed).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useMapPrintState.test.ts`
Expected: FAIL — `useMapPrintState` not found.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useMapPrintState.ts`:

```typescript
"use client";

import * as React from "react";
import type { SceneInput, SceneViewport } from "@gunari/core";
import { mapPrintScene, type MapPrintSceneData, type ProjectedMapGeometry } from "@gunari/scene-mapprint";
import { pickRandomPair } from "@/lib/content/pairs";

export type MapPrintInput = SceneInput & {
  title: string;
  message?: string;
};

export function MAP_PREVIEW_VIEWPORT(layout: SceneInput["layout"]): SceneViewport {
  return { cx: 0.5, cy: 0.5, r: layout === "poster" ? 0.42 : 0.4 };
}

const RANDOM_PAIR = pickRandomPair();

const DEFAULT_INPUT: MapPrintInput = {
  location: {
    lat: 14.5995,
    lng: 120.9842,
    label: "Manila, Metro Manila, Philippines",
  },
  title: RANDOM_PAIR.title,
  message: RANDOM_PAIR.message,
  shape: "square",
  style: "classic",
  marker: "solid",
  zoom: "district",
  rotation: 0,
  labels: false,
  layout: "classic",
};

const DEBOUNCE_MS = 250;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useMapPrintState(initial?: Partial<MapPrintInput>) {
  const [input, setInput] = React.useState<MapPrintInput>({ ...DEFAULT_INPUT, ...initial });
  const [data, setData] = React.useState<MapPrintSceneData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<number | null>(null);
  const inputRef = React.useRef(input);
  inputRef.current = input;

  // Load on mount + whenever location or zoom changes (debounced).
  React.useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      mapPrintScene
        .load(inputRef.current, controller.signal)
        .then((d) => {
          if (!controller.signal.aborted) {
            setData(d);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.location.lat, input.location.lng, input.zoom]);

  // Geometry derived from data + rotation + layout (recomputed on each render).
  const geometry: ProjectedMapGeometry | null = React.useMemo(() => {
    if (!data) return null;
    const viewport = MAP_PREVIEW_VIEWPORT(input.layout);
    return mapPrintScene.project(data, viewport, input.rotation);
  }, [data, input.rotation, input.layout]);

  const update = React.useCallback(
    <K extends keyof MapPrintInput>(key: K, value: MapPrintInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateLocation = React.useCallback(
    (location: Partial<MapPrintInput["location"]>) => {
      setInput((prev) => ({ ...prev, location: { ...prev.location, ...location } }));
    },
    [],
  );

  const randomize = React.useCallback(() => {
    setInput((prev) => {
      const themes: SceneInput["style"][] = ["classic", "midnight", "blueprint", "paper", "twilight"];
      const shapes: SceneInput["shape"][] = ["square", "circle", "heart"];
      const markers: SceneInput["marker"][] = ["solid", "ring", "heart", "star"];
      const zooms: SceneInput["zoom"][] = ["neighborhood", "district", "city"];
      const layouts: SceneInput["layout"][] = ["classic", "poster"];
      return {
        ...prev,
        style: pick(themes.filter((t) => t !== prev.style)),
        shape: pick(shapes.filter((s) => s !== prev.shape)),
        marker: pick(markers.filter((m) => m !== prev.marker)),
        zoom: pick(zooms.filter((z) => z !== prev.zoom)),
        rotation: Math.random() * Math.PI * 2,
        labels: !prev.labels,
        layout: pick(layouts.filter((l) => l !== prev.layout)),
      };
    });
  }, []);

  return {
    input,
    update,
    updateLocation,
    randomize,
    data,
    geometry,
    loading,
    error,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useMapPrintState.test.ts`
Expected: PASS.

Note: the "rotation does NOT trigger load" test depends on the mock — the mock's `load` is the real `load` but wrapped in `vi.fn` to count calls. The effect's dependency array excludes rotation, so rotation changes won't re-trigger `load`.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMapPrintState.ts src/hooks/useMapPrintState.test.ts
git commit -m "Add useMapPrintState hook with debounced OSM load + abort + randomize"
```

---

## Task 5: Map Print `Customizer` component

**Files:**
- Create: `src/components/map/Customizer.tsx`
- Create: `src/components/map/Customizer.test.tsx`

**Interfaces:**
- Consumes:
  - `MapPrintInput`, `MAP_PREVIEW_VIEWPORT` from `@/hooks/useMapPrintState` (Task 4)
  - `SceneInput` field types from `@gunari/core` (Task 1)
  - `searchPlaces` from `@/lib/location/photon` (existing) — for location autocomplete
  - shadcn/ui `Button` from `@/components/ui/Button` (existing)
- Produces:
  - `Customizer` component: `{ input: MapPrintInput; update; updateLocation }` → renders 10 controls
  - Calls `update("theme", x)`, `update("shape", x)`, `update("marker", x)`, `update("zoom", x)`, `update("rotation", x)`, `update("labels", x)`, `update("layout", x)`, `update("title", x)`, `update("message", x)`, `updateLocation({ lat, lng, label })`

- [ ] **Step 1: Write the failing test**

Create `src/components/map/Customizer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Customizer } from "./Customizer";
import type { MapPrintInput } from "@/hooks/useMapPrintState";

const baseInput: MapPrintInput = {
  location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
  title: "Test",
  message: "Msg",
  shape: "square",
  style: "classic",
  marker: "solid",
  zoom: "district",
  rotation: 0,
  labels: false,
  layout: "classic",
};

describe("Customizer", () => {
  it("renders all 10 controls", () => {
    const update = vi.fn();
    const updateLocation = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={updateLocation} />);
    // Location (label-based), Title, Message, Theme, Shape, Marker, Zoom, Rotation, Labels, Layout
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /theme/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /shape/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /marker/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /zoom/i })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /rotation/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /labels/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /layout/i })).toBeInTheDocument();
  });

  it("calls update when shape changes", () => {
    const update = vi.fn();
    const updateLocation = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={updateLocation} />);
    fireEvent.click(screen.getByRole("radio", { name: /circle/i }));
    expect(update).toHaveBeenCalledWith("shape", "circle");
  });

  it("calls update when title changes", () => {
    const update = vi.fn();
    const updateLocation = vi.fn();
    render(<Customizer input={baseInput} update={update} updateLocation={updateLocation} />);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "New Title" } });
    expect(update).toHaveBeenCalledWith("title", "New Title");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/map/Customizer.test.tsx`
Expected: FAIL — `Customizer` not found.

- [ ] **Step 3: Implement the Customizer**

Create `src/components/map/Customizer.tsx`:

```tsx
"use client";

import * as React from "react";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import type { SceneInput } from "@gunari/core";
import { searchPlaces, type PlaceResult } from "@/lib/location/photon";

const THEMES: { id: SceneInput["style"]; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "midnight", label: "Midnight" },
  { id: "blueprint", label: "Blueprint" },
  { id: "paper", label: "Paper" },
  { id: "twilight", label: "Twilight" },
];
const SHAPES: { id: SceneInput["shape"]; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "heart", label: "Heart" },
];
const MARKERS: { id: SceneInput["marker"]; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "ring", label: "Ring" },
  { id: "heart", label: "Heart" },
  { id: "star", label: "Star" },
];
const ZOOMS: { id: SceneInput["zoom"]; label: string }[] = [
  { id: "neighborhood", label: "Neighborhood" },
  { id: "district", label: "District" },
  { id: "city", label: "City" },
];
const LAYOUTS: { id: SceneInput["layout"]; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "poster", label: "Poster" },
];

export interface CustomizerProps {
  input: MapPrintInput;
  update: <K extends keyof MapPrintInput>(key: K, value: MapPrintInput[K]) => void;
  updateLocation: (location: Partial<MapPrintInput["location"]>) => void;
}

export function Customizer({ input, update, updateLocation }: CustomizerProps) {
  return (
    <div className="space-y-6">
      <LocationField value={input.location} onChange={updateLocation} />
      <TextField
        label="Title"
        value={input.title}
        onChange={(v) => update("title", v)}
      />
      <TextField
        label="Message"
        value={input.message ?? ""}
        onChange={(v) => update("message", v)}
        optional
      />
      <RadioGroup
        label="Theme"
        options={THEMES}
        value={input.style}
        onChange={(v) => update("style", v)}
      />
      <RadioGroup
        label="Shape"
        options={SHAPES}
        value={input.shape}
        onChange={(v) => update("shape", v)}
      />
      <RadioGroup
        label="Marker"
        options={MARKERS}
        value={input.marker}
        onChange={(v) => update("marker", v)}
      />
      <RadioGroup
        label="Zoom"
        options={ZOOMS}
        value={input.zoom}
        onChange={(v) => update("zoom", v)}
      />
      <RotationField value={input.rotation} onChange={(v) => update("rotation", v)} />
      <LabelsToggle value={input.labels} onChange={(v) => update("labels", v)} />
      <RadioGroup
        label="Layout"
        options={LAYOUTS}
        value={input.layout}
        onChange={(v) => update("layout", v)}
      />
    </div>
  );
}

function LocationField({
  value,
  onChange,
}: {
  value: MapPrintInput["location"];
  onChange: (location: Partial<MapPrintInput["location"]>) => void;
}) {
  const [query, setQuery] = React.useState(value.label);
  const [results, setResults] = React.useState<PlaceResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    setQuery(value.label);
  }, [value.label]);

  const onType = (text: string) => {
    setQuery(text);
    if (text.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    searchPlaces(text, controller.signal)
      .then((r) => {
        setResults(r);
        setOpen(r.length > 0);
      })
      .catch(() => {});
  };

  const onPick = (r: PlaceResult) => {
    onChange({ lat: r.lat, lng: r.lng, label: r.label });
    setQuery(r.label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-[11px] uppercase tracking-[0.25em] text-stone">
        Location
      </label>
      <input
        aria-label="Location"
        type="text"
        value={query}
        onChange={(e) => onType(e.target.value)}
        className="w-full rounded-md border border-mist/20 bg-ink px-3 py-2 text-sm text-mist focus:border-gold focus:outline-none"
        placeholder="Search a place..."
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-mist/20 bg-ink shadow-lg">
          {results.slice(0, 6).map((r, i) => (
            <li key={`${r.label}-${i}`}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="block w-full px-3 py-2 text-left text-sm text-mist hover:bg-mist/5"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-[0.25em] text-stone">
        {label}{optional && " (optional)"}
      </label>
      <input
        aria-label={label}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-mist/20 bg-ink px-3 py-2 text-sm text-mist focus:border-gold focus:outline-none"
      />
    </div>
  );
}

function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] uppercase tracking-[0.25em] text-stone">{label}</legend>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={
              "cursor-pointer rounded-md border px-3 py-1.5 text-xs " +
              (value === opt.id
                ? "border-gold bg-gold/10 text-gold"
                : "border-mist/20 text-stone hover:border-mist/40")
            }
          >
            <input
              type="radio"
              name={label}
              value={opt.id}
              checked={value === opt.id}
              onChange={() => onChange(opt.id)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RotationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const deg = Math.round((value * 180) / Math.PI) % 360;
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-[0.25em] text-stone">
        Rotation ({deg}°)
      </label>
      <input
        aria-label="Rotation"
        role="slider"
        type="range"
        min={0}
        max={359}
        value={deg}
        onChange={(e) => onChange((parseInt(e.target.value, 10) * Math.PI) / 180)}
        className="w-full"
      />
    </div>
  );
}

function LabelsToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-[0.25em] text-stone">Labels</span>
      <button
        type="button"
        role="switch"
        aria-label="Labels"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={
          "relative h-6 w-11 rounded-full transition-colors " +
          (value ? "bg-gold" : "bg-mist/20")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-transform " +
            (value ? "translate-x-5" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/map/Customizer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/map/Customizer.tsx src/components/map/Customizer.test.tsx
git commit -m "Add Map Print Customizer with 10 controls (location, title, message, theme, shape, marker, zoom, rotation, labels, layout)"
```

---

## Task 6: Map Print `LivePreview` component

**Files:**
- Create: `src/components/map/LivePreview.tsx`
- Create: `src/components/map/LivePreview.test.tsx`

**Interfaces:**
- Consumes:
  - `renderScaffold` from `@gunari/core` (Task 1)
  - `mapPrintScene` from `@gunari/scene-mapprint` (Task 2)
  - `MapPrintInput`, `MAP_PREVIEW_VIEWPORT` from `@/hooks/useMapPrintState` (Task 4)
  - `MapPrintSceneData`, `ProjectedMapGeometry` types from `@gunari/scene-mapprint`
  - `getMapTheme` from `@gunari/scene-mapprint` (existing — re-exported in Task 2's package)
- Produces:
  - `LivePreview` component: `{ input, data, geometry, loading }` → renders a 540×960 canvas with the scaffold + scene

- [ ] **Step 1: Write the failing test**

Create `src/components/map/LivePreview.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { LivePreview } from "./LivePreview";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import type { MapPrintSceneData } from "@gunari/scene-mapprint";

vi.mock("@gunari/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gunari/core")>();
  return {
    ...actual,
    renderScaffold: vi.fn(actual.renderScaffold),
  };
});

const input: MapPrintInput = {
  location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
  title: "Test",
  message: undefined,
  shape: "square", style: "classic", marker: "solid",
  zoom: "district", rotation: 0, labels: false, layout: "classic",
};

const data: MapPrintSceneData = {
  geometry: { bbox: [120.95, 14.58, 121.02, 14.63], roads: [], water: [], waterways: [], parks: [], labels: [] },
  bbox: [120.95, 14.58, 121.02, 14.63],
  zoom: "district",
};

describe("LivePreview", () => {
  it("renders a canvas", () => {
    const { container } = render(
      <LivePreview input={input} data={data} geometry={null} loading={false} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("calls renderScaffold with the right sceneInput + sceneViewport", async () => {
    const { renderScaffold } = await import("@gunari/core");
    render(
      <LivePreview input={input} data={data} geometry={null} loading={false} />,
    );
    expect(renderScaffold).toHaveBeenCalled();
    const call = (renderScaffold as ReturnType<typeof vi.fn>).mock.calls[0];
    const scaffoldInput = call[1];
    expect(scaffoldInput.sceneInput).toEqual(input);
    expect(scaffoldInput.sceneViewport).toEqual({ cx: 0.5, cy: 0.5, r: 0.4 });
    expect(scaffoldInput.title).toBe("Test");
    expect(scaffoldInput.meta.location).toBe("Manila");
    expect(scaffoldInput.meta.date).toBe("");
    expect(scaffoldInput.meta.time).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/map/LivePreview.test.tsx`
Expected: FAIL — `LivePreview` not found.

- [ ] **Step 3: Implement the LivePreview**

Create `src/components/map/LivePreview.tsx`:

```tsx
"use client";

import * as React from "react";
import { renderScaffold, ARTWORK_W, ARTWORK_H } from "@gunari/core";
import { mapPrintScene, getMapTheme, type MapPrintSceneData, type ProjectedMapGeometry } from "@gunari/scene-mapprint";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import { MAP_PREVIEW_VIEWPORT } from "@/hooks/useMapPrintState";

const PREVIEW_W = 540;
const PREVIEW_H = 960;
const SCALE = PREVIEW_W / ARTWORK_W; // 0.5

export interface LivePreviewProps {
  input: MapPrintInput;
  data: MapPrintSceneData | null;
  geometry: ProjectedMapGeometry | null;
  loading: boolean;
}

export function LivePreview({ input, data, geometry, loading }: LivePreviewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.scale(SCALE, SCALE);
    if (!geometry || !data) {
      // Empty state: just background
      ctx.fillStyle = "#1a1b1f";
      ctx.fillRect(0, 0, ARTWORK_W, ARTWORK_H);
      return;
    }
    const palette = getMapTheme(input.style);
    renderScaffold(ctx, {
      layout: input.layout,
      title: input.title,
      message: input.message,
      meta: { date: "", time: "", location: input.location.label },
      palette,
      scene: { render: mapPrintScene.render },
      sceneGeometry: geometry,
      scenePalette: palette,
      sceneInput: input,
      sceneViewport: MAP_PREVIEW_VIEWPORT(input.layout),
    });
  }, [input, data, geometry]);

  return (
    <div className="relative mx-auto max-w-[540px]">
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-mist/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-ink/40 backdrop-blur-sm">
          <span className="text-[11px] uppercase tracking-[0.25em] text-mist">Loading map…</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/map/LivePreview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/map/LivePreview.tsx src/components/map/LivePreview.test.tsx
git commit -m "Add Map Print LivePreview component rendering scaffold + scene at 540x960"
```

---

## Task 7: Map Print PNG export (`exportMapPng`)

**Files:**
- Create: `src/lib/render/png-map.ts`
- Create: `src/lib/render/png-map.test.ts`

**Interfaces:**
- Consumes:
  - `renderScaffold`, `ARTWORK_W`, `ARTWORK_H` from `@gunari/core` (Task 1)
  - `mapPrintScene`, `getMapTheme`, `MapPrintSceneData`, `ProjectedMapGeometry` from `@gunari/scene-mapprint` (Task 2)
  - `MapPrintInput`, `MAP_PREVIEW_VIEWPORT` from `@/hooks/useMapPrintState` (Task 4)
  - `downloadBlob`, `shareBlob` from `@/lib/render/png` (existing)
- Produces:
  - `exportMapPng({ input, geometry }): Promise<Blob>` — renders 1080×1920 PNG
  - `downloadMapPng(input, geometry, filename)` — exports + downloads
  - `shareMapPng(input, geometry, filename, title, text)` — exports + shares

- [ ] **Step 1: Write the failing test**

Create `src/lib/render/png-map.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { exportMapPng } from "./png-map";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import type { ProjectedMapGeometry } from "@gunari/scene-mapprint";

vi.mock("@gunari/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gunari/core")>();
  return { ...actual, renderScaffold: vi.fn(actual.renderScaffold) };
});

const input: MapPrintInput = {
  location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
  title: "Test",
  message: undefined,
  shape: "square", style: "classic", marker: "solid",
  zoom: "district", rotation: 0, labels: false, layout: "classic",
};

const geometry = { roads: [], water: [], waterways: [], parks: [], labels: [], rotation: 0 } as unknown as ProjectedMapGeometry;

describe("exportMapPng", () => {
  it("returns a PNG blob", async () => {
    const blob = await exportMapPng({ input, geometry });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/render/png-map.test.ts`
Expected: FAIL — `exportMapPng` not found.

- [ ] **Step 3: Implement `png-map.ts`**

Create `src/lib/render/png-map.ts`:

```typescript
"use client";

import { renderScaffold, ARTWORK_W, ARTWORK_H } from "@gunari/core";
import { mapPrintScene, getMapTheme, type ProjectedMapGeometry } from "@gunari/scene-mapprint";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import { MAP_PREVIEW_VIEWPORT } from "@/hooks/useMapPrintState";
import { downloadBlob, shareBlob } from "./png";

export interface ExportMapPngInput {
  input: MapPrintInput;
  geometry: ProjectedMapGeometry;
}

export async function exportMapPng({ input, geometry }: ExportMapPngInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = ARTWORK_W;
  canvas.height = ARTWORK_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const palette = getMapTheme(input.style);
  renderScaffold(ctx, {
    layout: input.layout,
    title: input.title,
    message: input.message,
    meta: { date: "", time: "", location: input.location.label },
    palette,
    scene: { render: mapPrintScene.render },
    sceneGeometry: geometry,
    scenePalette: palette,
    sceneInput: input,
    sceneViewport: MAP_PREVIEW_VIEWPORT(input.layout),
  });
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

export async function downloadMapPng(
  input: MapPrintInput,
  geometry: ProjectedMapGeometry,
  filename: string,
): Promise<void> {
  const blob = await exportMapPng({ input, geometry });
  downloadBlob(blob, filename);
}

export async function shareMapPng(
  input: MapPrintInput,
  geometry: ProjectedMapGeometry,
  filename: string,
  title?: string,
  text?: string,
): Promise<boolean> {
  const blob = await exportMapPng({ input, geometry });
  return shareBlob(blob, filename, title, text);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/render/png-map.test.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/render/png-map.ts src/lib/render/png-map.test.ts
git commit -m "Add Map Print PNG export (exportMapPng, downloadMapPng, shareMapPng)"
```

---

## Task 8: `/map` route (layout + page)

**Files:**
- Create: `src/app/map/layout.tsx`
- Create: `src/app/map/page.tsx`
- Create: `src/app/map/page.test.tsx`

**Interfaces:**
- Consumes:
  - `useMapPrintState` from `@/hooks/useMapPrintState` (Task 4)
  - `Customizer` from `@/components/map/Customizer` (Task 5)
  - `LivePreview` from `@/components/map/LivePreview` (Task 6)
  - `downloadMapPng`, `shareMapPng` from `@/lib/render/png-map` (Task 7)
  - shadcn/ui `Button` from `@/components/ui/Button` (existing)
  - `SITE_URL` from `@/lib/site` (existing)
  - `motion`, `AnimatePresence` from `motion/react` (existing)
  - `confetti` from `canvas-confetti` (existing)
  - `ArrowLeft`, `Download`, `Share2`, `Shuffle` from `lucide-react` (existing)
- Produces:
  - `/map` route rendering the full Map Print create flow

- [ ] **Step 1: Create the layout**

Create `src/app/map/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Map Print — Gunari",
  description:
    "Turn a meaningful place into a beautiful Map Print. Pick a location, customize the style, and download a shareable artwork.",
  alternates: { canonical: "/map" },
  openGraph: {
    title: "Map Print — Gunari",
    description:
      "Turn a meaningful place into a beautiful Map Print. Pick a location, customize the style, and download a shareable artwork.",
    url: `${SITE_URL}/map`,
    type: "website",
  },
};

export default function MapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 2: Write the failing page test**

Create `src/app/map/page.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useMapPrintState", () => ({
  useMapPrintState: () => ({
    input: {
      location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
      title: "T", message: undefined,
      shape: "square", style: "classic", marker: "solid",
      zoom: "district", rotation: 0, labels: false, layout: "classic",
    },
    update: vi.fn(),
    updateLocation: vi.fn(),
    randomize: vi.fn(),
    data: null,
    geometry: null,
    loading: false,
    error: null,
  }),
  }));
vi.mock("@/lib/render/png-map", () => ({
  downloadMapPng: vi.fn(),
  shareMapPng: vi.fn(),
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

describe("/map page", () => {
  it("renders Randomize, Save, and Share buttons", () => {
    render(<Page />);
    expect(screen.getByText(/Randomize/i)).toBeInTheDocument();
    expect(screen.getByText(/Save/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Share/i)).toBeInTheDocument();
  });
});

// Import after mocks so the page consumes the mocked modules.
import Page from "./page";
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/app/map/page.test.tsx`
Expected: FAIL — `page.tsx` not found.

- [ ] **Step 4: Implement the page**

Create `src/app/map/page.tsx`:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Download, Share2, Shuffle } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/Button";
import { Customizer } from "@/components/map/Customizer";
import { LivePreview } from "@/components/map/LivePreview";
import { useMapPrintState } from "@/hooks/useMapPrintState";
import { downloadMapPng, shareMapPng } from "@/lib/render/png-map";

export default function MapPage() {
  const { input, update, updateLocation, randomize, data, geometry, loading } =
    useMapPrintState();
  const [generating, setGenerating] = React.useState(false);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [spinning, setSpinning] = React.useState(false);
  const [cooldownMsg, setCooldownMsg] = React.useState<string | null>(null);
  const randomizeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const clickCountRef = React.useRef(0);
  const lastClickRef = React.useRef(0);
  const cooldownUntilRef = React.useRef(0);
  const msgTimeoutRef = React.useRef<number | null>(null);

  const COOLDOWN_MSGS = [
    "Whoa, partner. The map needs a breath.",
    "Easy, tiger — the streets are still reassembling.",
    "Patience, cartographer. Even the map takes a beat.",
    "Hold your horses. The map isn't going anywhere.",
    "That's enough excitement for now. Take a knee.",
    "The roads are dizzy. Give them a sec.",
    "You're mashing that button like it owes you money.",
    "The map is on a quick coffee break. Back in a moment.",
  ];

  const fireConfetti = () => {
    const colors = ["#C9A35A", "#E8D5A0", "#F4E9C6", "#FFFFFF", "#D4AF37"];
    const btn = randomizeBtnRef.current;
    const rect = btn?.getBoundingClientRect();
    const origin = rect
      ? {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        }
      : { y: 0.7 };
    const opts = { origin, colors, scalar: 0.3, startVelocity: 22, ticks: 200 };
    confetti({ particleCount: 80, angle: 270, spread: 70, ...opts });
    setTimeout(() => {
      confetti({ particleCount: 40, angle: 240, spread: 55, ...opts });
      confetti({ particleCount: 40, angle: 300, spread: 55, ...opts });
    }, 150);
  };

  const showCooldownMsg = () => {
    const msg = COOLDOWN_MSGS[Math.floor(Math.random() * COOLDOWN_MSGS.length)];
    setCooldownMsg(msg);
    if (msgTimeoutRef.current) window.clearTimeout(msgTimeoutRef.current);
    msgTimeoutRef.current = window.setTimeout(() => setCooldownMsg(null), 2200);
  };

  const onRandomize = () => {
    const now = performance.now();
    if (now < cooldownUntilRef.current) {
      showCooldownMsg();
      return;
    }
    if (now - lastClickRef.current > 2000) {
      clickCountRef.current = 0;
    }
    lastClickRef.current = now;
    clickCountRef.current += 1;

    randomize();
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
    fireConfetti();

    if (clickCountRef.current >= 5) {
      cooldownUntilRef.current = now + 5000;
      clickCountRef.current = 0;
    }
  };

  const filename = `gunari-map-${slug(input.location.label)}-${slug(input.title || "untitled")}.png`;

  const onDownload = async () => {
    if (!geometry) return;
    setGenerating(true);
    try {
      await downloadMapPng(input, geometry, filename);
      setFlash("Saved — add it to your story");
      setTimeout(() => setFlash(null), 1800);
    } finally {
      setGenerating(false);
    }
  };

  const onShare = async () => {
    if (!geometry) return;
    setGenerating(true);
    try {
      await shareMapPng(
        input,
        geometry,
        filename,
        input.title || "Gunari Map Print",
        input.message || "Every place tells a story.",
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-ink">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-stone hover:text-mist transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <span className="font-display text-xl tracking-[0.3em] text-mist">GUNARI</span>
          <div className="w-16" />
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="order-1 lg:order-1">
            <div className="lg:sticky lg:top-10">
              <LivePreview input={input} data={data} geometry={geometry} loading={loading} />
            </div>
          </div>

          <div className="order-2 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
              className="mb-8 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Button
                    ref={randomizeBtnRef}
                    size="md"
                    onClick={onRandomize}
                    disabled={!geometry}
                    className="w-full bg-gradient-to-r from-gold via-[#E8D5A0] to-gold text-ink shadow-[0_0_20px_-4px_rgba(201,163,90,0.5)] hover:shadow-[0_0_28px_-2px_rgba(201,163,90,0.7)]"
                  >
                    <motion.span
                      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      className="inline-flex"
                    >
                      <Shuffle size={14} />
                    </motion.span>
                    Randomize
                  </Button>
                  <AnimatePresence>
                    {cooldownMsg && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-gold/30 bg-ink/95 px-3 py-2 text-[11px] font-medium text-gold shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)]"
                      >
                        {cooldownMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Button
                  variant="outline"
                  size="md"
                  onClick={onDownload}
                  disabled={generating || !geometry}
                >
                  <Download size={14} />
                  Save
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <ShareIconButton label="Share" onClick={onShare} disabled={generating || !geometry}>
                  <Share2 size={16} />
                </ShareIconButton>
              </div>
              <p className="text-center text-[10px] uppercase tracking-[0.25em] text-stone">
                Save your map. Add it to your story.
              </p>
              {flash && (
                <p className="text-center text-[10px] uppercase tracking-[0.25em] text-gold">
                  {flash}
                </p>
              )}
            </motion.div>

            <Customizer input={input} update={update} updateLocation={updateLocation} />
          </div>
        </div>
      </div>
    </main>
  );
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "gunari"
  );
}

function ShareIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md text-mist transition-colors duration-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/map/page.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the dev server and smoke-test the route manually**

Run: `npm run dev` (in one terminal)
Then in another: `curl -sI http://localhost:3000/map | head -3`
Expected: HTTP 200.

Open `http://localhost:3000/map` in a browser. Verify: header renders, LivePreview canvas appears, Customizer with 10 controls renders, Randomize button fires confetti. Stop the dev server when done.

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/map/layout.tsx src/app/map/page.tsx src/app/map/page.test.tsx
git commit -m "Add /map route: Map Print create flow with Randomize + Save + Share + Customizer"
```

---

## Task 9: Landing page second CTA

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: existing `src/app/page.tsx` (298 lines) with primary CTA "Create Your Gunari" → `/create`
- Produces: second CTA "Map Print" → `/map` below the primary

- [ ] **Step 1: Read the existing landing page**

Read `src/app/page.tsx` to find the primary CTA block (around lines 61–77). The structure is:

```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
  className="mt-10"
>
  <Link href="/create">
    <motion.button ...>
      Create Your Gunari
    </motion.button>
  </Link>
</motion.div>
```

- [ ] **Step 2: Add the second CTA**

In `src/app/page.tsx`, replace the `<motion.div className="mt-10">...</motion.div>` block (containing the primary CTA) with:

```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
  className="mt-10 flex flex-col items-center gap-4"
>
  <Link href="/create">
    <motion.button
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full border border-gold/40 bg-gradient-to-r from-gold via-[#E8D5A0] to-gold px-10 font-ui text-base uppercase tracking-wide text-ink shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_8px_30px_-8px_rgba(201,163,90,0.6)] transition-[border-color,box-shadow] duration-300 hover:border-gold/70 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_12px_40px_-6px_rgba(201,163,90,0.9)]"
    >
      Create Your Gunari
    </motion.button>
  </Link>
  <Link href="/map">
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-mist/30 bg-transparent px-8 font-ui text-sm uppercase tracking-wide text-mist transition-colors duration-300 hover:border-mist/60 hover:bg-mist/5"
    >
      Map Print
    </motion.button>
  </Link>
</motion.div>
```

- [ ] **Step 3: Run the dev server and verify visually**

Run: `npm run dev`
Open `http://localhost:3000`. Verify: primary CTA "Create Your Gunari" renders, secondary CTA "Map Print" renders below it. Click "Map Print" → navigates to `/map`. Stop the dev server.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "Add Map Print second CTA on the landing page"
```

---

## Task 10: E2E Playwright test

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/map.spec.ts`
- Modify: `package.json` (add `@playwright/test` devDep + `test:e2e` script)

**Interfaces:**
- Consumes: `/map` route from Task 8 + dev server on `localhost:3000`
- Produces: Playwright e2e test verifying the Map Print flow loads, customizes, and exports

- [ ] **Step 1: Install `@playwright/test`**

Run: `npm install -D @playwright/test`
Then: `npx playwright install chromium`
Expected: `@playwright/test` added to devDependencies, chromium browser installed.

- [ ] **Step 2: Add a `test:e2e` script to `package.json`**

In `package.json` `scripts`, add:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 3: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
```

- [ ] **Step 4: Write the e2e test**

Create `e2e/map.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("Map Print flow: load, change theme, save", async ({ page }) => {
  await page.goto("/map");

  // Page renders
  await expect(page.getByText("GUNARI").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Randomize/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Save/i })).toBeVisible();

  // Canvas is present
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();

  // Change theme to Midnight (click the radio)
  await page.getByRole("radio", { name: /Midnight/i }).click();

  // Wait a moment for re-render
  await page.waitForTimeout(300);

  // Click Save and expect a download
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: /Save/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/gunari-map-.*\.png/);
});
```

- [ ] **Step 5: Run the e2e test**

Run: `npm run test:e2e`
Expected: PASS — the test loads `/map`, changes theme, clicks Save, and verifies a PNG download is triggered.

Note: this requires the dev server to start (the `webServer` config handles that). The first run may take ~30s for server startup.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e/map.spec.ts
git commit -m "Add Playwright e2e test for /map route (load, theme change, save download)"
```

---

## Self-review notes

After writing the plan, I checked it against the spec:

**Spec coverage:**
- §1 Context → Tasks 1–2 (contract extension + scene becomes real)
- §2 Architecture (contract extension, scene real, app layer) → Tasks 1, 2, 4–8
- §3 Components (file-by-file) → Tasks 1–8 each map to the spec's component list
- §4 Data flow (initial load, location change, theme/shape/marker change, rotation, zoom, randomize, save, share, date/time absence) → Tasks 4 (hook covers load/project lifecycle), 6 (LivePreview covers render), 7 (export covers save/share), 8 (page covers randomize)
- §5 Error handling (OSM failure, rapid changes, invalid location, overflow, export failure, abort, rotation while loading) → Task 2 (graceful degradation in scene.load), Task 4 (debounce + abort in hook), Task 6 (loading state in LivePreview)
- §6 Testing (core tests, scene-mapprint tests, app tests, e2e) → Tasks 1, 2, 3, 4, 5, 6, 7, 8, 10
- §7 Design decisions (scope, contract fix, customizer, landing, randomize) → reflected in task scope

**Placeholder scan:** No TBD/TODO/FIXME/XXX in any step. All steps have concrete code or shell commands.

**Type consistency:**
- `SceneInput` (Task 1) with `location` field used consistently in Tasks 2, 4, 5, 6, 7, 8.
- `MapPrintInput` (Task 4) = `SceneInput & { title; message? }` used consistently in Tasks 5, 6, 7, 8.
- `MAP_PREVIEW_VIEWPORT(layout)` (Task 4) used in Tasks 6, 7.
- `MapPrintSceneData` with `zoom` field (Task 2) used in Tasks 4, 6.
- `mapPrintScene.render` 7-arg signature (Task 1) used in Tasks 6, 7 (via `scene: { render: mapPrintScene.render }`).
- `getMapTheme(style)` (existing, re-exported via `@gunari/scene-mapprint`) used in Tasks 6, 7.

**Known simplifications:**
- Task 5's Customizer uses a hand-rolled `RadioGroup` and `LabelsToggle` instead of pulling in shadcn/ui `RadioGroup` / `Switch` components. This avoids needing to install/run shadcn CLI in the plan; the visual style matches the existing `/create` customizer's Tailwind patterns. If the project already has these shadcn components installed, the implementer may swap to them — but the test contract (roles, labels) stays the same.
- Task 8's page omits the social-icon ShareIconButton row (Facebook, Instagram, X, Reddit) from `/create` for brevity; only the generic ShareIconButton is included. If the user wants the full social row, that's a small addition — same pattern as `/create`.
- Task 10's e2e test runs only in chromium (not firefox/webkit) to keep CI cost low. Cross-browser is a future polish.

**Plan size:** 10 tasks, ~70 steps total. Each task ends with a commit; each commit is independently testable.