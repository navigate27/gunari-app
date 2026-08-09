# Map Print — Plan 2: Next.js App Integration Design

**Goal:** Wire the `@gunari/scene-mapprint` package (built in Plan 1) into the Gunari Next.js app as a new `/map` route, fix the `Scene` contract gap Plan 1 flagged, and expose a full-matrix customizer with live preview and PNG export.

**Scope:** New `/map` route + new `src/components/map/*` + new `src/hooks/useMapPrintState.ts` + second landing-page CTA. Contract extension in `@gunari/core` (`SceneInput.location`, `Scene.render` signature, `ScaffoldInput` fields). `@gunari/scene-mapprint` `scene.ts` becomes real (no more stubbed defaults). The existing Star Chart (`/create`) is untouched.

**Out of scope:** Star Chart migration to the new contract (future sub-project). New scene packages (moon phase, timeline). Backend, auth, saved projects (PRD excludes these).

---

## 1. Context

Plan 1 stood up the platform: `@gunari/core` (Scene contract, geometry, scaffold, PNG export) and `@gunari/scene-mapprint` (Overpass data layer, projection, 5 themes, 3 shapes, 4 markers, 3 zooms, rotation, labels, 2 layouts, golden-image tests). All 94 unit tests pass; all 16 golden images committed.

Plan 1's `scene.ts` deliberately stubbed three things, each flagged as a Plan 2 fix:

1. `load(input, signal)` hardcoded `lat/lng = 0, 0`. Real `load` needs the user's location.
2. `project(data, viewport, rotation)` hardcoded `SIMPLIFY_TOLERANCE.district`. Real `project` needs the zoom the data was loaded at.
3. `render(ctx, geometry, palette)` hardcoded default `SceneInput` (`square/classic/solid/district/0/false/classic`) and default `SceneViewport` (`{ cx: 0.5, cy: 0.5, r: 0.4 }`) and hardcoded canvas dims `1080×1920`. Real `render` needs the user's input, the scaffold slot's viewport, and the canvas dimensions.

The `Scene` contract (in `@gunari/core/src/scene/scene.ts`) doesn't carry enough data through its method signatures to fix these without bypassing the contract. Plan 2 extends the contract properly.

The existing Gunari app (`src/app/`) is a night-sky product: `/create` route with `useGunariState` hook, `Customizer`, `LivePreview`, `exportToPng`. Map Print is a peer product on the same platform — a new `/map` route parallel to `/create`, not a modification of it. The Plan 1 spec §3.1 spelled this out: `app/map/` is a new route, `components/map/` is new components, `lib/render/` (Star Chart) is untouched.

---

## 2. Architecture

### 2.1 Contract extension (in `@gunari/core`)

Three coordinated changes:

**`SceneInput` gains `location`.** The 7 existing fields (shape, style, marker, zoom, rotation, labels, layout) stay. `location: { lat: number; lng: number; label: string }` is added. `SceneInput` already straddles load-time and render-time (it carries `zoom` for load and `shape`/`marker`/etc. for render); adding `location` is consistent — location is user input the same way zoom is.

**`Scene.render` signature extends.** From `(ctx, geometry, palette): void` to `(ctx, geometry, palette, input: SceneInput, viewport: SceneViewport, w: number, h: number): void`. The 4 new params carry the user's render choices, the scaffold slot position, and canvas dimensions. `SceneRenderFn` in `scaffold.ts` matches this signature.

**`ScaffoldInput` gains `sceneInput` + `sceneViewport`.** `renderScaffold` reads them and passes to `input.scene.render(ctx, input.sceneGeometry, input.scenePalette, input.sceneInput, input.sceneViewport, ARTWORK_W, ARTWORK_H)`.

`Scene.project` signature stays `(data, viewport, rotation)`. The zoom-dependent tolerance moves into the data: `MapPrintSceneData` gains `zoom: ZoomId` so `project` derives `SIMPLIFY_TOLERANCE[data.zoom]` internally.

### 2.2 Map Print scene becomes real (in `@gunari/scene-mapprint`)

