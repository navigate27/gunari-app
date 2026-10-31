import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@gunari/scene-mapprint", () => ({ fetchOsm: vi.fn() }));

import { fetchOsm } from "@gunari/scene-mapprint";
import { fetchOsmCached, parseOsmRequest, resetOsmProxyCache } from "./osm-proxy";

const fetchMock = vi.mocked(fetchOsm);
const params = (bbox: string, pois?: string) =>
  new URLSearchParams({ bbox, ...(pois ? { pois } : {}) });

describe("parseOsmRequest", () => {
  it("snaps the box outward to a grid and reads the places flag", () => {
    expect(parseOsmRequest(params("120.9712,14.5921,120.9888,14.6079", "1"))).toEqual({
      bbox: [120.971, 14.592, 120.989, 14.608],
      pois: true,
    });
  });

  it("rejects malformed, inverted, out-of-range and oversized boxes", () => {
    for (const bad of ["1,2,3", "a,b,c,d", "10,10,9,11", "0,0,1,1", "0,95,0.1,96", "0,0,0.1,0.1,5"]) {
      expect(parseOsmRequest(params(bad))).toBeNull();
    }
    expect(parseOsmRequest(new URLSearchParams())).toBeNull();
  });
});

describe("fetchOsmCached", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    resetOsmProxyCache();
  });

  const req = { bbox: [1, 2, 1.1, 2.1] as [number, number, number, number], pois: false };

  it("asks Overpass once for repeat and concurrent requests", async () => {
    fetchMock.mockResolvedValue({ elements: [{ id: 1 }] } as never);
    const [a, b] = await Promise.all([fetchOsmCached(req), fetchOsmCached(req)]);
    await fetchOsmCached(req);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps places and no-places views separate, and does not cache failures", async () => {
    fetchMock.mockRejectedValueOnce(new Error("down"));
    await expect(fetchOsmCached(req)).rejects.toThrow("down");
    fetchMock.mockResolvedValue({ elements: [] } as never);
    await fetchOsmCached(req);
    await fetchOsmCached({ ...req, pois: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
