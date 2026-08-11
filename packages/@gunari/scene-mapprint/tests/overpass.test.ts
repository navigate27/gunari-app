import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchOsm, OverpassError } from "../src/data/overpass";
import type { BBox } from "../src/interpret/types";

const bbox: BBox = [120.95, 14.58, 121.02, 14.63];

function okResponse(json: unknown) {
  return { ok: true, status: 200, json: async () => json };
}

function failResponse(status: number) {
  return { ok: false, status };
}

describe("fetchOsm", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("races all endpoints in parallel and returns the first OK response", async () => {
    // All 3 endpoints return OK; the first to fulfill wins the race.
    mockFetch.mockResolvedValue(okResponse({ elements: [] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    expect(result).toEqual({ elements: [] });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("calls every endpoint before any resolves (true parallel dispatch)", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [{ id: 1 }] }));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [{ id: 2 }] }));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [{ id: 3 }] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    // Microtask order: the first queued mock resolves first, winning the race.
    expect(result).toEqual({ elements: [{ id: 1 }] });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("ignores a 429 from one endpoint and uses the next OK response", async () => {
    mockFetch.mockResolvedValueOnce(failResponse(429));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [{ id: 1 }] }));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [{ id: 2 }] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    expect(result.elements).toEqual([{ id: 1 }]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("ignores a 500 from one endpoint and uses the next OK response", async () => {
    mockFetch.mockResolvedValueOnce(failResponse(500));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [] }));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    expect(result).toEqual({ elements: [] });
  });

  it("ignores a network throw from one endpoint and uses the next OK response", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("network error"));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [] }));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    expect(result).toEqual({ elements: [] });
  });

  it("throws OverpassError when all endpoints fail", async () => {
    mockFetch.mockResolvedValue(failResponse(500));
    await expect(
      fetchOsm(bbox, new AbortController().signal)
    ).rejects.toBeInstanceOf(OverpassError);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws an error whose message contains 'abort' when the caller signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchOsm(bbox, controller.signal)).rejects.toThrow(/abort/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("propagates caller abort mid-flight as an OverpassError", async () => {
    // Each fetch stays pending until its per-request signal aborts, then rejects.
    mockFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          if (init.signal.aborted) {
            reject(new TypeError("aborted"));
            return;
          }
          init.signal.addEventListener(
            "abort",
            () => reject(new TypeError("aborted")),
            { once: true }
          );
        })
    );
    const controller = new AbortController();
    const promise = fetchOsm(bbox, controller.signal);
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(OverpassError);
  });

  it("throws OverpassError after all endpoints time out", async () => {
    vi.useFakeTimers();
    // Each fetch stays pending until its per-request signal aborts, then rejects.
    mockFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          if (init.signal.aborted) {
            reject(new TypeError("aborted"));
            return;
          }
          init.signal.addEventListener(
            "abort",
            () => reject(new TypeError("aborted")),
            { once: true }
          );
        })
    );
    const promise = fetchOsm(bbox, new AbortController().signal);
    // Pre-attach a no-op handler so Node doesn't report the rejection as
    // unhandled — the rejection lands during advanceTimersByTimeAsync, before
    // the expect() below attaches its own handler.
    promise.catch(() => {});
    // Advance past the per-endpoint 10s timeout — all 3 controllers abort,
    // all fetches reject, Promise.any rejects, fetchOsm throws OverpassError.
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).rejects.toBeInstanceOf(OverpassError);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});