`src/scene.ts` changes:

- `MapPrintSceneData` gains `zoom: ZoomId`. The cache value stores `{ geometry, bbox, zoom }`.
- `load(input, signal)` reads `input.location.lat` + `input.location.lng` + `input.zoom` → `bboxForZoom(lat, lng, zoom)`. Cache key is the bbox. On fetch failure, returns empty geometry (graceful degradation, same as Plan 1). Returns `{ geometry, bbox, zoom: input.zoom }`.
- `project(data, viewport, rotation)` reads `data.zoom` → `SIMPLIFY_TOLERANCE[data.zoom]` → `projectGeometry(data.geometry, viewport, rotation, tolerance)`.
- `render(ctx, geometry, palette, input, viewport, w, h)` calls `renderMap(ctx, geometry, palette as MapThemePalette, input, viewport, w, h)`. No more hardcoded defaults.

### 2.3 App layer (in `gunari-app/src/`)

New files:

- `src/app/map/layout.tsx` — shared layout (matches `app/create/layout.tsx` pattern).
- `src/app/map/page.tsx` — the route. Composes `useMapPrintState` + `Customizer` + `LivePreview` + export handlers. Mirrors `app/create/page.tsx` structure (Randomize + Save + Share buttons, confetti, cooldown gag) with map-specific state.
- `src/hooks/useMapPrintState.ts` — state + lifecycle.
- `src/components/map/Customizer.tsx` — 10 controls.
- `src/components/map/LivePreview.tsx` — canvas rendering the scaffold + scene at preview resolution.
- `src/lib/render/png-map.ts` — `exportMapPng({ input, geometry, data })` for full 1080×1920 export.

Modified files:

- `src/app/page.tsx` — add second CTA: "Map Print" → `/map`.
- `src/components/landing/*` — render the second CTA (depends on existing structure).

Untouched: `src/app/create/*`, `src/hooks/useGunariState.ts`, `src/components/create/*`, `src/lib/render/png.ts`, `src/lib/render/starChart.ts`, `src/lib/astronomy/*`.

---

## 3. Components (file-by-file)

### 3.1 `@gunari/core` — contract extension (3 files modified)

**`src/scene/types.ts`**
- `SceneInput` gains `location: { lat: number; lng: number; label: string }`.
- Other 7 fields unchanged.

**`src/scene/scene.ts`**
- `Scene.render` signature becomes `render(ctx: CanvasRenderingContext2D, geometry: SceneGeometry, palette: ThemePalette, input: SceneInput, viewport: SceneViewport, w: number, h: number): void`.

**`src/artwork/scaffold.ts`**
- `SceneRenderFn` matches the new 7-arg signature.
- `ScaffoldInput` gains `sceneInput: SceneInput` + `sceneViewport: SceneViewport`.
- `renderScaffold` calls `input.scene.render(ctx, input.sceneGeometry, input.scenePalette, input.sceneInput, input.sceneViewport, ARTWORK_W, ARTWORK_H)`.
- `drawMetadata` skips rendering when `meta.date` and `meta.time` are both empty (Map Print case — only location shows).

### 3.2 `@gunari/scene-mapprint` — scene becomes real (1 file modified)

**`src/scene.ts`**
- `MapPrintSceneData` becomes `{ geometry: MapGeometry; bbox: BBox; zoom: ZoomId }`.
- `load(input, signal)` reads `input.location.lat` + `input.location.lng` + `input.zoom`. Cache value stores `{ geometry, bbox, zoom }`. Returns `{ geometry, bbox, zoom: input.zoom }`.
- `project(data, viewport, rotation)` reads `data.zoom` → `SIMPLIFY_TOLERANCE[data.zoom]`.
- `render(ctx, geometry, palette, input, viewport, w, h)` calls `renderMap(ctx, geometry, palette as MapThemePalette, input, viewport, w, h)`.

### 3.3 Existing tests to update (in `@gunari/scene-mapprint`)

