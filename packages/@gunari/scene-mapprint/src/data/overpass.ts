import type { OsmResponse } from "../interpret/parse";
import type { BBox } from "../interpret/types";
import { buildOverpassQuery, type QueryOptions } from "./query";

export const OVERPASS_ENDPOINTS = [
  "https://overpass.komoot.io/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
] as const;

const CLIENT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1500;

export class OverpassError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message);
    this.name = "OverpassError";
  }
}

/**
 * Fetch OSM data for a bbox. Races every Overpass endpoint in parallel with
 * a 10 s client-side timeout each; the first success wins and the others are
 * aborted. On 429 (rate limit) or 5xx, that endpoint's attempt rejects so
 * Promise.any falls through to the next winner. On all-fail, throws
 * OverpassError.
 */
export async function fetchOsm(
  bbox: BBox,
  signal: AbortSignal,
  endpoints: readonly string[] = OVERPASS_ENDPOINTS,
  queryOptions: QueryOptions = {}
): Promise<OsmResponse> {
  try {
    return await fetchOnce(bbox, signal, endpoints, queryOptions);
  } catch (err) {
    if (signal.aborted) throw err;
    // Mirrors rate-limit bursts of requests; one pause usually clears it.
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetchOnce(bbox, signal, endpoints, queryOptions);
  }
}

async function fetchOnce(
  bbox: BBox,
  signal: AbortSignal,
  endpoints: readonly string[] = OVERPASS_ENDPOINTS,
  queryOptions: QueryOptions = {}
): Promise<OsmResponse> {
  if (signal.aborted) throw new OverpassError("aborted");
  if (endpoints.length === 0) {
    throw new OverpassError("all Overpass endpoints failed: no endpoints provided");
  }
  const query = buildOverpassQuery(bbox, queryOptions);

  const controllers = endpoints.map(() => new AbortController());
  const onAbort = () => {
    for (const c of controllers) c.abort();
  };
  signal.addEventListener("abort", onAbort, { once: true });

  const attempts = endpoints.map(async (url, i) => {
    const controller = controllers[i];
    const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        throw new OverpassError(`${url} returned ${res.status}`, res.status);
      }
      if (!res.ok) {
        throw new OverpassError(`${url} returned ${res.status}`, res.status);
      }
      const body = (await res.json()) as OsmResponse & { remark?: string };
      // Overpass answers 200 with a remark when it ran out of time or memory,
      // and the elements it did return are partial or empty.
      if (body.remark && /runtime error|timed out|out of memory/i.test(body.remark)) {
        throw new OverpassError(`${url} gave up: ${body.remark}`);
      }
      return body;
    } finally {
      clearTimeout(timeout);
    }
  });

  try {
    const winner = await Promise.any(attempts);
    // Abort the losing fetches to free their network resources.
    for (const c of controllers) {
      if (!c.signal.aborted) c.abort();
    }
    return winner;
  } catch (err) {
    if (signal.aborted) throw new OverpassError("aborted");
    const messages =
      err instanceof AggregateError
        ? err.errors.map((e) => (e instanceof Error ? e.message : String(e))).join("; ")
        : String(err);
    throw new OverpassError(`all Overpass endpoints failed: ${messages}`);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}