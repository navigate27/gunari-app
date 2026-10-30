// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
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
  showCoordinates: false,
  format: "story",
  viewKm: 1.4142,
  card: "match",
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
    expect(scaffoldInput.sceneViewport).toMatchObject({ cx: 0.5, cy: 0.5, r: 0.4, canvasW: 1080, canvasH: 1920, panX: 0, panY: 0 });
    // A freshly loaded map starts its drawing animation from nothing.
    expect(scaffoldInput.sceneViewport.reveal).toBe(0);
    expect(scaffoldInput.title).toBe("Test");
    expect(scaffoldInput.meta.location).toBe("Manila");
    expect(scaffoldInput.meta.date).toBe("");
    expect(scaffoldInput.meta.time).toBe("");
  });

  it("passes a formatted coordinates line to the scaffold only when enabled", async () => {
    const { renderScaffold } = await import("@gunari/core");
    const mock = renderScaffold as ReturnType<typeof vi.fn>;
    mock.mockClear();
    render(
      <LivePreview input={{ ...input, showCoordinates: true }} data={data} geometry={mockGeometry} loading={false} />,
    );
    expect(mock.mock.calls[0][1].meta.coordinates).toBe("14.600°N / 120.984°E");

    cleanup();
    mock.mockClear();
    render(<LivePreview input={input} data={data} geometry={mockGeometry} loading={false} />);
    expect(mock.mock.calls[0][1].meta.coordinates).toBeUndefined();
  });

  it("reports drags as pan offsets and commits on release", () => {
    const onPan = vi.fn();
    const onPanEnd = vi.fn();
    const { container } = render(
      <LivePreview
        input={input}
        data={data}
        geometry={mockGeometry}
        loading={false}
        onPan={onPan}
        onPanEnd={onPanEnd}
      />,
    );
    const card = container.querySelector("canvas")!.parentElement!;
    card.getBoundingClientRect = () =>
      ({ width: 200, height: 400, left: 0, top: 0, right: 200, bottom: 400, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 120, clientY: 140, pointerId: 1 });
    expect(onPan).toHaveBeenLastCalledWith({ x: 0.1, y: 0.1 });
    fireEvent.pointerUp(card, { pointerId: 1 });
    expect(onPanEnd).toHaveBeenCalledTimes(1);
  });

  it("is not draggable before the map has loaded", () => {
    const onPan = vi.fn();
    const { container } = render(
      <LivePreview input={input} data={null} geometry={null} loading={false} onPan={onPan} />,
    );
    const card = container.querySelector("canvas")!.parentElement!;
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(onPan).not.toHaveBeenCalled();
  });

  it("shows the drawing skeleton while the first map loads", () => {
    const { getByText } = render(
      <LivePreview input={input} data={null} geometry={null} loading={true} />,
    );
    expect(getByText("Drawing the map")).toBeInTheDocument();
  });

  it("drags the pin instead of the map when the pointer starts on the pin", () => {
    const onPan = vi.fn();
    const onPinChange = vi.fn();
    const geometryWithBox = {
      ...mockGeometry,
      bbox: [120.97, 14.59, 120.99, 14.61],
      rotation: 0,
    } as unknown as ProjectedMapGeometry;
    const { container } = render(
      <LivePreview
        input={input}
        data={data}
        geometry={geometryWithBox}
        loading={false}
        onPan={onPan}
        onPinChange={onPinChange}
      />,
    );
    const card = container.querySelector("canvas")!.parentElement!;
    card.getBoundingClientRect = () =>
      ({ width: 200, height: 356, left: 0, top: 0, right: 200, bottom: 356, x: 0, y: 0, toJSON() {} }) as DOMRect;
    // The pin's tip is at the slot centre (100, 178); its body sits just above.
    fireEvent.pointerDown(card, { clientX: 100, clientY: 168, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 110, clientY: 188, pointerId: 1 });
    expect(onPinChange).toHaveBeenCalled();
    const pin = onPinChange.mock.calls[0][0];
    expect(pin.lat).toBeLessThan(input.location.lat + 0.01);
    expect(Number.isFinite(pin.lat) && Number.isFinite(pin.lng)).toBe(true);
    expect(pin.lng).toBeGreaterThan(120.98);
    expect(onPan).not.toHaveBeenCalled();
  });

  it("pans the map when the pointer starts away from the pin", () => {
    const onPan = vi.fn();
    const onPinChange = vi.fn();
    const { container } = render(
      <LivePreview
        input={input}
        data={data}
        geometry={mockGeometry}
        loading={false}
        onPan={onPan}
        onPinChange={onPinChange}
      />,
    );
    const card = container.querySelector("canvas")!.parentElement!;
    card.getBoundingClientRect = () =>
      ({ width: 200, height: 356, left: 0, top: 0, right: 200, bottom: 356, x: 0, y: 0, toJSON() {} }) as DOMRect;
    fireEvent.pointerDown(card, { clientX: 20, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 40, clientY: 60, pointerId: 1 });
    expect(onPan).toHaveBeenCalled();
    expect(onPinChange).not.toHaveBeenCalled();
  });

  it("zooms from the +/- buttons and the scroll wheel", () => {
    const onZoom = vi.fn();
    const withBox = { ...mockGeometry, bbox: [120.97, 14.59, 120.99, 14.61], rotation: 0 } as unknown as ProjectedMapGeometry;
    const { container } = render(
      <LivePreview input={{ ...input, viewKm: 2 }} data={data} geometry={withBox} loading={false} onZoom={onZoom} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(onZoom).toHaveBeenLastCalledWith(expect.closeTo(2 / 1.45, 6));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(onZoom).toHaveBeenLastCalledWith(expect.closeTo(2 * 1.45, 6));

    const card = container.querySelector("canvas")!.parentElement!;
    fireEvent.wheel(card, { deltaY: -200 });
    expect(onZoom.mock.calls.at(-1)![0]).toBeLessThan(2);
    fireEvent.wheel(card, { deltaY: 200 });
    expect(onZoom.mock.calls.at(-1)![0]).toBeGreaterThan(2);
  });

  it("shows an unmissable updating pill while a new area loads over an existing map", () => {
    const withBox = { ...mockGeometry, bbox: [120.97, 14.59, 120.99, 14.61], rotation: 0 } as unknown as ProjectedMapGeometry;
    render(<LivePreview input={input} data={data} geometry={withBox} loading={true} />);
    expect(screen.getByText("Updating map")).toBeInTheDocument();
  });

  it("glides the card between formats instead of jumping", async () => {
    const { renderScaffold } = await import("@gunari/core");
    const mock = renderScaffold as ReturnType<typeof vi.fn>;
    let now = 1000;
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const step = (ms: number) => {
      now += ms;
      queue.splice(0).forEach((cb) => cb(now));
    };

    const withBox = { ...mockGeometry, bbox: [120.97, 14.59, 120.99, 14.61], rotation: 0 } as unknown as ProjectedMapGeometry;
    const { container, rerender } = render(
      <LivePreview input={input} data={data} geometry={withBox} loading={false} />,
    );
    step(2500); // let the opening draw-in finish
    const card = container.querySelector("canvas")!.parentElement!;
    expect(card.style.aspectRatio.replace(/\s/g, "")).toBe("1080/1920");

    mock.mockClear();
    rerender(
      <LivePreview input={{ ...input, format: "square" }} data={data} geometry={withBox} loading={false} />,
    );
    step(350);
    const mid = card.style.aspectRatio.split("/").map((n) => parseFloat(n));
    expect(mid[0] / mid[1]).toBeGreaterThan(0.56);
    expect(mid[0] / mid[1]).toBeLessThan(1);
    const midSpec = mock.mock.calls.at(-1)![1].layoutSpec;
    expect(midSpec.h).toBeGreaterThan(1080);
    expect(midSpec.h).toBeLessThan(1920);

    step(600);
    expect(card.style.aspectRatio.replace(/\s/g, "")).toBe("1080/1080");
    expect(mock.mock.calls.at(-1)![1].layoutSpec).toBeUndefined();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
