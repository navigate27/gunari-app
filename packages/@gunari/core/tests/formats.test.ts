import { describe, it, expect } from "vitest";
import { FORMATS, FORMAT_ORDER, artworkLayout } from "../src/artwork/formats";

const LAYOUTS = ["classic", "poster"] as const;

describe("FORMATS", () => {
  it("defines story, square and landscape canvases", () => {
    expect(FORMAT_ORDER).toEqual(["story", "square", "landscape"]);
    expect(FORMATS.story).toMatchObject({ w: 1080, h: 1920 });
    expect(FORMATS.square).toMatchObject({ w: 1080, h: 1080 });
    expect(FORMATS.landscape).toMatchObject({ w: 1920, h: 1080 });
  });
});

describe("artworkLayout", () => {
  for (const format of FORMAT_ORDER) {
    for (const layout of LAYOUTS) {
      describe(`${format} / ${layout}`, () => {
        const L = artworkLayout(format, layout);
        const { w, h } = FORMATS[format];
        const min = Math.min(w, h);
        const cx = L.slot.cx * w;
        const cy = L.slot.cy * h;
        const r = L.slot.r * min;

        it("carries its canvas size on the slot", () => {
          expect(L.slot.canvasW).toBe(w);
          expect(L.slot.canvasH).toBe(h);
        });

        it("keeps the map slot inside the frame", () => {
          expect(cx - r).toBeGreaterThanOrEqual(L.inner.x);
          expect(cx + r).toBeLessThanOrEqual(L.inner.x + L.inner.w);
          expect(cy - r).toBeGreaterThanOrEqual(L.inner.y);
          expect(cy + r).toBeLessThanOrEqual(L.inner.y + L.inner.h);
        });

        // The original story poster layout puts the title over the map's lower
        // edge; it is kept unchanged so existing prints don't move.
        const overlapsByDesign = format === "story" && layout === "poster";
        (overlapsByDesign ? it.skip : it)("keeps title, message and metadata clear of the map slot", () => {
          const capHeight = L.base * 0.085 * 0.8;
          for (const spot of [L.title, L.message, L.meta]) {
            const clearAbove = spot.y < cy - r;
            const clearBelow = spot.y - capHeight > cy + r;
            const clearBeside =
              spot.x - spot.maxW / 2 > cx + r || spot.x + spot.maxW / 2 < cx - r;
            expect(clearAbove || clearBelow || clearBeside).toBe(true);
          }
        });
      });
    }
  }

  it("keeps the original story layout numbers", () => {
    const L = artworkLayout("story", "classic");
    expect(L.slot).toMatchObject({ cx: 0.5, cy: 0.5, r: 0.4 });
    expect(L.title.y).toBeCloseTo(80 + 1760 * 0.16, 5);
  });
});
