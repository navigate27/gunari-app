// One-shot build of the Milky Way isophote polygons → public/milkyway.json
//
// Source: dieghernan/celestial_data (mw.min.geojson), derived from the
// Milky Way Outline Catalog by Jose R. Vieira — the same data Stellarium
// uses for its Milky Way rendering. CC0 / public domain (Zenodo DOI:
// 10.5281/zenodo.7561601).
//
// The GeoJSON has 5 brightness levels (ol1 = faintest outer, ol5 = brightest
// core) as MultiPolygon features in [lon, lat] degrees (J2000 equatorial).
// We convert lon → RA hours (lon / 15) and keep lat as Dec degrees, then
// write a compact array indexed by level for the renderer to project.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public/milkyway.json");

const SOURCES = [
  "https://raw.githubusercontent.com/dieghernan/celestial_data/main/data/mw.min.geojson",
  "https://cdn.jsdelivr.net/gh/dieghernan/celestial_data@main/data/mw.min.geojson",
];

async function tryFetch() {
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      return await res.json();
    } catch {
      // try next
    }
  }
  return null;
}

async function main() {
  console.log("Building Milky Way polygons…");
  const geo = await tryFetch();
  if (!geo) {
    console.error("  ✗ could not fetch Milky Way GeoJSON from any mirror");
    process.exit(1);
  }

  // Parse features into 5 levels. Each feature is a MultiPolygon:
  // coordinates = [polygon][ring][point][lon, lat]
  // We flatten to [polygon][point] (outer ring only) and convert units.
  const levels = [];
  for (const feat of geo.features) {
    const id = feat.properties?.id ?? "";
    const match = /^ol(\d)$/.exec(id);
    const level = match ? Number(match[1]) : 0;
    if (!level) continue;
    const polys = [];
    for (const polygon of feat.geometry.coordinates) {
      // Outer ring is polygon[0]; ignore holes (polygon[1+]) for simplicity.
      const ring = polygon[0];
      if (!Array.isArray(ring) || ring.length < 3) continue;
      const pts = [];
      for (const [lon, lat] of ring) {
        pts.push([+(lon / 15).toFixed(6), +lat.toFixed(6)]);
      }
      polys.push(pts);
    }
    levels.push({ level, polygons: polys });
  }

  levels.sort((a, b) => a.level - b.level);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "celestial_data (mw.min.geojson)",
    levels,
  };

  await mkdir(resolve(ROOT, "public"), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload));
  const total = levels.reduce((n, l) => n + l.polygons.length, 0);
  console.log(`  ✓ wrote ${levels.length} levels, ${total} polygons → public/milkyway.json`);
}

main().catch((err) => {
  console.error("milky way build failed:", err);
  process.exit(1);
});