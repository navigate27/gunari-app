import { describe, it, expect } from "vitest";
import { artworkLayout } from "@gunari/core";
import { panLocation } from "../src/projection/pan";
import { zoomKmSpan } from "../src/projection/viewport";

const slot = artworkLayout("story", "classic").slot;
const origin = { lat: 14.5995, lng: 120.9842 };

describe("panLocation", () => {
  it("leaves the location alone when nothing was dragged", () => {
    expect(panLocation(origin, "district", slot, 0, 0, 0)).toEqual(origin);
  });

  it("dragging the map down moves the centre north, right moves it west", () => {
    const down = panLocation(origin, "district", slot, 0, 0, 0.05);
    expect(down.lat).toBeGreaterThan(origin.lat);
    expect(down.lng).toBeCloseTo(origin.lng, 8);
    const right = panLocation(origin, "district", slot, 0, 0.05, 0);
    expect(right.lng).toBeLessThan(origin.lng);
    expect(right.lat).toBeCloseTo(origin.lat, 8);
  });

  it("dragging by the whole bbox side moves the centre by the zoom's km span", () => {
    const side = 2 * slot.r * Math.min(slot.canvasW!, slot.canvasH!) * Math.SQRT2;
    const out = panLocation(origin, "district", slot, 0, 0, side / slot.canvasH!);
    expect((out.lat - origin.lat) * 110.574).toBeCloseTo(zoomKmSpan("district"), 5);
  });

  it("follows the screen when the map is rotated a quarter turn", () => {
    const out = panLocation(origin, "district", slot, Math.PI / 2, 0.05, 0);
    // A rightward drag now moves the content along geographic north/south.
    expect(Math.abs(out.lat - origin.lat)).toBeGreaterThan(0);
    expect(out.lng).toBeCloseTo(origin.lng, 8);
  });

  it("moves farther at coarser zooms for the same drag", () => {
    const near = panLocation(origin, "neighborhood", slot, 0, 0, 0.05);
    const far = panLocation(origin, "city", slot, 0, 0, 0.05);
    expect(far.lat - origin.lat).toBeGreaterThan(near.lat - origin.lat);
  });
});
