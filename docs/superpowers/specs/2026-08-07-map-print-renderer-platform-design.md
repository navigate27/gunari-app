# Map Print & Shared Renderer Platform — Design

**Date:** 2026-08-07
**Status:** Approved (brainstorming phase complete; ready for implementation planning)
**Spec scope:** Long-term shared-renderer architecture + a complete Map Print product built on top of it.

---

## 1. Context

Gunari today is a client-side-only Next.js app that renders the night sky from a
(date, time, location) input into a 1080×1920 PNG. The architecture is clean:

- **Build-time data**: `scripts/build-starcatalog.mjs` fetches Hipparcos and writes
  `public/stars.json`. Same for `public/milkyway.json`.
- **Runtime**: `loadStarCatalog()` fetches the JSON once with `force-cache`, memoizes
  in memory.
- **Projection**: `src/lib/astronomy/engine.ts` (`computeSky`) takes a
  `CelestialContext` + `StarRecord[]` and produces a `SkyState` of projected
  `VisibleStar[]` in canvas-normalized [0,1] coordinates.
- **Rendering**: `src/lib/render/artwork.ts` (`renderArtwork`) is a pure function
  compositing background → frame → typography → star chart circle → compass →
  metadata → wordmark at 1080×1920.
- **Pluggable styles**: `STAR_CHART_STYLES`, `FRAMES`, `COMPASS_STYLES` — each a
  `Record<id, { id, label, render }>`. Dispatch by id.
- **Themes**: `THEMES: Record<ThemeId, ThemePalette>` — pure data, no theme code.

This spec extends that architecture to support a **Map Print** product (minimalist
printable artwork rendered from raw OpenStreetMap data, mirroring how Star Chart
renders from raw Hipparcos data) and establishes a **shared renderer platform** that
future Gunari products (Moon Phase, Timeline, etc.) will plug into.

The user's brief, in full, is the source of truth for product intent. This spec
answers the 10 architecture questions posed in that brief (Section 11) and defines
the platform Map Print sits on.

---

## 2. Decisions locked during brainstorming

| # | Question | Decision |
|---|---|---|
| 1 | OSM data path | Browser → public Overpass directly. No backend. |
| 2 | Output target | 1080×1920 PNG, same canvas as Star Chart. "Wall art" is the aesthetic, not a literal print deliverable. |
| 3 | Spec scope | Long-term architecture + full Map Print customization matrix in one spec. |
| 4 | Star Chart refactor | Leave the existing Star Chart untouched in this work; migrate it onto `@gunari/core` in a later sub-project. |
| 5 | Architecture | Real monorepo with `@gunari/*` packages (npm workspaces). The Scene contract is the architectural lever. |

Decision #4 + Decision #5 create a known temporary inconsistency: the new code lives
in `packages/` while the existing Star Chart stays inlined in
`apps/gunari-app/src/lib/render/`. This is accepted. The duplication between the new
`@gunari/core` composition scaffold and Star Chart's existing `artwork.ts` /
`themes.ts` is removed in the Star Chart migration sub-project.

---

## 3. Architecture

### 3.1 Monorepo layout

```
gunari/                                monorepo root
  package.json                         workspaces: ["packages/*", "apps/*"]
  packages/
    @gunari/core/                      framework-agnostic, pure TS, no React
      src/
        scene/                         Scene contract + SceneRegistry
        geometry/                       clip, mask, simplify, project utilities
        theme/                          base ThemePalette interface + types
        artwork/                         composition scaffold (frame, title,
                                       message, metadata, wordmark slots)
        export/                         PNG export (canvas → blob)
      package.json
    @gunari/scene-mapprint/            new; depends on @gunari/core
      src/
        data/                           Overpass client + cache (LRU + IndexedDB)
        projection/                     Web Mercator viewport → canvas [0,1]
        interpret/                      OSM tags → internal MapGeometry
        styles/                         Classic / Midnight / Blueprint / Paper / Twilight
        shapes/                         Square / Circle / Heart clip paths
        markers/                        Solid / Ring / Heart / Star pin silhouettes
        scene.ts                        implements Scene contract
      package.json
  apps/
    gunari-app/                        existing Next.js app
      src/
        lib/render/                      existing Star Chart (untouched)
        app/
          map/                            new route — Map Print create flow
        components/
          map/                             new Map Print customizer
```

