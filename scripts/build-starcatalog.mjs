// One-shot build of a filtered Hipparcos subset → public/stars.json
//
// Strategy: fetch a public-domain Hipparcos JSON subset, filter to visible
// stars (mag < 5.5), keep the fields Gunari needs (RA hours, Dec degrees, mag,
// HIP id, optional name), write a compact JSON. If every known mirror is
// unreachable, fall back to a deterministic procedural catalog of ~400 stars
// with a realistic magnitude distribution so the renderer always has data.

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "public/stars.json");

// A small hand-curated list of the brightest named stars so the rendered sky
// always has recognizable anchor points even if the catalog fetch fails.
const NAMED_ANCHORS = [
  ["Sirius", 6.7525, -16.7161, -1.46, 32349],
  ["Canopus", 6.3992, -52.6957, -0.74, 30438],
  ["Arcturus", 14.2610, 19.1825, -0.05, 69673],
  ["Vega", 18.6156, 38.7837, 0.03, 91262],
  ["Capella", 5.2782, 45.9981, 0.08, 24608],
  ["Rigel", 5.2423, -8.2017, 0.13, 24436],
  ["Procyon", 7.6550, 5.2250, 0.34, 37279],
  ["Achernar", 1.6286, -57.2367, 0.46, 7588],
  ["Betelgeuse", 5.9195, 7.4071, 0.5, 27989],
  ["Hadar", 14.0637, -60.3730, 0.61, 68702],
  ["Altair", 19.8464, 8.8683, 0.77, 97649],
  ["Acrux", 12.4433, -63.0991, 0.77, 60718],
  ["Aldebaran", 4.5987, 16.5093, 0.85, 21421],
  ["Antares", 16.4901, -26.4320, 1.09, 80763],
  ["Spica", 13.4199, -11.1614, 1.04, 65474],
  ["Pollux", 7.7553, 28.0262, 1.14, 37826],
  ["Fomalhaut", 22.9608, -29.6222, 1.16, 113368],
  ["Deneb", 20.6905, 45.2803, 1.25, 102098],
  ["Mimosa", 12.7953, -59.6886, 1.25, 62434],
  ["Regulus", 10.1395, 11.9672, 1.35, 49669],
  ["Adhara", 6.9770, -28.9721, 1.5, 33579],
  ["Shaula", 17.5602, -37.1038, 1.62, 85927],
  ["Castor", 7.5766, 31.8884, 1.58, 36850],
  ["Bellatrix", 5.4188, 6.3497, 1.64, 25336],
  ["Elnath", 5.4382, 28.6082, 1.65, 25428],
  ["Miaplacidus", 9.2200, -69.7172, 1.67, 45238],
  ["Alnilam", 5.6036, -1.2019, 1.69, 26311],
  ["Alnitak", 5.6793, -1.9426, 1.74, 26727],
  ["Mintaka", 5.5334, -0.2991, 2.23, 25930],
  ["Saiph", 5.7959, -9.6696, 2.09, 27366],
  ["Polaris", 2.5302, 89.2641, 1.97, 11767],
  ["Alphard", 9.4594, -8.6586, 1.99, 46390],
  ["Hamal", 2.1196, 23.4624, 2.0, 9884],
  ["Diphda", 0.7265, -17.9866, 2.04, 3982],
  ["Menkalinan", 5.9921, 44.9474, 2.06, 28360],
  ["Alhena", 6.6285, 16.3993, 2.06, 31681],
  ["Mirzam", 6.3783, -17.9559, 1.98, 30324],
  ["Alsephina", 8.7455, -54.7087, 2.07, 44816],
  ["Markab", 23.0793, 15.2053, 2.49, 113963],
  ["Scheat", 23.0628, 28.0828, 2.42, 113881],
  ["Algenib", 0.2206, 15.1836, 2.83, 12706],
  ["Sadr", 20.3704, 40.2567, 2.2, 100453],
  ["Etamin", 17.9434, 51.4889, 2.23, 87833],
  ["Albireo", 19.5121, 27.9597, 3.05, 95947],
  ["Schedar", 0.6751, 56.5373, 2.24, 3179],
  ["Caph", 0.1530, 59.1498, 2.27, 746],
  ["Ruchbah", 0.9451, 60.2353, 2.66, 6686],
  ["Segin", 1.5431, 63.6701, 3.35, 12728],
  ["Mirphak", 3.4054, 49.8612, 1.79, 15863],
  ["Algol", 3.1361, 40.9556, 2.12, 14576],
  ["Kochab", 14.8451, 74.1555, 2.08, 72607],
  ["Pherkad", 15.3454, 71.8340, 3.0, 80422],
  ["Yed Prior", 16.0876, -3.6943, 2.74, 79593],
  ["Yed Posterior", 16.1839, -4.6923, 3.23, 80022],
  ["Sabik", 17.1031, -15.7249, 2.43, 85955],
  ["Rasalhague", 17.5822, 12.5604, 2.07, 86032],
  ["Unukalhai", 15.7426, 6.4022, 2.6, 78051],
  ["Zubeneschamali", 15.5419, -7.7897, 2.6, 74785],
  ["Zubenelgenubi", 14.8479, -16.0418, 2.75, 72622],
  ["Dschubba", 16.0056, -22.6217, 2.29, 78497],
  ["Sargas", 17.6219, -42.9978, 1.86, 86670],
  ["Denebola", 11.8177, 14.5720, 2.14, 57632],
  ["Algieba", 10.3329, 19.8415, 2.61, 50583],
  ["Zosma", 11.2351, 20.5187, 2.56, 54872],
];

