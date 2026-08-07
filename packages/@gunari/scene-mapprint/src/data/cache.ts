import type { BBox, MapGeometry } from "../interpret/types";

/**
 * Stable string hash of a bbox. Used as the cache key for both the
 * in-memory LRU and the persistent storage layer.
 */
export function hashCacheKey(bbox: BBox): string {
  return bbox.map((n) => n.toFixed(6)).join(",");
}

export interface CacheStorage {
  get(key: string): Promise<MapGeometry | null>;
  set(key: string, value: MapGeometry): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export interface MapDataCacheOptions {
  memoryBound?: number;
  storage?: CacheStorage;
  persistentBound?: number;
}

/**
 * Two-layer cache: an in-memory LRU (default 20 viewports) plus an optional
 * persistent storage layer (default 50 viewports). The persistent layer is
 * IndexedDB in the browser; tests inject a mock.
 */
export class MapDataCache {
  private memory = new Map<string, MapGeometry>();
  private readonly memoryBound: number;
  private readonly storage?: CacheStorage;
  private readonly persistentBound: number;

  constructor(opts: MapDataCacheOptions = {}) {
    this.memoryBound = opts.memoryBound ?? 20;
    this.storage = opts.storage;
    this.persistentBound = opts.persistentBound ?? 50;
  }

  /** Synchronous memory-layer lookup. Returns undefined on miss. */
  get(bbox: BBox): MapGeometry | undefined {
    const key = hashCacheKey(bbox);
    const val = this.memory.get(key);
    if (val !== undefined) {
      // LRU: delete + re-insert to mark most-recently-used.
      this.memory.delete(key);
      this.memory.set(key, val);
    }
    return val;
  }

  /** Memory-layer set. Does NOT write through to the persistent layer. */
  set(bbox: BBox, data: MapGeometry): void {
    const key = hashCacheKey(bbox);
    if (this.memory.has(key)) this.memory.delete(key);
    this.memory.set(key, data);
    while (this.memory.size > this.memoryBound) {
      const oldestKey = this.memory.keys().next().value;
      if (oldestKey === undefined) break;
      this.memory.delete(oldestKey);
    }
  }

  /** Async lookup that falls back to the persistent layer on memory miss. */
  async getWithPersistence(bbox: BBox): Promise<MapGeometry | undefined> {
    const memHit = this.get(bbox);
    if (memHit !== undefined) return memHit;
    if (!this.storage) return undefined;
    const key = hashCacheKey(bbox);
    const stored = await this.storage.get(key);
    if (stored) {
      // Promote to the memory layer.
      this.set(bbox, stored);
      return stored;
    }
    return undefined;
  }

  /** Async set that writes through to the persistent layer. */
  async setWithPersistence(bbox: BBox, data: MapGeometry): Promise<void> {
    this.set(bbox, data);
    if (!this.storage) return;
    const key = hashCacheKey(bbox);
    await this.storage.set(key, data);
    // Persistent-layer LRU eviction.
    const keys = await this.storage.keys();
    if (keys.length > this.persistentBound) {
      // Evict oldest (FIFO — adequate for a bounded cache).
      const toEvict = keys.slice(0, keys.length - this.persistentBound);
      await Promise.all(toEvict.map((k) => this.storage!.delete(k)));
    }
  }

  clear(): void {
    this.memory.clear();
  }
}