// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMapPrintState } from "./useMapPrintState";
import { mapPrintScene } from "@gunari/scene-mapprint";

vi.mock("@gunari/scene-mapprint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@gunari/scene-mapprint")>();
  return {
    ...actual,
    mapPrintScene: {
      ...actual.mapPrintScene,
      load: vi.fn(() =>
        Promise.resolve({
          geometry: {
            bbox: [0, 0, 0, 0] as [number, number, number, number],
            roads: [],
            water: [],
            waterways: [],
            parks: [],
            labels: [],
          },
          bbox: [0, 0, 0, 0] as [number, number, number, number],
          zoom: "district" as const,
        }),
      ),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useMapPrintState", () => {
  it("initializes with Manila defaults", () => {
    const { result } = renderHook(() => useMapPrintState());
    expect(result.current.input.location.lat).toBe(14.5995);
    expect(result.current.input.location.lng).toBe(120.9842);
    expect(result.current.input.location.label).toContain("Manila");
    expect(result.current.input.shape).toBe("square");
    expect(result.current.input.style).toBe("classic");
    expect(result.current.input.zoom).toBe("district");
    expect(result.current.input.rotation).toBe(0);
    expect(result.current.input.labels).toBe(false);
    expect(result.current.input.layout).toBe("classic");
  });

  it("update changes a field", () => {
    const { result } = renderHook(() => useMapPrintState());
    act(() => result.current.update("shape", "circle"));
    expect(result.current.input.shape).toBe("circle");
  });

  it("updateLocation changes location fields", () => {
    const { result } = renderHook(() => useMapPrintState());
    act(() => result.current.updateLocation({ lat: 1, lng: 2, label: "Test" }));
    expect(result.current.input.location).toEqual({ lat: 1, lng: 2, label: "Test" });
  });

  it("rotation update does NOT trigger load (data unchanged)", async () => {
    const { result } = renderHook(() => useMapPrintState());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const loadCallsBefore = (mapPrintScene.load as ReturnType<typeof vi.fn>).mock.calls.length;
    act(() => result.current.update("rotation", Math.PI / 4));
    // No new load call for rotation
    expect((mapPrintScene.load as ReturnType<typeof vi.fn>).mock.calls.length).toBe(loadCallsBefore);
  });

  it("randomize changes 7 cosmetic fields, leaves location/title/message", () => {
    const { result } = renderHook(() => useMapPrintState());
    const beforeLoc = { ...result.current.input.location };
    const beforeTitle = result.current.input.title;
    const beforeMessage = result.current.input.message;
    act(() => result.current.randomize());
    expect(result.current.input.location).toEqual(beforeLoc);
    expect(result.current.input.title).toBe(beforeTitle);
    expect(result.current.input.message).toBe(beforeMessage);
    // At least one of theme/shape/marker/zoom/rotation/labels/layout changed
    const changed =
      result.current.input.style !== "classic" ||
      result.current.input.shape !== "square" ||
      result.current.input.marker !== "solid" ||
      result.current.input.zoom !== "district" ||
      result.current.input.rotation !== 0 ||
      result.current.input.labels !== false ||
      result.current.input.layout !== "classic";
    expect(changed).toBe(true);
  });
});