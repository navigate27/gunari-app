import type { OsmResponse } from "../interpret/parse";
import type { BBox } from "../interpret/types";
import { buildOverpassQuery } from "./query";

export const OVERPASS_ENDPOINTS = [
  "https://overpass.komoot.io/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
] as const;

const CLIENT_TIMEOUT_MS = 10_000;

export class OverpassError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = "OverpassError";
  }
}

/**
 * Fetch OSM data for a bbox. Tries each Overpass endpoint in order with a
 * 10 s client-side timeout. On 429 (rate limit) or 5xx, falls through to
 * the next endpoint. On all-fail, throws OverpassError.
 */
export async function fetchOsm(
  bbox: BBox,
  signal: AbortSignal,
  endpoints: readonly string[] = OVERPASS_ENDPOINTS
): Promise<OsmResponse> {
  const query = buildOverpassQuery(bbox);
  let lastError: unknown = null;

  for (const url of endpoints) {
    if (signal.aborted) throw new OverpassError("aborted");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    // Link the caller's signal to the per-request controller so either
    // abort source cancels the fetch.
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new OverpassError(`${url} returned ${res.status}`, res.status);
        continue;
      }
      if (!res.ok) {
        lastError = new OverpassError(`${url} returned ${res.status}`, res.status);
        continue;
      }
      const json = (await res.json()) as OsmResponse;
      return json;
    } catch (err) {
      if (signal.aborted) throw new OverpassError("aborted");
      lastError = err;
      continue;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }
  }

  throw new OverpassError(
    `all Overpass endpoints failed: ${lastError instanceof Error ? lastError.message : "unknown"}`
  );
}