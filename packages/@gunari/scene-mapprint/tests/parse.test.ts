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

  it("leaves label x/y at 0,0 (projection fills them later)", () => {
    const manila = geom.labels.find((l) => l.text === "Manila");
    expect(manila?.x).toBe(0);
    expect(manila?.y).toBe(0);
  });

  it("preserves raw lat/lng in road/polygon points (unprojected)", () => {
    const skyway = geom.roads.find((r) => r.class === "motorway");
    expect(skyway?.points[0]).toEqual([120.98, 14.60]);
  });
});