### 3.2 Why this shape

The user's proposed diagram conflated two layers — the **composition scaffold**
(1080×1920 frame, typography, wordmark — product-agnostic) and the **scene
renderer** (star chart, map print — product-specific). The architectural lever is
the **contract between them**: what does it mean to be "a Gunari product scene"?

This spec makes that contract explicit (Section 4). Star Chart, Map Print, Moon
Phase, Timeline all implement `Scene`. The Next.js shell composes scenes into the
artwork scaffold. Adding a product = adding a package + one route. Touching
`@gunari/core` only when there's a genuinely shared need.

### 3.3 Why a real monorepo (Approach B) over in-repo modules (Approach A)

For a 5–10 year roadmap that explicitly aims to be a "rendering platform," the
package boundary is worth the tooling overhead now:

- Hardest boundary — scenes physically cannot import from the app.
- A future second consumer (print server, native app, licensed library) is trivial:
  `import { renderArtwork } from "@gunari/core"`.
- npm workspaces is light: one `workspaces: ["packages/*", "apps/*"]` entry in root
  `package.json`. No Lerna, no Turborepo, no Nx — pure npm.

The cost is the temporary inconsistency noted in §2 until Star Chart migrates.

### 3.4 Future products

```
@gunari/scene-starchart     (migration of existing Star Chart, later sub-project)
@gunari/scene-moonphase     (future)
@gunari/scene-timeline      (future)
```

Each future product is a new package implementing `Scene`. None of them require
changes to `@gunari/core` unless they reveal a genuinely shared need — at which
point the abstraction earns its keep.

---

## 4. The Scene contract

The architectural lever. Lives in `packages/@gunari/core/src/scene/scene.ts`.

```typescript
export interface SceneCapabilities {
  shapes: readonly ShapeId[];
  styles: readonly MapStyleId[];
  markers: readonly MarkerStyleId[];
  zooms: readonly ZoomId[];
  supportsRotation: boolean;
  supportsLabels: boolean;
  layouts: readonly LayoutId[];
}

export interface SceneInput {
  shape: ShapeId;
  style: MapStyleId;
  marker: MarkerStyleId;
  zoom: ZoomId;
  rotation: number;          // radians
  labels: boolean;
  layout: LayoutId;
}

export interface SceneViewport {
  cx: number;                // canvas-normalized 0..1
  cy: number;
  r: number;
}

export interface Scene {
  readonly id: string;
  readonly capabilities: SceneCapabilities;

  /** Async fetch + parse. Memoized + cached by the scene. */
  load(input: SceneInput, signal: AbortSignal): Promise<SceneData>;

  /** Pure projection: data + viewport + rotation → geometry. Cheap; re-run on rotation. */
  project(data: SceneData, viewport: SceneViewport, rotation: number): SceneGeometry;

  /** Pure render: geometry + palette → ctx. No I/O, no side effects. */
  render(
    ctx: CanvasRenderingContext2D,
    geometry: SceneGeometry,
    palette: MapThemePalette,
  ): void;
}
```

`SceneData` and `SceneGeometry` are opaque to the platform — each scene defines its
own types. The platform only knows the contract surface.

### 4.1 The three-method split

- `load` is **async and cached**. It fetches OSM data, parses it into a
  scene-specific intermediate form, and caches the result. Re-run only when the
  user changes location or zoom.
- `project` is **pure and synchronous**. It takes cached `SceneData` + a viewport +
  rotation and produces `SceneGeometry` in canvas-normalized coordinates. Re-run
  on every rotation change — instant.
- `render` is **pure and synchronous**. It draws `SceneGeometry` to a canvas
  context with a palette. Same geometry + same palette = same pixels.

This split is the answer to "how does rotation stay interactive without re-fetching?"
A rotation slider tweak calls `project` + `render` only — never `load`. The user
never waits on a network call to see rotation change.

### 4.2 No `dispose`

Caches live inside the scene module and use a bounded LRU. GC handles the rest.
Adding `dispose` is a hook for future server-side batch runs but is YAGNI for v1.

### 4.3 SceneRegistry

A plain object, not a runtime registry:

```typescript
import * as mapprint from "@gunari/scene-mapprint";
export const SCENES: Record<string, Scene> = { mapprint };
```

Each Next.js route imports the scene it needs. No plugin system, no runtime
registration — the set of scenes is known at build time, and code-splitting is
achieved at the route level via Next.js dynamic imports.

---

## 5. OSM data layer

Lives in `packages/@gunari/scene-mapprint/src/data/`. Answers brief questions 1, 2,
and 5.

### 5.1 Data source — Overpass API (browser → public instance)

Overpass returns raw OSM geometry with semantic tags (`highway=*`, `waterway=*`,
`leisure=park`, `natural=water`). Gunari interprets the data — road hierarchy, line
widths, layer ordering, clipping, masking. No tiles, no pre-baked cartography. This
matches the Hipparcos pattern exactly: raw data in, Gunari owns the rendering.

Why not the alternatives:

- **Vector tiles** (Mapbox, MapLibre, Protomaps): pre-rendered cartography in
  tile form. Defeats "Gunari owns the rendering" — we'd be re-styling someone
  else's render, not interpreting raw data.
- **OSM extracts (Geofabrik)**: region-sized bulk extracts. We'd still need to
  extract a viewport per query, plus ship ~100 MB of data per region. Wrong shape.
- **Self-hosted Overpass**: real infrastructure cost and maintenance, contradicts
  the no-ops ethos. Overkill at current traffic. **Long-term upgrade path** if
  public instances become a bottleneck.

### 5.2 Overpass QL query

POST body, JSON output (`out:json`):

```overpass
[out:json][timeout:25];
(
  way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|path|footway|cycleway)$"](bbox);
  way[waterway](bbox);
  way["natural"="water"](bbox); relation["natural"="water"](bbox);
  way["leisure"="park"](bbox); way["leisure"="garden"](bbox);
  way["boundary"="protected_area"](bbox);
  way["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](bbox);   // for labels
  node["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"](bbox);
);
out:geom;
```

Notes:

- `out:geom` returns ways with embedded geometry — smaller payload than
  `out body geom`, no node ID lookups.
- Buildings, businesses, amenities, public_transport, shop, tourism, traffic are
  deliberately excluded. Buildings may be revisited in a future sub-project if
  they improve a specific style.
- The bbox is sized per zoom (see §5.6).

### 5.3 Instance selection + fallback

A small ordered list of public Overpass instances:

```typescript
const OVERPASS_ENDPOINTS = [
  "https://overpass.komoot.io/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];
```

`load()` tries each in order with a 10 s client-side timeout per instance (the
`[timeout:25]` in the Overpass QL is the server-side query budget — the client
times out first so the user never waits 25 s). On 429 (rate limit) or 5xx, fall to
the next instance. On all-fail, the scene renders with empty geometry (just the
marker on the theme background) and the UI shows a soft "couldn't reach map data —
retry" state. Never a blank canvas, never a hard error page.

### 5.4 Parsing — hand-rolled, not `osmtogeojson`

OSM's `out:geom` JSON is small (ways with embedded coordinate arrays). We walk
ways, classify by tag into `Road | Water | Park | Label`, drop everything else,
build the internal `MapGeometry`. ~150 lines, no dep, full control over which
fields we keep. `osmtogeojson` would convert to GeoJSON first (a format we'd
immediately re-parse) — extra indirection for no benefit.

### 5.5 Caching — three layers

| Layer | Key | Location | Bound | Survives |
|---|---|---|---|---|
| In-memory LRU | `hash(lat,lng,zoom,radius)` | scene module | 20 viewports | session |
| HTTP cache | Overpass response URL | browser HTTP cache | `Cache-Control` headers | TTL |
| IndexedDB | `hash(lat,lng,zoom,radius)` | browser | 50 viewports, LRU | reloads |

- The in-memory LRU is the hot path: revisiting a location during a session is
  instant.
- IndexedDB is the warm path: a user who reloads the page on the same location
  gets the cached geometry without re-fetching.
- The HTTP cache is a free win on top — public Overpass instances return
  `Cache-Control: max-age=N`, so even a cache miss to Overpass might hit a CDN
  edge.
- No `public/` build-time cache. Every user's location is different — unlike the
  star catalog, Map Print can't be pre-baked.

