"use client";

import type { StarRecord } from "../types";

export interface CatalogPayload {
  generatedAt: string;
  count: number;
  source: string;
  stars: StarRecord[];
}

export interface MilkyWayLevel {
  level: number;
  polygons: number[][][];
}
export interface MilkyWayPayload {
  generatedAt: string;
  source: string;
  levels: MilkyWayLevel[];
}

let cache: CatalogPayload | null = null;
let inflight: Promise<CatalogPayload> | null = null;

export async function loadStarCatalog(): Promise<CatalogPayload> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = fetch("/stars.json", { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`stars.json: ${r.status}`);
      return r.json() as Promise<CatalogPayload>;
    })
    .then((data) => {
      cache = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

let mwCache: MilkyWayPayload | null = null;
let mwInflight: Promise<MilkyWayPayload> | null = null;

export async function loadMilkyWay(): Promise<MilkyWayPayload> {
  if (mwCache) return mwCache;
  if (mwInflight) return mwInflight;

  mwInflight = fetch("/milkyway.json", { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`milkyway.json: ${r.status}`);
      return r.json() as Promise<MilkyWayPayload>;
    })
    .then((data) => {
      mwCache = data;
      return data;
    })
    .finally(() => {
      mwInflight = null;
    });

  return mwInflight;
}

/**
 * A tiny hard-coded fallback catalog embedded in the bundle. Used only if
 * /stars.json is unavailable at runtime so the preview never goes blank.
 */
export const FALLBACK_CATALOG: StarRecord[] = [
  { name: "Sirius", ra: 6.7525, dec: -16.7161, mag: -1.46, hip: 32349 },
  { name: "Canopus", ra: 6.3992, dec: -52.6957, mag: -0.74, hip: 30438 },
  { name: "Arcturus", ra: 14.261, dec: 19.1825, mag: -0.05, hip: 69673 },
  { name: "Vega", ra: 18.6156, dec: 38.7837, mag: 0.03, hip: 91262 },
  { name: "Capella", ra: 5.2782, dec: 45.9981, mag: 0.08, hip: 24608 },
  { name: "Rigel", ra: 5.2423, dec: -8.2017, mag: 0.13, hip: 24436 },
  { name: "Procyon", ra: 6.5753, dec: -16.7161, mag: 0.34, hip: 37279 },
  { name: "Betelgeuse", ra: 5.9195, dec: 7.4071, mag: 0.5, hip: 27989 },
  { name: "Altair", ra: 19.8464, dec: 8.8683, mag: 0.77, hip: 97649 },
  { name: "Aldebaran", ra: 4.5987, dec: 16.5093, mag: 0.85, hip: 21421 },
  { name: "Antares", ra: 16.4901, dec: -26.432, mag: 1.09, hip: 80763 },
  { name: "Spica", ra: 13.4199, dec: -11.1614, mag: 1.04, hip: 65474 },
  { name: "Pollux", ra: 7.7553, dec: 28.0262, mag: 1.14, hip: 37826 },
  { name: "Fomalhaut", ra: 22.9608, dec: -29.6222, mag: 1.16, hip: 113368 },
  { name: "Deneb", ra: 20.6905, dec: 45.2803, mag: 1.25, hip: 102098 },
  { name: "Regulus", ra: 10.1395, dec: 11.9672, mag: 1.35, hip: 49669 },
  { name: "Polaris", ra: 2.5302, dec: 89.2641, mag: 1.97, hip: 11767 },
  { name: "Castor", ra: 7.5766, dec: 31.8884, mag: 1.58, hip: 36850 },
  { name: "Bellatrix", ra: 5.4188, dec: 6.3497, mag: 1.64, hip: 25336 },
  { name: "Mintaka", ra: 5.5334, dec: -0.2991, mag: 2.23, hip: 25930 },
  { name: "Alnilam", ra: 5.6036, dec: -1.2019, mag: 1.69, hip: 26311 },
  { name: "Alnitak", ra: 5.6793, dec: -1.9426, mag: 1.74, hip: 26727 },
  { name: "Saiph", ra: 5.7959, dec: -9.6696, mag: 2.09, hip: 27366 },
];