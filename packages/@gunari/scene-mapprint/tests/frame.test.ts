import { describe, it, expect } from "vitest";
import { artworkLayout } from "@gunari/core";
import { projectLatLng, unprojectCanvas } from "../src/projection/frame";
import type { BBox } from "../src/interpret/types";

const bbox: BBox = [120.97, 14.59, 120.99, 14.61];

describe("projectLatLng / unprojectCanvas", () => {
  for (const format of ["story", "square", "landscape"] as const) {
    for (const rotation of [0, 0.7, Math.PI]) {
      it(`round-trips a point on ${format} at rotation ${rotation.toFixed(1)} with pan`, () => {
        const vp = { ...artworkLayout(format, "classic").slot, panX: 0.03, panY: -0.02 };
        const [x, y] = projectLatLng(bbox, vp, rotation, 14.6032, 120.9811);
        const back = unprojectCanvas(bbox, vp, rotation, [x, y]);
        expect(back.lat).toBeCloseTo(14.6032, 6);
        expect(back.lng).toBeCloseTo(120.9811, 6);
      });
    }
  }

  it("puts the bbox centre on the slot centre when there is no pan or rotation", () => {
    const vp = artworkLayout("story", "classic").slot;
    const [x, y] = projectLatLng(bbox, vp, 0, 14.6, 120.98);
    expect(x).toBeCloseTo(0.5, 3);
    expect(y).toBeCloseTo(0.5, 3);
  });
});
