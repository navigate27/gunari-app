import { describe, it, expect } from "vitest";
import { buildOverpassQuery } from "../src/data/query";
import type { BBox } from "../src/interpret/types";

describe("buildOverpassQuery", () => {
  const bbox: BBox = [120.95, 14.58, 121.02, 14.63];

  it("returns a string starting with [out:json]", () => {
    const q = buildOverpassQuery(bbox);
    expect(q.startsWith("[out:json]")).toBe(true);
  });

  it("includes the [timeout:25] directive", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain("[timeout:25]");
  });

  it("includes the bbox coordinates in (south,west,north,east) order", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain("14.58,120.95,14.63,121.02");
  });

  it("includes the road classes filter", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain("motorway");
    expect(q).toContain("residential");
    expect(q).toContain("path");
  });

  it("includes water, waterway, park, and place tag selectors", () => {
    const q = buildOverpassQuery(bbox);
    expect(q).toContain('["natural"="water"]');
    expect(q).toContain("[waterway]");
    expect(q).toContain('["leisure"="park"]');
    expect(q).toContain('["place"');
  });

  it("ends with out:geom;", () => {
    const q = buildOverpassQuery(bbox);
    expect(q.trim().endsWith("out:geom;")).toBe(true);
  });
});