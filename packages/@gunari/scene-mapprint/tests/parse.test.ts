import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseOsm, type OsmResponse } from "../src/interpret/parse";
import type { BBox } from "../src/interpret/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  readFileSync(resolve(__dirname, "../__fixtures__/parse-sample.json"), "utf8")
) as OsmResponse;

const bbox: BBox = [120.95, 14.58, 121.02, 14.63];

describe("parseOsm", () => {
  const geom = parseOsm(sample, bbox);

  it("returns a MapGeometry with the input bbox", () => {
    expect(geom.bbox).toEqual(bbox);
  });

  it("classifies motorway and residential roads correctly", () => {
    const classes = geom.roads.map((r) => r.class);
    expect(classes).toContain("motorway");
    expect(classes).toContain("residential");
  });

  it("drops ways whose highway tag is not in the supported set", () => {
    expect(geom.roads.every((r) => r.class !== "service" as never)).toBe(true);
  });

  it("extracts road names", () => {
    const skyway = geom.roads.find((r) => r.class === "motorway");
    expect(skyway?.name).toBe("Skyway");
  });

  it("treats water polygons (natural=water) as closed polygons", () => {
    expect(geom.water.length).toBe(1);
    expect(geom.water[0].name).toBe("Laguna de Bay");
  });

  it("treats waterways (waterway=*) as lines, not polygons", () => {
    expect(geom.waterways.length).toBe(1);
  });

  it("treats parks (leisure=park) as polygons", () => {
    expect(geom.parks.length).toBe(1);
    expect(geom.parks[0].name).toBe("Rizal Park");
  });

  it("extracts place labels from nodes", () => {
    const placeLabels = geom.labels.filter((l) => l.class === "place");
    expect(placeLabels.length).toBe(1);
    expect(placeLabels[0].text).toBe("Manila");
  });

  it("keeps a place label's own lng/lat in x/y so projection can position it", () => {
    const manila = geom.labels.find((l) => l.text === "Manila");
    expect(manila?.x).toBeCloseTo(120.9842, 4);
    expect(manila?.y).toBeCloseTo(14.5995, 4);
  });

  it("preserves raw lat/lng in road/polygon points (unprojected)", () => {
    const skyway = geom.roads.find((r) => r.class === "motorway");
    expect(skyway?.points[0]).toEqual([120.98, 14.60]);
  });
});

describe("parseOsm land use", () => {
  const way = (id: number, tags: Record<string, string>) => ({
    type: "way" as const,
    id,
    tags,
    geometry: [
      { lat: 14.6, lon: 120.98 },
      { lat: 14.601, lon: 120.98 },
      { lat: 14.601, lon: 120.981 },
    ],
  });

  it("sorts landuse and natural ways into built-up and green layers", () => {
    const out = parseOsm(
      {
        elements: [
          way(1, { landuse: "residential" }),
          way(2, { landuse: "industrial" }),
          way(3, { landuse: "forest" }),
          way(4, { natural: "wood" }),
          way(5, { natural: "wetland" }),
          way(6, { landuse: "quarry" }),
        ],
      },
      [120.97, 14.59, 120.99, 14.61],
    );
    expect(out.built).toHaveLength(2);
    expect(out.green).toHaveLength(3);
  });

  it("keeps parks out of the green layer", () => {
    const out = parseOsm({ elements: [way(1, { leisure: "park" })] }, [120.97, 14.59, 120.99, 14.61]);
    expect(out.parks).toHaveLength(1);
    expect(out.green).toHaveLength(0);
  });
});

describe("parseOsm named places", () => {
  const node = (id: number, tags: Record<string, string>, lat = 14.6, lon = 120.98) => ({
    type: "node" as const, id, lat, lon, tags,
  });
  const bbox: [number, number, number, number] = [120.97, 14.59, 120.99, 14.61];
  const parse = (elements: object[]) => parseOsm({ elements } as never, bbox);

  it("sorts named nodes into food, shops, landmarks, lodging and community", () => {
    const out = parse([
      node(1, { name: "Aling Nena", amenity: "restaurant" }),
      node(2, { name: "Mercury Drug", shop: "chemist" }),
      node(3, { name: "Rizal Museum", tourism: "museum" }),
      node(4, { name: "The Manila Hotel", tourism: "hotel" }),
      node(5, { name: "Ateneo", amenity: "university" }),
      node(6, { name: "Old Gate", historic: "monument" }),
    ]);
    const byName = Object.fromEntries(out.pois!.map((p) => [p.name, p.category]));
    expect(byName).toEqual({
      "Aling Nena": "food",
      "Mercury Drug": "shops",
      "Rizal Museum": "landmarks",
      "The Manila Hotel": "lodging",
      "Ateneo": "community",
      "Old Gate": "landmarks",
    });
  });

  it("ignores unnamed or uncategorised nodes", () => {
    const out = parse([node(1, { amenity: "restaurant" }), node(2, { name: "A bench", amenity: "bench" })]);
    expect(out.pois).toEqual([]);
  });

  it("marks the centre of a named building or area", () => {
    const out = parse([
      {
        type: "way", id: 9, tags: { name: "San Agustin Church", amenity: "place_of_worship" },
        geometry: [{ lat: 14.6, lon: 120.98 }, { lat: 14.602, lon: 120.98 }, { lat: 14.602, lon: 120.982 }, { lat: 14.6, lon: 120.982 }],
      },
    ]);
    expect(out.pois).toHaveLength(1);
    expect(out.pois![0].x).toBeCloseTo(120.981, 6);
    expect(out.pois![0].y).toBeCloseTo(14.601, 6);
  });

  it("never turns roads or land use into places", () => {
    const out = parse([
      {
        type: "way", id: 1, tags: { name: "Rizal Avenue", highway: "primary" },
        geometry: [{ lat: 14.6, lon: 120.98 }, { lat: 14.601, lon: 120.981 }],
      },
    ]);
    expect(out.pois).toEqual([]);
    expect(out.roads).toHaveLength(1);
  });

  it("keeps one place per name and kind, rarer kinds first, capped per kind", () => {
    const many = Array.from({ length: 700 }, (_, i) => node(i + 10, { name: `Shop ${i}`, shop: "convenience" }, 14.6, 120.98));
    const out = parse([
      ...many,
      node(1, { name: "Dupe", amenity: "cafe" }),
      node(2, { name: "Dupe", amenity: "cafe" }),
      node(3, { name: "Cathedral", historic: "church" }),
    ]);
    expect(out.pois!.filter((p) => p.category === "shops")).toHaveLength(150);
    expect(out.pois!.filter((p) => p.category === "food")).toHaveLength(1);
    expect(out.pois![0].name).toBe("Cathedral");
    expect(out.pois!.filter((p) => p.name === "Dupe")).toHaveLength(1);
  });
});
