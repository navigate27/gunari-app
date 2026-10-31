import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/data/overpass", async (orig) => ({
  ...(await orig<typeof import("../src/data/overpass")>()),
  fetchOsm: vi.fn(),
}));

import { fetchOsm } from "../src/data/overpass";
import { loadOsm } from "../src/data/load-osm";

const directMock = vi.mocked(fetchOsm);
const bbox: [number, number, number, number] = [120.9, 14.5, 121, 14.6];

describe("loadOsm", () => {
  const proxyMock = vi.fn();
  beforeEach(() => {
    proxyMock.mockReset();
    directMock.mockReset();
    vi.stubGlobal("fetch", proxyMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses the app proxy and never touches Overpass when it answers", async () => {
    proxyMock.mockResolvedValue({ ok: true, json: async () => ({ elements: [{ id: 1 }] }) });
    const out = await loadOsm(bbox, new AbortController().signal, { pois: true });
    expect(out).toEqual({ elements: [{ id: 1 }] });
    expect(proxyMock.mock.calls[0][0]).toBe("/api/osm?bbox=120.9%2C14.5%2C121%2C14.6&pois=1");
    expect(directMock).not.toHaveBeenCalled();
  });

  it("falls back to Overpass when the proxy errors or is unreachable", async () => {
    directMock.mockResolvedValue({ elements: [] } as never);
    proxyMock.mockResolvedValueOnce({ ok: false, status: 502 });
    await loadOsm(bbox, new AbortController().signal);
    proxyMock.mockRejectedValueOnce(new TypeError("offline"));
    await loadOsm(bbox, new AbortController().signal);
    expect(directMock).toHaveBeenCalledTimes(2);
  });

  it("reports an abort instead of falling back", async () => {
    const controller = new AbortController();
    proxyMock.mockImplementation(async () => {
      controller.abort();
      throw new TypeError("aborted");
    });
    await expect(loadOsm(bbox, controller.signal)).rejects.toThrow("aborted");
    expect(directMock).not.toHaveBeenCalled();
  });
});
