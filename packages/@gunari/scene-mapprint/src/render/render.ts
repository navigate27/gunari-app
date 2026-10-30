import type { SceneInput, SceneViewport } from "@gunari/core";
import type { ProjectedMapGeometry, ProjectedPolygon, ProjectedRoad } from "../projection/types";
import { poiColors, type MapThemePalette } from "../styles/themes";
import { SHAPES } from "../shapes/shapes";
import { MARKERS } from "../markers/markers";
import type { RoadClass } from "../interpret/types";
import { projectLatLng } from "../projection/frame";

const ROAD_DRAW_ORDER: RoadClass[] = [
  "path", "residential", "tertiary", "secondary", "primary", "trunk", "motorway",
];

/** When each road class starts tracing during the reveal, major roads first. */
const REVEAL_CLASS_START: Record<RoadClass, number> = {
  motorway: 0,
  trunk: 0.04,
  primary: 0.08,
  secondary: 0.14,
  tertiary: 0.2,
  residential: 0.26,
  path: 0.32,
};
const REVEAL_STAGGER = 0.38;
const REVEAL_ROAD_SPAN = 0.3;

const POI_NAME_MAX = 24;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function collides(boxes: Box[], b: Box): boolean {
  return boxes.some((p) => Math.abs(p.x - b.x) < (p.w + b.w) / 2 && Math.abs(p.y - b.y) < (p.h + b.h) / 2);
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function smooth(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

type Pt = [number, number];

/** Road indices per class, nearest the slot centre first, so roads trace outward. */
const orderCache = new WeakMap<ProjectedRoad[], Map<RoadClass, ProjectedRoad[]>>();

function roadsByClass(roads: ProjectedRoad[], cx: number, cy: number): Map<RoadClass, ProjectedRoad[]> {
  const hit = orderCache.get(roads);
  if (hit) return hit;
  const groups = new Map<RoadClass, ProjectedRoad[]>();
  for (const road of roads) {
    const list = groups.get(road.class);
    if (list) list.push(road);
    else groups.set(road.class, [road]);
  }
  const dist = (r: ProjectedRoad) => {
    const p = r.points[Math.floor(r.points.length / 2)];
    return p ? Math.hypot(p[0] - cx, p[1] - cy) : 0;
  };
  for (const list of groups.values()) list.sort((a, b) => dist(a) - dist(b));
  orderCache.set(roads, groups);
  return groups;
}

/**
 * Render a ProjectedMapGeometry + MapThemePalette to a canvas. Pure:
 * same geometry + palette + input + viewport = same pixels.
 *
 * `canvasW` and `canvasH` are the actual pixel size of the scene slot
 * (typically 1080×1920 or the slot's pixel rect). Coordinates are
 * canvas-normalized [0,1] and scaled to these dimensions here.
 *
 * `viewport.reveal` (0..1) plays the drawing animation: land fades in, roads
 * trace outward from the centre by class, and the pin drops in last.
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
  const reveal = clamp01(viewport.reveal ?? 1);
  const animating = reveal < 1;
  // Strokes thicken a little as the map is zoomed in, and thin when zoomed out.
  const strokeScale = Math.min(2.2, Math.max(0.85, Math.sqrt(geom.zoomScale ?? 1)));

  function toPx(p: Pt): Pt {
    return [p[0] * canvasW, p[1] * canvasH];
  }

  function tracePolygon(poly: ProjectedPolygon): boolean {
    const pts = poly.points.map(toPx);
    if (pts.length === 0) return false;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    return true;
  }

  function fillPolygons(polys: ProjectedPolygon[] | undefined, color: string | undefined): void {
    if (!polys || !color) return;
    ctx.fillStyle = color;
    for (const poly of polys) {
      if (!tracePolygon(poly)) continue;
      ctx.fill();
    }
  }

  /** Stroke the first `fraction` of a polyline. */
  function strokePartial(pts: Pt[], fraction: number): void {
    if (pts.length < 2 || fraction <= 0) return;
    const segs = pts.length - 1;
    const upTo = fraction >= 1 ? segs : fraction * segs;
    const whole = Math.floor(upTo);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= whole; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (whole < segs) {
      const f = upTo - whole;
      const a = pts[whole];
      const b = pts[whole + 1];
      ctx.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
    }
    ctx.stroke();
  }

  ctx.save();
  // Shape mask
  SHAPES[input.shape].apply(ctx, cx, cy, r);
  // The map has its own background, separate from the card behind it. The
  // gradient spans the whole canvas, so when the card uses the same colours
  // the two are seamless.
  const ground = ctx.createLinearGradient(0, 0, 0, canvasH);
  ground.addColorStop(0, palette.background.top);
  ground.addColorStop(1, palette.background.bottom);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, canvasW, canvasH);
  // Pan moves the map under the fixed mask.
  ctx.translate((viewport.panX ?? 0) * canvasW, (viewport.panY ?? 0) * canvasH);

  // 0. Land: built-up and green areas fade in first.
  ctx.globalAlpha = animating ? smooth(reveal / 0.35) : 1;
  fillPolygons(geom.built, palette.built);
  fillPolygons(geom.green, palette.green);

  // 1. Water polygons (fill)
  for (const w of geom.water) {
    if (!tracePolygon(w)) continue;
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
  fillPolygons(geom.parks, palette.park);
  ctx.globalAlpha = 1;

  // 3. Waterways (stroke), tracing in during the first half of the reveal
  ctx.strokeStyle = palette.waterway;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = (palette.waterwayWidth ?? 2) * strokeScale;
  const waterProgress = animating ? smooth((reveal - 0.02) / 0.45) : 1;
  for (const w of geom.waterways) {
    const pts = w.map(toPx);
    if (pts.length < 2) continue;
    strokePartial(pts, waterProgress);
  }

  // 4. Roads (stroke by class, in ROAD_DRAW_ORDER so motorway draws on top)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const grouped = animating ? roadsByClass(geom.roads, viewport.cx, viewport.cy) : null;
  for (const cls of ROAD_DRAW_ORDER) {
    const style = palette.road[cls];
    const casing = palette.casing?.[cls];
    const list = grouped ? (grouped.get(cls) ?? []) : geom.roads.filter((road) => road.class === cls);
    if (list.length === 0) continue;

    const strokeAll = (color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      list.forEach((road, i) => {
        const pts = road.points.map(toPx);
        if (pts.length < 2) return;
        if (!animating) {
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
          ctx.stroke();
          return;
        }
        const start = REVEAL_CLASS_START[cls] + (i / list.length) * REVEAL_STAGGER;
        strokePartial(pts, smooth((reveal - start) / REVEAL_ROAD_SPAN));
      });
    };

    if (casing) strokeAll(casing.color, (style.width + casing.extra) * strokeScale);
    strokeAll(style.color, style.width * strokeScale);
  }

  // 5. Named places (shops, food, landmarks...), then road and area names.
  // They share one list so nothing is drawn on top of anything else.
  const placed: Box[] = [];
  const wanted = input.places ?? [];
  if (wanted.length > 0 && geom.pois && geom.pois.length > 0) {
    const size = Math.max(10, Math.min(canvasW, canvasH) * 0.016);
    const dotR = size * 0.34;
    const colors = poiColors(palette);
    const panX = (viewport.panX ?? 0) * canvasW;
    const panY = (viewport.panY ?? 0) * canvasH;
    ctx.globalAlpha = animating ? smooth((reveal - 0.8) / 0.2) : 1;
    ctx.font = `500 ${size}px "Geist", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const poi of geom.pois) {
      if (!wanted.includes(poi.category)) continue;
      const x = poi.x * canvasW;
      const y = poi.y * canvasH;
      // Skip places well outside the map shape.
      if (Math.hypot(x + panX - cx, y + panY - cy) > r * 1.05) continue;
      const dot: Box = { x, y, w: dotR * 2 + 2, h: dotR * 2 + 2 };
      if (collides(placed, dot)) continue;
      placed.push(dot);
      ctx.fillStyle = colors[poi.category];
      ctx.strokeStyle = palette.background.top;
      ctx.lineWidth = Math.max(1.5, dotR * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();

      const name = poi.name.length > POI_NAME_MAX ? `${poi.name.slice(0, POI_NAME_MAX - 1)}…` : poi.name;
      const w = name.length * size * 0.52;
      const text: Box = { x: x + dotR + 4 + w / 2, y, w, h: size * 1.2 };
      if (collides(placed, text)) continue;
      placed.push(text);
      ctx.strokeStyle = palette.background.top;
      ctx.lineWidth = size * 0.35;
      ctx.strokeText(name, x + dotR + 4, y);
      ctx.fillStyle = palette.labelColor;
      ctx.fillText(name, x + dotR + 4, y);
    }
    ctx.globalAlpha = 1;
  }

  // Road and area names (when input.labels)
  if (input.labels) {
    ctx.globalAlpha = animating ? smooth((reveal - 0.85) / 0.15) : 1;
    ctx.fillStyle = palette.labelColor;
    const size = Math.max(10, Math.min(canvasW, canvasH) * 0.018);
    ctx.font = `400 ${size}px "Geist", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Draw each label only if it doesn't collide with one already placed.
    for (const l of geom.labels) {
      if (l.x === 0 && l.y === 0) continue;
      const x = l.x * canvasW;
      const y = l.y * canvasH;
      const w = l.text.length * size * 0.55;
      const h = size * 1.2;
      const box: Box = { x, y, w, h };
      if (collides(placed, box)) continue;
      placed.push(box);
      ctx.fillText(l.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // 6. Marker (drawn on top, NOT clipped to the shape — it sits on the artwork).
  // The pin's tip sits on its location: the dragged-to pin if there is one,
  // otherwise the centre of the slot.
  const markerR = Math.min(canvasW, canvasH) * 0.04;
  const [px, py] = input.pin
    ? projectLatLng(geom.bbox, { ...viewport, zoomScale: geom.zoomScale }, geom.rotation, input.pin.lat, input.pin.lng)
    : [viewport.cx, viewport.cy];
  const dropIn = animating ? clamp01((reveal - 0.82) / 0.18) : 1;
  MARKERS[input.marker].draw(ctx, px * canvasW, py * canvasH, markerR, palette, dropIn);
}
