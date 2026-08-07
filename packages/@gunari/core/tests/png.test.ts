import { describe, it, expect } from "vitest";
import { canvasToPngDataUrl } from "../src/export/png";

describe("canvasToPngDataUrl", () => {
  it("returns a data: URL with the PNG mime type", () => {
    const canvas = { toDataURL: (type: string) => `data:${type};base64,AAAA` } as unknown as HTMLCanvasElement;
    const url = canvasToPngDataUrl(canvas);
    expect(url.startsWith("data:image/png")).toBe(true);
  });
});