### 5.6 Zoom levels

| Zoom id | Approx. bbox size | Use case |
|---|---|---|
| neighborhood | ~0.6 km × 0.6 km | A few blocks — fine-grained road detail |
| district | ~2 km × 2 km | A neighborhood/district — balanced detail |
| city | ~12 km × 12 km | Whole-city view — major roads only |

Bbox sizes scale with latitude (Mercator distortion), so the actual lng-span is
`kmSpan / (111.32 * cos(lat))` and the lat-span is `kmSpan / 110.574`.

---

## 6. Geometry pipeline

Lives in `packages/@gunari/scene-mapprint/src/interpret/` and `…/projection/`.
Answers brief questions 3, 6, 7, and the library parts of 4.

### 6.1 Internal geometry model (mandatory)

OSM's raw format (nodes/ways/relations + tags) is too unstructured to render well.
We define an internal `MapGeometry` type:

```typescript
export type RoadClass =
  | "motorway" | "trunk" | "primary" | "secondary"
  | "tertiary" | "residential" | "path";

export interface Road { class: RoadClass; points: [number, number][]; }   // 0..1, canvas-normalized
export interface Polygon { points: [number, number][]; holes?: [number, number][][]; }
export interface Label { text: string; x: number; y: number; class: "road" | "place"; }

export interface MapGeometry {
  bbox: [number, number, number, number];   // minLng, minLat, maxLng, maxLat
  roads: Road[];
  water: Polygon[];                          // lakes/ponds as polygons
  waterways: [number, number][][];           // rivers as lines (non-polygonal)
  parks: Polygon[];
  labels: Label[];                           // populated even when input.labels=false;
                                            // render honors the toggle
}
```

The renderer never sees OSM tags or raw lat/lng. It draws `Road[]` and `Polygon[]`
in canvas-normalized coordinates. This is the answer to brief Q3 — yes, an internal
model is mandatory.

### 6.2 Three-stage pipeline

```
load(input)
  ├─ 1. Overpass fetch → raw OSM JSON (out:geom)
  ├─ 2. Parse: classify ways → tagged roads/water/parks/labels
  └─ 3. Cache the parsed-but-unprojected MapGeometry (SceneData)

project(data, viewport, rotation)
  ├─ 4. Web Mercator: (lat,lng) → projected meters
  ├─ 5. Normalize to [0,1] against bbox → canvas coords
  ├─ 6. Simplify: Douglas-Peucker per line, tolerance scales with zoom
  └─ 7. Rotate around viewport center, drop anything outside [-0.1, 1.1]

render(ctx, geometry, palette)
  ├─ 8. Apply shape mask (square/circle/heart) via ctx.clip()
  ├─ 9. Draw by layer: water → parks → waterways → roads (sorted by class)
  ├─10. Draw labels (when input.labels = true)
  └─11. Draw marker (pin silhouette + symbol) on top
```

Stages 1–3 are async (in `load`, cached). Stages 4–7 are pure (in `project`,
re-run on rotation). Stages 8–11 are pure (in `render`). The split is what makes
rotation instant: rotation re-runs 4–11 only, never 1–3.

### 6.3 Projection — Web Mercator

Web Mercator (EPSG:3857) for all three zoom levels. At Neighborhood/District/City
scale, distortion is sub-pixel — fine. Only at country scale would we need a local
tangent plane, which is YAGNI now.

Project `(lat,lng) → (x,y)` in meters, then normalize against the bbox to `[0,1]`.

### 6.4 Simplification — `simplify-geometry`

`simplify-geometry` (no deps, ~1 KB, Douglas-Peucker). Tolerance scales with zoom
level — Neighborhood keeps more detail than City. Applied per-line at stage 6, not
on the raw OSM payload (we cache the unsimplified `MapGeometry` so different
zooms/tolerances can re-simplify from cache).

Why not `@turf/simplify`: turf pulls a much larger dependency tree for the same
algorithm. The tiny library does the job.

### 6.5 Clipping — two stages

- **Bbox clip** (geometry-time, stage 6): `@turf/bbox-clip` on lines/polygons that
  extend past the viewport. Trims geometry to the bbox so the simplifier and
  renderer don't waste cycles on invisible points.
