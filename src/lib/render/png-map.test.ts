// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { exportMapPng } from "./png-map";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import type { ProjectedMapGeometry } from "@gunari/scene-mapprint";

vi.mock("@gunari/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gunari/core")>();
  return { ...actual, renderScaffold: vi.fn(actual.renderScaffold) };
});

const mockCtx = {
  save: vi.fn(), restore: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(),
  scale: vi.fn(), fillStyle: "", strokeStyle: "", globalAlpha: 1,
  lineWidth: 1, font: "", textAlign: "", textBaseline: "",
  beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
  fill: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(), clip: vi.fn(), rect: vi.fn(), arc: vi.fn(),
  translate: vi.fn(), rotate: vi.fn(), createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillText: vi.fn(), strokeText: vi.fn(), measureText: vi.fn(() => ({ width: 100 })),
  bezierCurveTo: vi.fn(), quadraticCurveTo: vi.fn(), setLineDash: vi.fn(),
  getImageData: vi.fn(), putImageData: vi.fn(), drawImage: vi.fn(),
};

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    mockCtx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback: BlobCallback) => {
      callback(new Blob(["fake-png"], { type: "image/png" }));
      return undefined;
    },
  );
});

afterAll(() => {
  vi.restoreAllMocks();
});

const input: MapPrintInput = {
  location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
  title: "Test",
  message: undefined,
  shape: "square", style: "classic", marker: "solid",
  zoom: "district", rotation: 0, labels: false, layout: "classic",
};

const geometry = {
  roads: [], water: [], waterways: [], parks: [], labels: [], rotation: 0,
} as unknown as ProjectedMapGeometry;

describe("exportMapPng", () => {
  it("returns a PNG blob", async () => {
    const blob = await exportMapPng({ input, geometry });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });
});