import type { OsmResponse } from "../interpret/parse";
import type { BBox } from "../interpret/types";
import { fetchOsm, OverpassError } from "./overpass";
import type { QueryOptions } from "./query";

export const OSM_PROXY_PATH = "/api/osm";

/**
 * Ask the app's own cached proxy first, so repeat views never reach the shared
 * Overpass servers; fall back to Overpass directly if the proxy is unavailable.
 */
export async function loadOsm(
  bbox: BBox,
  signal: AbortSignal,
  options: QueryOptions = {},
  proxyPath: string = OSM_PROXY_PATH
): Promise<OsmResponse> {
  if (signal.aborted) throw new OverpassError("aborted");
  try {
    const params = new URLSearchParams({ bbox: bbox.join(",") });
    if (options.pois) params.set("pois", "1");
    const res = await fetch(`${proxyPath}?${params}`, { signal });
    if (res.ok) return (await res.json()) as OsmResponse;
  } catch {
    if (signal.aborted) throw new OverpassError("aborted");
  }
  return fetchOsm(bbox, signal, undefined, options);
}
