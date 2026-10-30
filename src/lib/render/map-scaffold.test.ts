import { describe, it, expect } from "vitest";
import { CARD_STYLES, getMapTheme } from "@gunari/scene-mapprint";
import { buildMapScaffoldInput, cardPalette, emptyGeometry } from "./map-scaffold";
import type { MapPrintInput } from "@/hooks/useMapPrintState";

const input: MapPrintInput = {
  location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
  title: "T",
  shape: "square", style: "atlas", marker: "solid",
  zoom: "district", rotation: 0, labels: false, layout: "classic",
  showCoordinates: false, format: "story", viewKm: 1.4142, card: "match",
};

describe("card vs map palette", () => {
  it("the card follows the map theme by default", () => {
    expect(cardPalette(input)).toBe(getMapTheme("atlas"));
  });

  it("an explicit card style is independent of the map theme", () => {
    const built = buildMapScaffoldInput({ ...input, card: "navy" }, emptyGeometry(input));
    expect(built.palette).toBe(CARD_STYLES.navy);
    expect(built.scenePalette).toBe(getMapTheme("atlas"));
    expect(built.palette).not.toBe(built.scenePalette);
  });

  it("carries the geometry's zoom scale into the scene viewport", () => {
    const geometry = { ...emptyGeometry(input), zoomScale: 2.5 };
    expect(buildMapScaffoldInput(input, geometry).sceneViewport.zoomScale).toBe(2.5);
  });
});
