// One-shot dev-time script: hits real Overpass and saves fixtures.
// Run manually: `node packages/@gunari/scene-mapprint/scripts/capture-fixture.mjs`
// Not run in CI. Captured fixtures are committed to the repo.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setDefaultAutoSelectFamily } from "node:net";

// Work around Node 22 undici autoSelectFamily bug that breaks connections
// to some Overpass instances on networks without IPv6 routing.
setDefaultAutoSelectFamily(false);

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "../__fixtures__");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
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
out geom;`;
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
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "gunari-fixture-capture/1.0 (dev)" },
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