- `tests/scene.test.ts` — `MapPrintSceneData` requires `zoom`. `render` calls need 7 args. `project` test verifies tolerance tracks `data.zoom`.
- `tests/render.test.ts`, `tests/render.golden.test.ts` — already call `renderMap` directly. Confirm unaffected; update if imports changed. Golden PNGs stay as-is.

### 3.4 `gunari-app/src/` — new app code

**`src/app/map/layout.tsx`** — shared layout (matches `app/create/layout.tsx`).

**`src/app/map/page.tsx`** — the route. Structure:
- `useMapPrintState()` returns `{ input, update, updateLocation, randomize, data, geometry, loading, error }`.
- `generating`, `flash`, `spinning`, `cooldownMsg`, `showShareHint` state (mirror `/create`).
- `onRandomize`, `onShare`, `onDownload` handlers (mirror `/create`).
- Composition: header (Back + GUNARI wordmark) → grid with `LivePreview` (sticky on desktop) + action area (Randomize + Save + Share buttons + ShareIconButton row) + `Customizer`.

**`src/hooks/useMapPrintState.ts`** — state + lifecycle:
- `input: MapPrintInput` = `{ location: { lat, lng, label }, title, message, theme: MapStyleId, shape: ShapeId, marker: MarkerStyleId, zoom: ZoomId, rotation: number, labels: boolean, layout: LayoutId }`.
- Defaults: Manila (`{ lat: 14.5995, lng: 120.9842, label: "Manila, Metro Manila, Philippines" }`), title/message via `pickRandomPair()` from `src/lib/content/pairs.ts` (same pattern as `/create` — the default pairs are sky-themed but the user can edit; Map Print-specific pairs are future work), theme=`classic`, shape=`square`, marker=`solid`, zoom=`district`, rotation=`0`, labels=`false`, layout=`classic`.
- `update(key, value)`, `updateLocation(partial)`, `randomize()`.
- `data: MapPrintSceneData | null` — from `mapPrintScene.load(input, signal)`. Debounced 250ms on location/zoom change. Aborts in-flight on new change. Cache hit when bbox matches.
- `geometry: ProjectedMapGeometry | null` — from `mapPrintScene.project(data, viewport, input.rotation)`. `viewport` derived from `input.layout`: `{ cx: 0.5, cy: 0.5, r: input.layout === "poster" ? 0.42 : 0.4 }`. Recomputed on data/rotation/layout change.
- `loading: boolean`, `error: Error | null` (graceful degradation keeps `error` null on fetch failure).
- Cleanup: abort in-flight `AbortController` on unmount.

**`src/components/map/Customizer.tsx`** — 10 controls:
- Location (Photon autocomplete, reuses `src/lib/location/photon.ts`).
- Title, Message (text inputs).
- Theme (5: classic/midnight/blueprint/paper/twilight).
- Shape (3: square/circle/heart).
- Marker (4: solid/ring/heart/star).
- Zoom (3: neighborhood/district/city).
- Rotation (slider 0–360°, snaps to integer degrees; internally stored as radians).
- Labels (toggle).
- Layout (2: classic/poster).
- Visual style: matches `src/components/create/Customizer.tsx` patterns (Tailwind, shadcn/ui, motion.react transitions).

**`src/components/map/LivePreview.tsx`** — canvas at preview resolution 540×960:
- Receives `input`, `data`, `geometry`, `loading`.
- Calls `renderScaffold(ctx, { layout: input.layout, title: input.title, message: input.message, meta: { date: "", time: "", location: input.location.label }, palette: getMapTheme(input.style), scene: { render: mapPrintScene.render }, sceneGeometry: geometry, scenePalette: getMapTheme(input.style), sceneInput: input, sceneViewport: derivedViewport })`.
- Animated transitions: theme change fades (motion.react), shape/marker/labels change instant, rotation tweens (re-project each frame).
- Loading state: previous render stays visible; subtle dim or skeleton overlay while fetching new data.

