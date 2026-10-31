import { fetchOsm, type BBox, type OsmResponse } from "@gunari/scene-mapprint";

const MAX_SPAN_DEG = 0.7;
const GRID = 1000;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;

export interface OsmRequest {
  bbox: BBox;
  pois: boolean;
}

export function parseOsmRequest(params: URLSearchParams): OsmRequest | null {
  const parts = (params.get("bbox") ?? "").split(",").map(Number);
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (maxLat <= minLat || maxLng <= minLng) return null;
  if (maxLat - minLat > MAX_SPAN_DEG || maxLng - minLng > MAX_SPAN_DEG) return null;
  // Snap outward to a ~100 m grid so near-identical views share one cache entry.
  const bbox: BBox = [
    Math.floor(minLng * GRID) / GRID,
    Math.floor(minLat * GRID) / GRID,
    Math.ceil(maxLng * GRID) / GRID,
    Math.ceil(maxLat * GRID) / GRID,
  ];
  return { bbox, pois: params.get("pois") === "1" };
}

const entries = new Map<string, { at: number; data: OsmResponse }>();
const inflight = new Map<string, Promise<OsmResponse>>();

export function resetOsmProxyCache(): void {
  entries.clear();
  inflight.clear();
}

export async function fetchOsmCached({ bbox, pois }: OsmRequest): Promise<OsmResponse> {
  const key = `${bbox.join(",")}|${pois ? 1 : 0}`;
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = fetchOsm(bbox, new AbortController().signal, undefined, { pois })
    .then((data) => {
      entries.set(key, { at: Date.now(), data });
      if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}
