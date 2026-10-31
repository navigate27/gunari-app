import { describe, expect, it, vi } from "vitest";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { addTile, emptyParts, finishTiles, tilesForBBox, type TileLike } from "../src/data/tiles";

interface Feat {
  type: 1 | 2 | 3;
  properties: Record<string, string>;
  geometry: { x: number; y: number }[][];
}

function tileOf(layers: Record<string, Feat[]>): TileLike {
  return {
    layers: Object.fromEntries(
      Object.entries(layers).map(([name, feats]) => [
        name,
        {
          length: feats.length,
          feature: (i: number) => ({
            type: feats[i].type,
            extent: 4096,
            properties: feats[i].properties,
            loadGeometry: () => feats[i].geometry,
          }),
        },
      ])
    ),
  };
}

const pt = (x: number, y: number) => ({ x, y });
const line = (kind_detail: string, extra: Record<string, string> = {}): Feat => ({
  type: 2,
  properties: { kind_detail, ...extra },
  geometry: [[pt(0, 0), pt(4096, 4096)]],
});

describe("tilesForBBox", () => {
  it("returns one tile for a box inside it and more when it crosses an edge", () => {
    expect(tilesForBBox([120.9835, 14.5985, 120.9845, 14.5995], 15)).toHaveLength(1);
    const wide = tilesForBBox([120.97, 14.59, 121.0, 14.62], 15);
    expect(wide.length).toBeGreaterThan(4);
    expect(new Set(wide.map((t) => `${t.x},${t.y}`)).size).toBe(wide.length);
  });

  it("stays on the map near the antimeridian and poles", () => {
    for (const t of tilesForBBox([179.99, 85, 180.5, 86], 13)) {
      expect(t.x).toBeLessThan(2 ** 13);
      expect(t.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("addTile", () => {
  it("places tile coordinates on the right longitude and latitude", () => {
    const out = emptyParts();
    addTile(out, tileOf({ roads: [line("primary")] }), 1, 1, 0, false);
    // z1 tile (1, 0): the north-east quarter. Its top-left corner is lng 0, lat ~85.05.
    expect(out.roads[0].points[0][0]).toBeCloseTo(0, 6);
    expect(out.roads[0].points[0][1]).toBeCloseTo(85.0511, 3);
    expect(out.roads[0].points[1][0]).toBeCloseTo(180, 6);
    expect(out.roads[0].points[1][1]).toBeCloseTo(0, 6);
  });

  it("keeps drivable roads and paths, drops service roads and rail", () => {
    const out = emptyParts();
    addTile(
      out,
      tileOf({
        roads: [
          line("motorway_link"),
          line("unclassified", { name: "Rizal Ave" }),
          line("footway"),
          line("service"),
          line("rail"),
        ],
      }),
      15, 0, 0, false
    );
    expect(out.roads.map((r) => r.class)).toEqual(["motorway", "tertiary", "path"]);
    expect(out.roads[1].name).toBe("Rizal Ave");
  });

  it("sorts land and water into the app's layers, with holes kept", () => {
    const outer = [pt(0, 0), pt(4096, 0), pt(4096, 4096), pt(0, 4096), pt(0, 0)];
    const hole = [pt(1000, 1000), pt(1000, 2000), pt(2000, 2000), pt(2000, 1000), pt(1000, 1000)];
    const poly = (kind: string): Feat => ({ type: 3, properties: { kind, name: "X" }, geometry: [outer, hole] });
    const out = emptyParts();
    addTile(
      out,
      tileOf({
        water: [poly("lake"), line("river"), line("drain")],
        landuse: [poly("park"), poly("residential"), poly("forest"), poly("military")],
      }),
      15, 0, 0, false
    );
    expect(out.water).toHaveLength(1);
    expect(out.water[0].holes).toHaveLength(1);
    expect(out.waterways).toHaveLength(1);
    expect([out.parks.length, out.built.length, out.green.length]).toEqual([1, 1, 1]);
  });

  it("reads place labels, and named places only when asked", () => {
    const p = (kind: string, name: string): Feat => ({ type: 1, properties: { kind, name }, geometry: [[pt(2048, 2048)]] });
    const tile = tileOf({
      places: [p("locality", "Manila"), p("country", "Philippines")],
      pois: [p("cafe", "Kapé"), p("hospital", "General"), p("bench", "A bench"), p("cafe", "")],
    });
    const without = emptyParts();
    addTile(without, tile, 15, 0, 0, false);
    expect(without.labels.map((l) => l.text)).toEqual(["Manila"]);
    expect(without.pois).toHaveLength(0);

    const withPois = emptyParts();
    addTile(withPois, tile, 15, 0, 0, true);
    expect(withPois.pois.map((x) => [x.name, x.category])).toEqual([
      ["Kapé", "food"],
      ["General", "community"],
    ]);
  });
});

describe("finishTiles", () => {
  it("orders roads like the Overpass path and drops places repeated across tiles", () => {
    const out = emptyParts();
    out.roads.push({ class: "motorway", points: [] }, { class: "residential", points: [] });
    out.labels.push(
      { text: "Binondo", x: 1, y: 1, class: "place" },
      { text: "Binondo", x: 1, y: 1, class: "place" }
    );
    out.pois.push(
      { name: "Café", category: "food", x: 1, y: 1 },
      { name: "Café", category: "food", x: 1, y: 1 }
    );
    const g = finishTiles([0, 0, 1, 1], out);
    expect(g.roads.map((r) => r.class)).toEqual(["motorway", "residential"]);
    expect(g.labels).toHaveLength(1);
    expect(g.pois).toHaveLength(1);
  });
});

describe("tile decoding libraries", () => {
  it("read an empty tile without throwing", () => {
    expect(new VectorTile(new PbfReader(new Uint8Array(0))).layers).toEqual({});
  });
});

describe("loadTileGeometry with a tile template", () => {
  it("fetches each covering tile from the template and treats missing tiles as empty", async () => {
    const { loadTileGeometry } = await import("../src/data/tiles");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Uint8Array(0)))
      .mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const bbox: [number, number, number, number] = [120.97, 14.59, 121.0, 14.62];
    const out = await loadTileGeometry(bbox, "district", new AbortController().signal, {}, "https://t.example/{z}/{x}/{y}.mvt?key=k");
    vi.unstubAllGlobals();
    expect(fetchMock.mock.calls.length).toBe(tilesForBBox(bbox, 15).length);
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/t\.example\/15\/\d+\/\d+\.mvt\?key=k$/);
    expect(out.roads).toEqual([]);
  });

  it("reports a failing tile server so the scene can fall back", async () => {
    const { loadTileGeometry } = await import("../src/data/tiles");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(
      loadTileGeometry([120.9, 14.5, 120.901, 14.501], "neighborhood", new AbortController().signal, {}, "https://t.example/{z}/{x}/{y}.mvt")
    ).rejects.toThrow(/tiles failed/);
    vi.unstubAllGlobals();
  });
});
