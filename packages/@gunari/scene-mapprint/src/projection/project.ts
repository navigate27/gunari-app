import type { MapGeometry } from "../interpret/types";
import type { SceneViewport } from "@gunari/core";
import { webMercator, normalizeToViewport, simplifyLine } from "@gunari/core";
import { makeFrame, place as placeOn, rotateAround } from "./frame";
import type { ProjectedMapGeometry, ProjectedRoad, ProjectedPolygon, ProjectedLabel } from "./types";

/**
 * Project a MapGeometry (raw lng/lat) to a ProjectedMapGeometry (canvas-
 * normalized [0, 1] coords), simplified, rotated around the viewport center.
 *
 * Stages: Web Mercator → normalize to bbox → simplify per line → place on the
 * canvas → rotate. The bbox lands on a square (same scale on both axes, so the
 * map is never stretched) centered on the slot and sized to still cover the
 * slot when rotated by any angle.
 */
export function projectGeometry(
  geom: MapGeometry,
  viewport: SceneViewport,
  rotation: number,
  tolerance: number
): ProjectedMapGeometry {
  const bbox = geom.bbox;
  const frame = makeFrame(viewport, rotation);
  const place = (p: [number, number]) => placeOn(frame, p);
  const rotate = (pts: [number, number][]) => rotateAround(frame, pts, rotation);

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
    return { class: r.class, points: simplified.map(place), name: r.name };
  });

  const water: ProjectedPolygon[] = geom.water.map((p) => ({
    points: simplifyLine(projectLine(p.points), tolerance).map(place),
    holes: p.holes?.map((h) => simplifyLine(projectLine(h), tolerance).map(place)),
    name: p.name,
  }));

  const waterways: [number, number][][] = geom.waterways.map((w) =>
    simplifyLine(projectLine(w), tolerance).map(place)
  );

  const polys = (list: MapGeometry["parks"] | undefined): ProjectedPolygon[] =>
    (list ?? []).map((p) => ({
      points: simplifyLine(projectLine(p.points), tolerance).map(place),
      holes: p.holes?.map((h) => simplifyLine(projectLine(h), tolerance).map(place)),
      name: p.name,
    }));
  const built = polys(geom.built);
  const green = polys(geom.green);

  const parks: ProjectedPolygon[] = geom.parks.map((p) => ({
    points: simplifyLine(projectLine(p.points), tolerance).map(place),
    holes: p.holes?.map((h) => simplifyLine(projectLine(h), tolerance).map(place)),
    name: p.name,
  }));

  // Labels: road labels go at the road's midpoint; place labels at the place
  // node's own position (the parser keeps its lng/lat in x/y). A label with no
  // position (0, 0) falls back to the bbox centre.
  const labels: ProjectedLabel[] = geom.labels.map((l) => {
    if (l.class === "place") {
      const known = l.x !== 0 || l.y !== 0;
      const [cx, cy] = place(
        projectPoint(known ? l.x : (bbox[0] + bbox[2]) / 2, known ? l.y : (bbox[1] + bbox[3]) / 2)
      );
      return { text: l.text, x: cx, y: cy, class: "place" };
    }
    // Road label: find the road with this name, take its midpoint.
    const road = geom.roads.find((r) => r.name === l.text);
    if (road && road.points.length > 0) {
      const mid = road.points[Math.floor(road.points.length / 2)];
      const [x, y] = place(projectPoint(mid[0], mid[1]));
      return { text: l.text, x, y, class: "road" };
    }
    return { ...l };
  });

  // Named places: lng/lat to canvas, then the same rotation as everything else.
  const pois = (geom.pois ?? []).map((p) => {
    const [x, y] = place(projectPoint(p.x, p.y));
    return { ...p, x, y };
  });

  // Rotation: rotate every projected point around the viewport center.
  if (rotation !== 0) {
    for (const r of roads) r.points = rotate(r.points);
    for (const w of water) {
      w.points = rotate(w.points);
      if (w.holes) w.holes = w.holes.map(rotate);
    }
    for (let i = 0; i < waterways.length; i++) waterways[i] = rotate(waterways[i]);
    for (const p of [...parks, ...built, ...green]) {
      p.points = rotate(p.points);
      if (p.holes) p.holes = p.holes.map(rotate);
    }
    for (const l of labels) {
      [l.x, l.y] = rotate([[l.x, l.y]])[0];
    }
    for (const p of pois) {
      [p.x, p.y] = rotate([[p.x, p.y]])[0];
    }
  }

  // Drop lines that lie entirely outside the canvas (plus overscan). Whole
  // lines only: removing single points would cut a road that merely leaves the
  // canvas and comes back, or one whose few points are all far off-screen but
  // whose segments still cross the slot.
  function visible(pts: [number, number][]): boolean {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return maxX >= -0.1 && minX <= 1.1 && maxY >= -0.1 && minY <= 1.1;
  }

  const visibleRoads = roads.filter((r) => visible(r.points));
  const visibleWaterways = waterways.filter(visible);

  return {
    roads: visibleRoads,
    water,
    waterways: visibleWaterways,
    parks,
    built,
    green,
    labels,
    pois,
    bbox,
    rotation,
    zoomScale: viewport.zoomScale ?? 1,
  };
}