- **Shape mask** (render-time, stage 8): canvas-native `ctx.clip()` with the shape
  path (Square/Circle/Heart). Two lines of canvas code, no library.

The brief lists "clipping" and "masking" as separate renderer responsibilities —
they are: bbox-clip is geometry-time, shape-clip is render-time.

### 6.6 Rotation — pure post-projection transform

Apply rotation in projected canvas space, not geographic space. After
normalization to `[0,1]` and simplification, translate geometry so the viewport
center `(0.5, 0.5)` is at the origin, rotate by `θ`, translate back. Then drop any
point outside `[-0.1, 1.1]` (small overscan so curves don't snap at the edge).

This is the answer to brief Q7 — rotation is a pure post-projection transform, so
a rotation slider is instant and never re-fetches.

### 6.7 Library recommendations (brief Q4, consolidated)

| Concern | Library | Why |
|---|---|---|
| Querying | raw `fetch` to Overpass | Overpass QL is a POST; no library needed |
| Parsing | hand-rolled | OSM `out:geom` JSON is small; full control |
| Simplification | `simplify-geometry` | Tiny, no deps, Douglas-Peucker |
| Clipping | `@turf/bbox-clip` | Standard, used only for bbox trim |
| Masking | canvas-native `ctx.clip()` | Two lines of canvas code |
| Rendering | HTML5 Canvas | Matches existing renderer; no SVG, no WebGL |

---

## 7. Rendering, themes, shapes, markers

Answers brief question 8.

### 7.1 Composition scaffold (`@gunari/core/src/artwork/`)

A new, minimal version of Star Chart's existing `renderArtwork` — owns background,
frame, title, message, metadata, wordmark slots, and one **scene slot** where the
scene renders. The scaffold calls `scene.render(ctx, geometry, palette)` inside the
scene slot; it never knows what's inside.

Intentionally parallel to Star Chart's `artwork.ts` until the migration sub-project
consolidates them. For v1, the scaffold lives in `@gunari/core` and is consumed
only by Map Print.

### 7.2 Layouts

Two layouts, mirroring Star Chart:

- **classic** — title + message at top, scene in the middle, metadata + wordmark at
  bottom.
- **poster** — wordmark at top, scene dominant, title + message below scene,
  metadata at bottom.

Layout only changes the scene slot's `viewport` (cx, cy, r) and the typography
positions. Same scaffold, same scene.

### 7.3 Theme palette — pure data

```typescript
export interface MapThemePalette {
  id: MapStyleId;
  label: string;
  background: { top: string; bottom: string };
  road: {
    motorway:    { color: string; width: number };
    trunk:       { color: string; width: number };
    primary:     { color: string; width: number };
    secondary:   { color: string; width: number };
    tertiary:    { color: string; width: number };
    residential: { color: string; width: number };
    path:        { color: string; width: number };
  };
  water: string;
  waterway: string;
  park: string;
  marker: string;
  markerSymbol: string;
  label: string;
  title: string;
  message: string;
  meta: string;
  accent: string;
  light: boolean;
}
```

Five themes — Classic, Midnight, Blueprint, Paper, Twilight — are five entries in
`MAP_THEMES: Record<MapStyleId, MapThemePalette>`. Pure data, no theme code. Adding
a theme = adding an entry. Per-class road widths live in the palette so themes can
thin roads for a paper-look or thicken them for a midnight-poster look without code
changes.

### 7.4 Layer ordering + line widths

The renderer draws in this order, always:

1. Background gradient
2. Water polygons (fill)
3. Parks (fill)
4. Waterways (stroke)
5. Roads, sorted `motorway → trunk → primary → secondary → tertiary → residential →
   path`, each class drawn as one batch (so secondary roads never overlap a
   motorway)
6. Labels (when `input.labels = true`)
7. Marker (pin silhouette + symbol)
8. Frame, title, message, metadata, wordmark (from the scaffold)

### 7.5 Shape masking

Three clip paths in `…/shapes/`:

```typescript
export type ShapeId = "square" | "circle" | "heart";
export interface ShapePath { apply(ctx: CanvasRenderingContext2D, r: number): void; }
```

Each shape is a single function that traces a path on `ctx` for `ctx.clip()`. Square
is `rect`, Circle is `arc`, Heart is two cubic beziers + an arc (classic heart
geometry, ~10 lines). All three ship in v1. New shapes (future) are new entries in
`SHAPES: Record<ShapeId, ShapePath>` — no renderer changes.

### 7.6 Markers — pin silhouette preserved, symbol varies

```typescript
export type MarkerStyleId = "solid" | "ring" | "heart" | "star";

export interface MarkerStyle {
  id: MarkerStyleId;
  drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: MapThemePalette): void;
  drawSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, palette: MapThemePalette): void;
}
```

The pin silhouette (a teardrop with a pointer at the bottom) is drawn once per
marker by `drawPin` — same function across all four markers. `drawSymbol` draws the
inner content: filled circle for `solid`, ring for `ring`, heart for `heart`,
five-point star for `star`. The "always preserve silhouette" rule from the brief is
**structural** — `drawPin` is shared, only `drawSymbol` differs. All four markers
ship in v1.

### 7.7 Labels

When `input.labels = true`, the renderer draws `Label[]` from `MapGeometry` using
`palette.label`. The data layer always fetches labels, `project` always includes
them, `render` only draws them when `input.labels` is true. No separate code path.

---

## 8. v1 scope — full customization matrix

| Dimension | v1 ships |
|---|---|
| Shapes | square, circle, heart |
| Styles | classic, midnight, blueprint, paper, twilight |
| Markers | solid, ring, heart, star |
| Zooms | neighborhood, district, city |
| Rotation | 0–360° slider |
| Labels | toggle (on/off) |
| Layouts | classic, poster |

**UI surface (v1):** a new `/map` route, parallel to the existing `/create`. The
customizer includes:

- Location picker (reuses the existing Photon autocomplete).
- Title input.
- Optional message input.
- Theme picker (5 entries).
- Marker picker (4 entries).
- Shape picker (3 entries).
- Zoom picker (3 entries).
- Rotation slider (0–360°).
- Labels toggle.
- Layout picker (2 entries).
- Live preview.
- Generate button → 1080×1920 PNG export via the existing PNG export path.

The landing page gets a secondary CTA linking to `/map` (or a product switcher —
implementation detail, settled in the plan).

---

## 9. Error handling & graceful degradation

Beyond the Overpass failure path (§5.3):

**Slow Overpass response.** A 10 s timeout per instance, then fall through. The UI
shows a "fetching map data…" state in the preview's scene slot while waiting. The
scaffold (frame, title, message) renders immediately so the user sees the artwork
shell, with the scene slot empty until data lands.

**Location with no OSM data** (open ocean, remote area). Render with whatever
geometry was returned — possibly just water polygons, or truly empty. The marker
still draws at the chosen lat/lng. Not an error; a valid edge case.

**Browser memory pressure.** In-memory LRU bounded at 20 viewports. IndexedDB
capped at 50. If a single Overpass payload exceeds ~5 MB, drop parks first
(smallest visual loss), then tertiary/residential roads, keeping
motorway/trunk/primary/water. Defensive cap, not an expected state — District zoom
payloads are typically 50–200 KB.

**AbortSignal on input change.** If the user changes location mid-fetch, the
in-flight `load()` is aborted. The next `load()` starts fresh. No race conditions;
the scene's `load()` honors `signal.aborted` and bails before parsing if aborted.

No global error boundary needed. Each failure mode is handled at the scene layer.

---

## 10. Testing strategy

### 10.1 Test runner — vitest (new)

The repo currently has no test runner — only `typecheck` + Playwright screenshots.
This spec adds **vitest** (lightweight, zero-config with TS) for the new packages.

### 10.2 Unit tests (pure functions)

- `@gunari/core/geometry/`: clipping a polygon to a bbox, simplifying a line,
  rotating points. Pure-input/pure-output, trivial.
- `@gunari/scene-mapprint/interpret/`: feed canned OSM JSON fixtures, assert the
  resulting `MapGeometry` has the right road classes, polygon shapes, label
  positions. **Fixtures, not live Overpass calls** — a small library of saved OSM
  payloads (e.g. a District-zoom extract of a known neighborhood) committed under
  `__fixtures__/`.
- `@gunari/scene-mapprint/projection/`: given a known bbox + lat/lng, assert the
  projected [0,1] coordinate. Pure math.
- `@gunari/scene-mapprint/shapes/` + `markers/`: assert that `apply(ctx, r)` traces
  a path with the expected number of operations (mock `ctx` and count calls).
  Verifies the silhouette is constant across markers.

### 10.3 Golden-image render tests

Because `render(ctx, geometry, palette)` is pure, same input = same pixels. A small
test harness:

1. Build a known `MapGeometry` fixture (e.g. "Manila District — 12 roads, 1 park, 1
   water polygon, 4 labels").
2. Render it to a 200×200 canvas in each of the 5 themes.
3. Compare against committed golden PNGs (pixel diff, with a small tolerance for
   sub-pixel rendering differences across browsers).
4. Same for each shape mask, each marker, each rotation angle (0°, 45°, 90°, 180°).

This is the single most valuable test type for a rendering project — it catches
regressions the type system can't (a color shift, a layer-order bug, a clip path
off-by-one). Playwright is already in the repo; the golden-image runner uses it to
render in a real browser canvas.

### 10.4 Overpass query tests

The Overpass QL string is built from `(lat, lng, zoom, radius)`. Assert the query
string for a few inputs — cheap, catches a malformed filter early. No live Overpass
in CI (flaky, rate-limited, against the no-backend principle).

### 10.5 What we don't test in v1

- Live Overpass calls (flaky, rate-limited).
- IndexedDB cache layer (mock the storage interface, test the LRU logic against it).
- The Next.js UI components (Playwright e2e covers the `/map` route smoke test —
  load page, see preview, click marker picker, see marker change. Existing
  `screenshot.mjs` pattern).

### 10.6 Coverage target

- `geometry/` and `interpret/` layers: near 100% — pure and small.
- `render` layer: covered by golden-image tests, not line coverage.
- `data` layer (Overpass client + cache): fixture-based unit tests + manual smoke
  tests.

### 10.7 Fixtures

A small library of saved OSM payloads committed under
`packages/@gunari/scene-mapprint/__fixtures__/`. ~5 fixtures, ~100 KB each. Each
fixture is a real Overpass response captured once during development and committed
for deterministic test rendering.

---

## 11. Answers to the 10 specific questions

### Q1. Best geographic data source?

**Overpass API**, queried directly from the browser against a public instance
(`overpass.komoot.io`, `overpass.openstreetmap.fr`, `overpass.osm.ch`), with
fallback through the list on 429/5xx. No backend, no self-hosting in v1.
Self-hosted Overpass is the long-term upgrade path if traffic grows.

### Q2. Which solution best aligns with Gunari's rendering philosophy?

Overpass. It returns raw OSM geometry with semantic tags. Gunari interprets the
data — road hierarchy, line widths, layer ordering, clipping, masking. No tiles,
no pre-baked cartography. Matches Hipparcos exactly: raw data in, Gunari owns the
rendering.

### Q3. Should I introduce an internal geometry model before rendering?

**Yes, mandatory.** OSM's raw format (nodes/ways/relations + tags) is too
unstructured to render well. The internal `MapGeometry` type (§6.1) — roads with
classes, water polygons, park polygons, labels, all in canvas-normalized [0,1]
coordinates — is the boundary between "OSM data" and "Gunari's render input." The
renderer never sees OSM tags.

### Q4. Which libraries for querying / parsing / simplification / clipping / masking / rendering?

See §6.7. Summary:

- **Querying:** raw `fetch` to Overpass (Overpass QL POST).
- **Parsing:** hand-rolled (OSM `out:geom` JSON is small).
- **Simplification:** `simplify-geometry` (tiny, no deps, Douglas-Peucker).
- **Clipping:** `@turf/bbox-clip` (bbox trim, geometry-time).
- **Masking:** canvas-native `ctx.clip()` with shape paths (render-time).
- **Rendering:** HTML5 Canvas (matches existing renderer).

### Q5. How should caching work?

Three layers (§5.5):

1. In-memory LRU (20 viewports, session lifetime) — hot path.
2. HTTP cache via `Cache-Control` headers on Overpass responses — free win.
3. IndexedDB (50 viewports, LRU, survives reloads) — warm path.

No build-time cache (every user's location is different, unlike the star catalog).

### Q6. How should viewport generation work?

Given `(lat, lng, zoom)`, compute a bbox sized per zoom (§5.6): neighborhood ~0.6
km, district ~2 km, city ~12 km. Web Mercator (EPSG:3857) projects every OSM node
to meters, then normalize against the bbox to canvas [0,1] space. The renderer
scales to the actual canvas size.

### Q7. How should rotation be implemented?

In projected canvas space, not geographic space (§6.6). Project first → translate
so viewport center is at origin → rotate by `θ` → translate back → drop points
outside `[-0.1, 1.1]`. Pure post-projection transform — rotation is instant and
never re-fetches.

### Q8. How should themes/styles be implemented?

Same data-driven model as today's `THEMES` (§7.3). A `MapThemePalette` struct with
per-class road colors + widths, water/park/marker/label colors, background
gradient. Five themes are five entries in a `MAP_THEMES: Record<MapStyleId,
MapThemePalette>` record. No theme-specific code. Adding a theme = adding an entry.

### Q9. How can the rendering engine remain reusable across future Gunari products?

The **Scene contract** (§4). Every product implements `Scene` (`{ id,
capabilities, load, project, render }`) and lives in its own package. The Next.js
shell imports only the scenes it ships. New products add new packages without
touching the core. The composition scaffold, geometry utilities, theme system, and
export are all in `@gunari/core`. When a second consumer appears (print server,
native app, licensed library), `@gunari/core` is already a clean package — just
`import` it.

### Q10. If building Gunari today with a 5–10 year roadmap, what architecture?

A monorepo (npm workspaces) with the layout in §3.1. `@gunari/core` is
framework-agnostic pure TS — portable to any canvas-capable runtime. Scenes are
independent packages implementing the `Scene` contract. The Next.js app is a thin
shell. This means Gunari can later:

- Run server-side batch generation (print-on-demand) without rewriting the
  renderer.
- License the core to other products.
- Ship a native app that reuses everything.
- Add new products (Moon Phase, Timeline) by adding a scene package, not forking
  the renderer.

The architecture is sized for that roadmap without paying for it now — the
package boundary is the only structural overhead, and it pays for itself the moment
a second scene lands.

---

## 12. Migration & future work (out of scope for v1)

### 12.1 Star Chart → `@gunari/core` migration

A later sub-project. The existing Star Chart code in
`apps/gunari-app/src/lib/render/` moves to `packages/@gunari/scene-starchart/`,
implementing the `Scene` contract. The existing `artwork.ts` and `themes.ts` get
replaced by imports from `@gunari/core`. The temporary duplication (§2) is removed.
The Star Chart's existing behavior is preserved — same themes, same styles, same
output.

### 12.2 Future products

- `@gunari/scene-moonphase` — Moon phase print.
- `@gunari/scene-timeline` — Timeline print.

Each is a new package implementing `Scene`. No `@gunari/core` changes unless a
genuinely shared need emerges.

### 12.3 Buildings

The brief says "Buildings are optional if they improve the final design." Buildings
are deliberately excluded from v1 (§5.2). A future sub-project may add building
footprints for specific styles (e.g. Blueprint) if visual testing shows they
improve the result.

### 12.4 Self-hosted Overpass

If traffic grows to the point that public Overpass rate limits become a real
constraint, self-hosting Overpass against a Geofabrik extract is the upgrade path.
The Scene contract's `load` method is the only thing that changes — same package,
same cache, same render path.

---

## 13. Implementation plan (next step)

This spec is the design. The next step is the **implementation plan** via the
`superpowers:writing-plans` skill: a phased, executable breakdown of the work
above, including:

1. Monorepo scaffolding (npm workspaces, package layout, tsconfig per package).
2. `@gunari/core` v1: Scene contract, geometry utilities, PNG export, composition
   scaffold.
3. `@gunari/scene-mapprint` v1: data layer (Overpass + cache), parsing, projection,
   interpretation, all 5 themes, all 3 shapes, all 4 markers, all 3 zooms, rotation,
   labels, layouts.
4. `apps/gunari-app` v1: `/map` route, customizer UI, live preview, PNG export
   wiring.
5. Testing: vitest setup, fixture capture, unit tests, golden-image harness.
6. Verification: golden-image acceptance, manual smoke tests against real Overpass,
   performance check on a low-end phone.