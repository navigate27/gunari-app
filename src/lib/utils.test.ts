import { describe, it, expect } from "vitest";
import { formatLatLng } from "./utils";

describe("formatLatLng", () => {
  it("formats northern and eastern hemispheres to three decimals", () => {
    expect(formatLatLng(14.5995, 120.9842)).toBe("14.600°N / 120.984°E");
  });

  it("uses S and W with absolute values for the other hemispheres", () => {
    expect(formatLatLng(-33.8688, -70.6483)).toBe("33.869°S / 70.648°W");
  });
});