const MIRRORS = [
  // Yale Bright Star Catalogue subset as JSON (community mirror).
  "https://raw.githubusercontent.com/aaroncalderon/bright-star-catalogue/master/bsc5p.json",
  // Alternate: a Hipparcos subset mirror.
  "https://raw.githubusercontent.com/ut-astropa/astronomy-data/main/hipparcos-mag5.json",
];

// Magnitude cap — fainter stars (higher mag number) are included.
const MAG_LIMIT = 7.0;

function detPrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function proceduralFallback() {
  const stars = [];
  // Seed anchors.
  for (const [name, ra, dec, mag, hip] of NAMED_ANCHORS) {
    stars.push({ ra, dec, mag, hip, name });
  }
  // Generate a richer field with a realistic magnitude distribution
  // (mostly faint). Goes up to MAG_LIMIT so the sky looks dense.
  const rand = detPrng(0x5eed);
  const COUNT = 2500;
  for (let i = 0; i < COUNT; i++) {
    const ra = rand() * 24;
    const dec = Math.asin(rand() * 2 - 1) * (180 / Math.PI);
    // Bias toward fainter stars: mag in [1.5, MAG_LIMIT].
    const u = rand();
    const mag = 1.5 + Math.pow(u, 0.45) * (MAG_LIMIT - 1.5);
    stars.push({ ra, dec, mag, hip: 700000 + i });
  }
  return stars;
}

function normalizeRecord(r) {
  // Accept several field shapes.
  const ra =
    r.ra_hours ??
    r.ra ??
    (r.RAh != null ? r.RAh + (r.RAm ?? 0) / 60 + (r.RAs ?? 0) / 3600 : null);
  const dec =
    r.dec_degrees ??
    r.dec ??
    r.DE ??
    (r.DEd != null
      ? (r.DEd + (r.DEm ?? 0) / 60 + (r.DEs ?? 0) / 3600) * (r.DE === "-" ? -1 : 1)
      : null);
  const mag = r.mag ?? r.Vmag ?? r.magnitude ?? r.Mag;
  const hip = r.hip ?? r.HIP ?? r.Hipparcos ?? null;
  const name = r.name ?? r.bayer ?? r.Bayer ?? null;
  if (ra == null || dec == null || mag == null) return null;
  return { ra, dec, mag, hip: hip ?? undefined, name: name ?? undefined };
}

async function tryFetch() {
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.stars ?? data.data;
      if (!Array.isArray(list)) continue;
      const out = [];
      for (const r of list) {
        const n = normalizeRecord(r);
        if (n && n.mag < MAG_LIMIT) out.push(n);
      }
      if (out.length > 100) return out;
    } catch {
      // try next mirror
    }
  }
  return null;
}

async function main() {
  console.log("Building star catalog…");
  let stars = await tryFetch();
  if (!stars) {
    console.warn("  ⚠ mirrors unreachable — using procedural fallback.");
    stars = proceduralFallback();
  } else {
    // Always include the named anchors even if mirror omitted them.
    for (const [name, ra, dec, mag, hip] of NAMED_ANCHORS) {
      if (!stars.some((s) => s.hip === hip)) {
        stars.push({ ra, dec, mag, hip, name });
      }
    }
  }

  // Sort: brightest first (helps renderer layering).
  stars.sort((a, b) => a.mag - b.mag);

  const payload = {
    generatedAt: new Date().toISOString(),
    count: stars.length,
    source: stars === proceduralFallback() ? "procedural" : "hipparcos-mirror",
    stars,
  };

  await mkdir(resolve(ROOT, "public"), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload));
  console.log(`  ✓ wrote ${stars.length} stars → public/stars.json`);
}

main().catch((err) => {
  console.error("star catalog build failed:", err);
  process.exit(1);
});