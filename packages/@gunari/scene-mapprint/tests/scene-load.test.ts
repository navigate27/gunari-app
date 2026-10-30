import { beforeEach, describe, it, expect, vi } from "vitest";
import type { SceneInput } from "@gunari/core";
import sample from "../__fixtures__/parse-sample.json";

vi.mock("../src/data/overpass", async (orig) => {
  const actual = await orig<typeof import("../src/data/overpass")>();
  return { ...actual, fetchOsm: vi.fn() };
});

import { fetchOsm, OverpassError } from "../src/data/overpass";
import { mapPrintScene } from "../src/scene";

const fetchMock = vi.mocked(fetchOsm);

function input(lat: number): SceneInput {
  return {
    location: { lat, lng: 120.9842, label: "Test" },
    shape: "square",
    style: "classic",
    marker: "solid",
    zoom: "district",
    rotation: 0,
    labels: false,
    layout: "classic",
  };
}

const signal = new AbortController().signal;

describe("mapPrintScene.load caching", () => {
  beforeEach(() => fetchMock.mockReset());

  it("does not cache a failed fetch, so the next load retries", async () => {
    fetchMock.mockRejectedValueOnce(new OverpassError("down"));
    const failed = await mapPrintScene.load(input(10.1), signal);
    expect(failed.geometry.roads).toHaveLength(0);

    fetchMock.mockResolvedValueOnce(sample as never);
    const retried = await mapPrintScene.load(input(10.1), signal);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retried.geometry.roads.length).toBeGreaterThan(0);
  });

  it("serves a successful fetch from cache without refetching", async () => {
    fetchMock.mockResolvedValueOnce(sample as never);
    await mapPrintScene.load(input(10.2), signal);
    const again = await mapPrintScene.load(input(10.2), signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(again.geometry.roads.length).toBeGreaterThan(0);
  });
});
