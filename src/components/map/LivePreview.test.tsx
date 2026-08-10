// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LivePreview } from "./LivePreview";
import type { MapPrintInput } from "@/hooks/useMapPrintState";
import type { MapPrintSceneData, ProjectedMapGeometry } from "@gunari/scene-mapprint";

vi.mock("@gunari/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gunari/core")>();
  return {
    ...actual,
    renderScaffold: vi.fn(actual.renderScaffold),
  };
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
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockCtx as unknown as CanvasRenderingContext2D);
});

afterAll(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

const input: MapPrintInput = {
  location: { lat: 14.5995, lng: 120.9842, label: "Manila" },
  title: "Test",
  message: undefined,
  shape: "square", style: "classic", marker: "solid",
  zoom: "district", rotation: 0, labels: false, layout: "classic",
};

const data: MapPrintSceneData = {
  geometry: { bbox: [120.95, 14.58, 121.02, 14.63], roads: [], water: [], waterways: [], parks: [], labels: [] },
  bbox: [120.95, 14.58, 121.02, 14.63],
  zoom: "district",
};

const mockGeometry = {
  roads: [], water: [], waterways: [], parks: [], labels: [], rotation: 0,
} as unknown as ProjectedMapGeometry;

describe("LivePreview", () => {
  it("renders a canvas", () => {
    const { container } = render(
      <LivePreview input={input} data={data} geometry={null} loading={false} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("calls renderScaffold with the right sceneInput + sceneViewport", async () => {
    const { renderScaffold } = await import("@gunari/core");
    (renderScaffold as ReturnType<typeof vi.fn>).mockClear();
    render(
      <LivePreview input={input} data={data} geometry={mockGeometry} loading={false} />,
    );
    expect(renderScaffold).toHaveBeenCalled();
    const call = (renderScaffold as ReturnType<typeof vi.fn>).mock.calls[0];
    const scaffoldInput = call[1];
    expect(scaffoldInput.sceneInput).toEqual(input);
    expect(scaffoldInput.sceneViewport).toEqual({ cx: 0.5, cy: 0.5, r: 0.4 });
    expect(scaffoldInput.title).toBe("Test");
    expect(scaffoldInput.meta.location).toBe("Manila");
    expect(scaffoldInput.meta.date).toBe("");
    expect(scaffoldInput.meta.time).toBe("");
  });
});