import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IndexedDBCacheStorage } from "../src/data/indexed-db-storage";
import type { MapGeometry } from "../src/interpret/types";

function emptyGeom(bbox: [number, number, number, number]): MapGeometry {
  return { bbox, roads: [], water: [], waterways: [], parks: [], labels: [] };
}

/**
 * Minimal in-memory IDB mock — just enough to exercise the adapter's
 * open/get/set/delete/keys code paths. Fires callbacks via queueMicrotask
 * to mimic IDB's async semantics.
 */
function installMockIndexedDB() {
  const store = new Map<string, MapGeometry>();
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({}),
    transaction: () => {
      const tx: {
        objectStore: () => unknown;
        oncomplete: null | (() => void);
        onerror: null | (() => void);
        error: null;
      } = {
        objectStore: () => ({
          get: (key: string) => {
            const req = {
              onsuccess: null as null | (() => void),
              onerror: null as null | (() => void),
              result: store.get(key),
            };
            queueMicrotask(() => req.onsuccess?.());
            return req;
          },
          put: (value: MapGeometry, key: string) => {
            store.set(key, value);
            const req = {
              onsuccess: null as null | (() => void),
              onerror: null as null | (() => void),
            };
            queueMicrotask(() => req.onsuccess?.());
            return req;
          },
          delete: (key: string) => {
            store.delete(key);
            const req = {
              onsuccess: null as null | (() => void),
              onerror: null as null | (() => void),
            };
            queueMicrotask(() => req.onsuccess?.());
            return req;
          },
          getAllKeys: () => {
            const req = {
              onsuccess: null as null | (() => void),
              onerror: null as null | (() => void),
              result: Array.from(store.keys()),
            };
            queueMicrotask(() => req.onsuccess?.());
            return req;
          },
        }),
        oncomplete: null,
        onerror: null,
        error: null,
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };
  const idb = {
    open: () => {
      const req = {
        onupgradeneeded: null as null | (() => void),
        onsuccess: null as null | (() => void),
        onerror: null as null | (() => void),
        result: db,
        error: null,
      };
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
  vi.stubGlobal("indexedDB", idb);
  return store;
}

describe("IndexedDBCacheStorage", () => {
  beforeEach(() => {
    installMockIndexedDB();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips a value through set/get", async () => {
    const storage = new IndexedDBCacheStorage();
    const geom = emptyGeom([0, 0, 1, 1]);
    await storage.set("k", geom);
    const out = await storage.get("k");
    expect(out).toEqual(geom);
  });

  it("returns null for a missing key", async () => {
    const storage = new IndexedDBCacheStorage();
    const out = await storage.get("does-not-exist");
    expect(out).toBeNull();
  });

  it("deletes a value", async () => {
    const storage = new IndexedDBCacheStorage();
    await storage.set("k", emptyGeom([0, 0, 1, 1]));
    await storage.delete("k");
    expect(await storage.get("k")).toBeNull();
  });

  it("lists stored keys", async () => {
    const storage = new IndexedDBCacheStorage();
    await storage.set("a", emptyGeom([0, 0, 1, 1]));
    await storage.set("b", emptyGeom([1, 1, 2, 2]));
    const keys = await storage.keys();
    expect(keys.sort()).toEqual(["a", "b"]);
  });
});