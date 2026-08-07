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

  it("succeeds on the first endpoint and only calls it once", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    expect(result).toEqual({ elements: [] });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to the second endpoint after a 429", async () => {
    mockFetch.mockResolvedValueOnce(failResponse(429));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [{ id: 1 }] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    expect(result).toEqual({ elements: [{ id: 1 }] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to the second endpoint after a 500", async () => {
    mockFetch.mockResolvedValueOnce(failResponse(500));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    expect(result).toEqual({ elements: [] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back after a network throw on the first endpoint", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("network error"));
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [] }));
    const result = await fetchOsm(bbox, new AbortController().signal);
    expect(result).toEqual({ elements: [] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws OverpassError and tries all 3 endpoints when every endpoint fails", async () => {
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

  it("falls through to the next endpoint after the per-instance 10s timeout", async () => {
    vi.useFakeTimers();
    // First fetch: stays pending until its (per-request) signal aborts, then rejects.
    mockFetch.mockImplementationOnce(
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
    // Second fetch: succeeds immediately.
    mockFetch.mockResolvedValueOnce(okResponse({ elements: [] }));

    const controller = new AbortController();
    const promise = fetchOsm(bbox, controller.signal);
    // Advance past CLIENT_TIMEOUT_MS (10_000ms) to fire the first request's
    // setTimeout-driven abort, which rejects the first fetch and forces a
    // fall-through to the next endpoint.
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;
    expect(result).toEqual({ elements: [] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});