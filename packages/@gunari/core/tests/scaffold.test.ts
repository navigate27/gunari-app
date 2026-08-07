import { describe, it, expect, vi } from "vitest";
import { renderScaffold, ARTWORK_W, ARTWORK_H, type ScaffoldInput } from "../src/artwork/scaffold";
import type { ThemePalette } from "../src/theme/theme";

function makeMockCtx() {
  const calls: string[] = [];
  return {
    ctx: {
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      fillRect: (...args: number[]) => calls.push(`fillRect(${args.join(",")})`),
      strokeRect: (...args: number[]) => calls.push(`strokeRect(${args.join(",")})`),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillStyle: "",
      strokeStyle: "",
      globalAlpha: 1,
      lineWidth: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      beginPath: () => calls.push("beginPath"),
      moveTo: () => {},
      lineTo: () => {},
      rect: () => {},
      arc: () => {},
      closePath: () => calls.push("closePath"),
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
      fillText: (text: string) => calls.push(`fillText:${text}`),
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      clip: () => calls.push("clip"),
    } as unknown as CanvasRenderingContext2D,
    calls,
  };
}

const palette: ThemePalette = {
  id: "test",
  label: "Test",
  background: { top: "#fff", bottom: "#eee" },
  title: "#000",
  message: "#333",
  meta: "#666",
  accent: "#999",
  light: true,
};

describe("renderScaffold", () => {
  it("exports 1080×1920 dimensions", () => {
    expect(ARTWORK_W).toBe(1080);
    expect(ARTWORK_H).toBe(1920);
  });

  it("draws the background, title, message, metadata, and wordmark", () => {
    const { ctx, calls } = makeMockCtx();
    const fakeSceneRender = vi.fn();
    const input: ScaffoldInput = {
      layout: "classic",
      title: "Manila",
      message: "where we met",
      meta: { date: "2026-08-07", time: "21:00", location: "Manila, PH" },
      palette,
      scene: {
        render: fakeSceneRender as never,
      },
      sceneGeometry: {} as never,
      scenePalette: palette,
    };
    renderScaffold(ctx, input);
    // Background fill happened
    expect(calls.some((c) => c.startsWith("fillRect"))).toBe(true);
    // Title text drawn
    expect(calls.some((c) => c === "fillText:Manila")).toBe(true);
    // Message text drawn
    expect(calls.some((c) => c === "fillText:where we met")).toBe(true);
    // Wordmark drawn
    expect(calls.some((c) => c === "fillText:GUNARI")).toBe(true);
    // Scene render was called once
    expect(fakeSceneRender).toHaveBeenCalledTimes(1);
  });

  it("does not draw message when message is empty", () => {
    const { ctx, calls } = makeMockCtx();
    const input: ScaffoldInput = {
      layout: "classic",
      title: "Manila",
      message: "",
      meta: { date: "2026-08-07", time: "21:00", location: "Manila, PH" },
      palette,
      scene: { render: vi.fn() as never },
      sceneGeometry: {} as never,
      scenePalette: palette,
    };
    renderScaffold(ctx, input);
    expect(calls.some((c) => c.startsWith("fillText:where we met"))).toBe(false);
  });
});