**`src/lib/render/png-map.ts`** — `exportMapPng({ input, geometry, data })`:
- Creates offscreen 1080×1920 canvas.
- Calls `renderScaffold(ctx, { layout: input.layout, title: input.title, message: input.message, meta: { date: "", time: "", location: input.location.label }, palette: getMapTheme(input.style), scene: { render: mapPrintScene.render }, sceneGeometry: geometry, scenePalette: getMapTheme(input.style), sceneInput: input, sceneViewport: derivedViewport })`.
- `canvas.toBlob("image/png")` → returns `Promise<Blob>`.
- Reuses `downloadBlob` + `shareBlob` helpers from `src/lib/render/png.ts`.

### 3.5 Landing page (2 files modified)

**`src/app/page.tsx`** — add second CTA below existing "Create Your Gunari": "Map Print" → `/map`. Visual hierarchy: primary Star Chart CTA, secondary Map Print CTA.

**`src/components/landing/*`** — render the second CTA (depends on existing structure; minimal change).

### 3.6 File count

- `@gunari/core`: 3 modified (`scene/types.ts`, `scene/scene.ts`, `artwork/scaffold.ts`).
- `@gunari/scene-mapprint`: 1 modified (`scene.ts`), 1 test updated (`tests/scene.test.ts`).
- `gunari-app/src/`: 7 new (`app/map/layout.tsx`, `app/map/page.tsx`, `hooks/useMapPrintState.ts`, `components/map/Customizer.tsx`, `components/map/LivePreview.tsx`, `lib/render/png-map.ts`, plus tests), 2 modified (`app/page.tsx`, `components/landing/*`).

---

## 4. Data flow

### 4.1 Initial load (page mount)

1. `useMapPrintState` initializes with defaults (Manila, district zoom, classic theme, square shape, solid marker, 0° rotation, labels off, classic layout).
2. `mapPrintScene.load(input, signal)` → `bboxForZoom(14.5995, 120.9842, "district")` → checks in-memory LRU + IndexedDB cache → if miss, `fetchOsm(bbox)` (3-endpoint fallback, 10s timeout) → `parseOsm(osm, bbox)` → `cache.set` → returns `{ geometry, bbox, zoom: "district" }`.
3. `mapPrintScene.project(data, viewport, 0)` → `projectGeometry(geometry, viewport, 0, SIMPLIFY_TOLERANCE.district)` → `ProjectedMapGeometry`.
4. `LivePreview` receives `data` + `geometry` + `input` → calls `renderScaffold(...)` at 540×960 → draws to canvas.

### 4.2 User changes location

1. Photon autocomplete → user picks → `updateLocation({ lat, lng, label })`.
2. `useMapPrintState` debounces 250ms → aborts any in-flight `load` → calls `mapPrintScene.load(newInput, signal)`.
3. While loading: `LivePreview` shows previous render (with subtle dim overlay).
4. On success: `data` updates → `project(data, viewport, rotation)` → `geometry` updates → `LivePreview` re-renders.
5. On failure: `load` returns empty geometry (graceful degradation) → preview shows frame + title + marker, no roads.

### 4.3 User changes theme/shape/marker/labels/layout

1. `update("shape", "circle")` → `input` updates.
2. No `load` (data unchanged), no `project` (geometry unchanged).
3. `LivePreview` re-renders with new input. Theme change animates (fade), shape/marker/labels/layout instant.

### 4.4 User changes rotation

1. `update("rotation", rad)` → `input.rotation` updates.
2. No `load` (data unchanged).
3. `project(data, viewport, newRotation)` → new `geometry` (cheap, sync).
4. `LivePreview` re-renders. Rotation animates smoothly (motion.react tween on rotation value, re-projecting each frame).

### 4.5 User changes zoom

1. `update("zoom", "city")` → `input.zoom` updates.
2. `load(input, signal)` — different bbox → cache miss likely → fetch + parse.
3. While loading: previous geometry stays visible.
4. On success: `data.zoom = "city"` → `project(data, viewport, rotation)` uses `SIMPLIFY_TOLERANCE.city` (0.003) → new geometry.

### 4.6 User clicks Randomize

