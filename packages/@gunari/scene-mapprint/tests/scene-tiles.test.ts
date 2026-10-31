import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SceneInput } from "@gunari/core";
import sample from "../__fixtures__/parse-sample.json";
import type { MapGeometry } from "../src/interpret/types";

vi.mock("../src/data/overpass", async (orig) => ({
  ...(await orig<typeof import("../src/data/overpass")>()),
  fetchOsm: vi.fn(),
}));
vi.mock("../src/data/tiles", () => ({
  getTilesSource: vi.fn(),
  loadTileGeometry: vi.fn(),
}));

import { fetchOsm, OverpassError } from "../src/data/overpass";
import { getTilesSource, loadTileGeometry } from "../src/data/tiles";
import { mapPrintScene } from "../src/scene";

const overpass = vi.mocked(fetchOsm);
const tiles = vi.mocked(loadTileGeometry);
const source = vi.mocked(getTilesSource);

let lat = 20;
const input = (): SceneInput => ({
  location: { lat: (lat += 0.5), lng: 120.9842, label: "Test" },
  shape: "square", style: "classic", marker: "solid", zoom: "district",
  rotation: 0, labels: false, layout: "classic",
});

const tiled = (roads: number): MapGeometry => ({
  bbox: [0, 0, 1, 1],
  roads: Array.from({ length: roads }, () => ({ class: "primary" as const, points: [] })),
  water: [], waterways: [], parks: [], built: [], green: [], labels: [], pois: [],
});

const signal = new AbortController().signal;

describe("mapPrintScene.load with a tile source", () => {
  beforeEach(() => {
    overpass.mockReset();
    tiles.mockReset();
    source.mockReset();
    source.mockReturnValue("https://example.com/map.pmtiles");
  });

  it("uses the tiles and never asks Overpass when they have data", async () => {
    tiles.mockResolvedValue(tiled(3));
    const out = await mapPrintScene.load(input(), signal);
    expect(out.geometry.roads).toHaveLength(3);
    expect(overpass).not.toHaveBeenCalled();
  });

  it("falls back to Overpass when the tiles fail or come back empty", async () => {
    overpass.mockResolvedValue(sample as never);
    tiles.mockRejectedValueOnce(new OverpassError("tiles failed"));
    expect((await mapPrintScene.load(input(), signal)).geometry.roads.length).toBeGreaterThan(0);
    tiles.mockResolvedValueOnce(tiled(0));
    expect((await mapPrintScene.load(input(), signal)).geometry.roads.length).toBeGreaterThan(0);
    expect(overpass).toHaveBeenCalledTimes(2);
  });

  it("does not fall back when the load was aborted", async () => {
    tiles.mockRejectedValue(new OverpassError("aborted"));
    await expect(mapPrintScene.load(input(), signal)).rejects.toThrow("aborted");
    expect(overpass).not.toHaveBeenCalled();
  });

  it("skips tiles entirely when no source is set", async () => {
    source.mockReturnValue(null);
    overpass.mockResolvedValue(sample as never);
    await mapPrintScene.load(input(), signal);
    expect(tiles).not.toHaveBeenCalled();
  });
});
