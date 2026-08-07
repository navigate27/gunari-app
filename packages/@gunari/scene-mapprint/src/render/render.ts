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
    ctx.fillStyle = palette.labelColor;
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