1. `randomize()` picks random theme/shape/marker/zoom/rotation/labels/layout (location + title + message untouched).
2. Each changed field triggers its own flow above (zoom triggers `load`; others trigger re-render only).
3. Confetti fires from the button; cooldown gag after 5 rapid clicks (same as `/create`).

### 4.7 User clicks Save (download)

1. `exportMapPng({ input, geometry, data })` runs in-browser.
2. Creates offscreen 1080×1920 canvas → calls `renderScaffold` with full input + viewport + `ARTWORK_W`/`ARTWORK_H` + `mapPrintScene.render`.
3. `canvas.toBlob("image/png")` → `downloadBlob(blob, "gunari-map-${slug(location)}-${slug(title)}.png")`.

### 4.8 User clicks Share

1. Same as Save but `shareBlob(blob, filename, title, message)` (Web Share API with fallback).

### 4.9 Date/time absence

Map Print has no date/time. `ScaffoldMeta` requires `date` and `time` strings — Map Print passes empty strings. `drawMetadata` renders only the location when both are empty (small change to scaffold).

---

## 5. Error handling

### 5.1 OSM fetch failure (network / rate-limit / all 3 endpoints down)

- `mapPrintScene.load` catches `OverpassError`, returns empty `MapGeometry` (`{ bbox, roads: [], water: [], waterways: [], parks: [], labels: [] }`), caches the empty result (so repeated loads don't retry), returns `{ geometry: empty, bbox, zoom }`.
- `LivePreview` renders the empty geometry: frame + background + marker + title + meta — no roads/water/parks. The user sees a valid print with just the location's marker. No error toast; the empty print IS the fallback.
- `useMapPrintState.error` stays `null` (graceful degradation isn't an error). A subtle "data unavailable" indicator is future polish, out of scope.

### 5.2 Rapid location changes (user typing in autocomplete)

- Photon autocomplete debounces in the input component (existing pattern in `src/lib/location/photon.ts`).
- `useMapPrintState` debounces 250ms before calling `load`.
- Each new `load` aborts the in-flight one via `AbortController`. The `OverpassError "aborted"` path rethrows (Plan 1 already handles this).
- The LRU cache means revisiting a previously-loaded location is instant.

### 5.3 Rapid zoom changes

- Same 250ms debounce + abort. Each zoom has its own bbox; the cache doesn't help across zooms but helps within.

### 5.4 Invalid / empty location

- Photon returns `{ label: "", lat: 0, lng: 0 }` for empty input. `bboxForZoom(0, 0, zoom)` returns a bbox in the Atlantic — Overpass returns empty. Same graceful-degradation path.
- The location input validates non-empty before enabling autocomplete (existing pattern).

### 5.5 Title/message overflow

- `renderScaffold` clamps title to `inner.w * 0.82` and message to `inner.w * 0.78` (canvas `fillText` width arg). Long text gets scaled/clipped by the canvas. No additional validation needed.

### 5.6 Canvas export failure

- `canvas.toBlob` can fail on very old browsers. If it returns null, throw an error caught by the page's `setGenerating(false)` finally block. No user-visible error toast in Plan 2 (matches `/create`).

### 5.7 Abort on unmount

- `useMapPrintState` cleans up its `AbortController` on unmount. No dangling fetches.

### 5.8 Rotation while loading

- If the user changes rotation while a `load` is in flight, the rotation applies to the previous geometry (still rendered). When the new data arrives, `project` runs with the latest rotation. No race — `geometry` is derived from `data` + `rotation` in a single `useMemo` chain.

---

## 6. Testing

### 6.1 `@gunari/core` tests (update existing)

- `tests/scene.test.ts` — add tests for the extended `SceneInput` (location field present) and the new `Scene.render` signature (mock scene verifies it receives `input`/`viewport`/`w`/`h` from `renderScaffold`).
- `tests/scaffold.test.ts` — add tests that `renderScaffold` passes `sceneInput` + `sceneViewport` + `ARTWORK_W`/`ARTWORK_H` through to `scene.render`. Verify scaffold's own drawing (title/message/meta/wordmark) works when `meta.date`/`meta.time` are empty strings (Map Print case).

### 6.2 `@gunari/scene-mapprint` tests (update existing)

- `tests/scene.test.ts` — `MapPrintSceneData` requires `zoom`. `project` test verifies tolerance tracks `data.zoom` (neighborhood → 0.0005, district → 0.001, city → 0.003). `render` test calls with 7 args, verifies it forwards to `renderMap`.
- `tests/render.test.ts`, `tests/render.golden.test.ts` — already call `renderMap` directly. Confirm unaffected; update if imports changed.
- Golden PNGs stay as-is (they test `renderMap`, not the scene contract).

### 6.3 `gunari-app` tests (new)

- `src/hooks/useMapPrintState.test.ts`:
  - Initial state has Manila defaults.
  - `updateLocation` triggers debounced `load` (use `vi.useFakeTimers`).
  - Rapid `updateLocation` aborts in-flight (assert `AbortController.abort` called).
  - `randomize` changes 7 fields, leaves location/title/message.
  - `update("rotation", x)` doesn't trigger `load`.
  - Cache hit on repeated location: second `load` for same bbox doesn't fetch.
- `src/components/map/Customizer.test.tsx` — render, assert 10 controls present, assert `update` called on change.
- `src/components/map/LivePreview.test.tsx` — render with mock `data`/`geometry`/`input`, mock `renderScaffold`, assert it was called with the right `sceneInput`/`sceneViewport`.
- `src/app/map/page.test.tsx` — smoke test: render page, assert Randomize + Save + Share buttons, assert click handlers wired.

### 6.4 E2E (Playwright)

- `e2e/map.spec.ts` — load `/map`, see preview, change theme, see canvas update, click Save, assert download triggered. Matches the existing `screenshot.mjs` pattern from Plan 1 spec §10.

### 6.5 Existing tests that must stay green

- All 94 Plan 1 unit tests (`npm test`).
- All 16 golden tests (`npm run test:golden`).
- Existing star-chart tests (none currently — no regression risk).

### 6.6 Test commands

- `npm test` — unit tests across `@gunari/core` + `@gunari/scene-mapprint` + new `gunari-app` tests.
- `npm run test:golden` — golden images (unchanged from Plan 1).
- `npm run typecheck` — `tsc --noEmit` across all workspaces.
- Playwright e2e — separate, not in default `npm test`.

---

## 7. Design decisions captured from brainstorming

- **Scope:** `/map` route + fix the Scene contract. Star Chart untouched. (User chose this over "stub stays" or "migrate Star Chart too".)
- **Contract fix:** Extend signatures (Approach A) — `SceneInput` gains `location`, `Scene.render` gains `(input, viewport, w, h)`. Not closure capture. (User chose A.)
- **Customizer:** Full matrix — all 10 controls exposed (location, title, message, theme, shape, marker, zoom, rotation, labels, layout). Not curated subset.
- **Landing:** Add a second CTA on the landing page ("Map Print" → `/map`). Not a hidden route, not a product-picker step.
- **Randomize:** Yes, mirror `/create` Randomize — randomizes the full cosmetic matrix (theme/shape/marker/zoom/rotation/labels/layout), location + title + message untouched. Confetti + cooldown gag included.

---

## 8. Future work (out of scope)

- **Star Chart migration to the new contract.** The existing `/create` route, `useGunariState`, `Customizer`, `LivePreview`, `lib/render/*` stay as-is. Migrating them to the Scene contract is a separate sub-project (Plan 3 or later).
- **New scene packages** (moon phase, timeline) — future, each its own sub-project.
- **Subtle "data unavailable" indicator** on OSM fetch failure — the empty print is the fallback; a visible indicator is polish.
- **Server-side rendering / batch export** — the Scene contract supports it, but Plan 2 is browser-only.
- **User geolocation** as a default location — Plan 2 uses Manila default (matches `/create`). Geolocation could be a Plan 3 enhancement.