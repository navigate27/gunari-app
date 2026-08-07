import { describe, it, expect, vi } from "vitest";
import { hashCacheKey, MapDataCache } from "../src/data/cache";
import type { BBox, MapGeometry } from "../src/interpret/types";

function emptyGeom(bbox: BBox): MapGeometry {
  return { bbox, roads: [], water: [], waterways: [], parks: [], labels: [] };
}

describe("hashCacheKey", () => {
  it("returns the same key for the same bbox", () => {
    const a: BBox = [120.95, 14.58, 121.02, 14.63];
    const b: BBox = [120.95, 14.58, 121.02, 14.63];
    expect(hashCacheKey(a)).toBe(hashCacheKey(b));
  });
  it("returns different keys for different bboxes", () => {
    const a: BBox = [120.95, 14.58, 121.02, 14.63];
    const b: BBox = [120.96, 14.58, 121.02, 14.63];
    expect(hashCacheKey(a)).not.toBe(hashCacheKey(b));
  });
});

describe("MapDataCache in-memory LRU", () => {
  it("returns undefined on miss", () => {
    const cache = new MapDataCache();
    expect(cache.get([0, 0, 1, 1])).toBeUndefined();
  });

  it("returns the stored value on hit", () => {
    const cache = new MapDataCache();
    const bbox: BBox = [0, 0, 1, 1];
    const geom = emptyGeom(bbox);
    cache.set(bbox, geom);
    expect(cache.get(bbox)).toBe(geom);
  });

  it("evicts the oldest entry when the bound is exceeded", () => {
    const cache = new MapDataCache({ memoryBound: 3 });
    const bboxes: BBox[] = [[0, 0, 1, 1], [1, 1, 2, 2], [2, 2, 3, 3], [3, 3, 4, 4]];
    for (const b of bboxes) cache.set(b, emptyGeom(b));
    // First entry should have been evicted.
    expect(cache.get(bboxes[0])).toBeUndefined();
    expect(cache.get(bboxes[3])).toBeDefined();
  });

  it("promotes an entry to most-recently-used on get", () => {
    const cache = new MapDataCache({ memoryBound: 2 });
    const a: BBox = [0, 0, 1, 1];
    const b: BBox = [1, 1, 2, 2];
    const c: BBox = [2, 2, 3, 3];
    cache.set(a, emptyGeom(a));
    cache.set(b, emptyGeom(b));
    // Touch a — it becomes most-recently-used.
    cache.get(a);
    // Insert c — b (least recently used) should evict, not a.
    cache.set(c, emptyGeom(c));
    expect(cache.get(a)).toBeDefined();
    expect(cache.get(b)).toBeUndefined();
  });
});

describe("MapDataCache persistent layer", () => {
  function mockStorage() {
    const store = new Map<string, MapGeometry>();
    return {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: MapGeometry) => { store.set(key, value); }),
      delete: vi.fn(async (key: string) => { store.delete(key); }),
      keys: vi.fn(async () => Array.from(store.keys())),
    };
  }

  it("falls back to the persistent layer on memory miss", async () => {
    const storage = mockStorage();
    const cache = new MapDataCache({ storage });
    const bbox: BBox = [0, 0, 1, 1];
    const geom = emptyGeom(bbox);
    await storage.set(hashCacheKey(bbox), geom);
    const out = await cache.getWithPersistence(bbox);
    expect(storage.get).toHaveBeenCalledWith(hashCacheKey(bbox));
    expect(out).toEqual(geom);
  });

  it("writes through to the persistent layer on set", async () => {
    const storage = mockStorage();
    const cache = new MapDataCache({ storage });
    const bbox: BBox = [0, 0, 1, 1];
    await cache.setWithPersistence(bbox, emptyGeom(bbox));
    expect(storage.set).toHaveBeenCalled();
  });
});