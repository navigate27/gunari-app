import { createCanvas } from "canvas";
import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function renderToPng(
  draw: (ctx: CanvasRenderingContext2D) => void,
  w: number,
  h: number
): Promise<Buffer> {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  draw(ctx);
  return canvas.toBuffer("image/png");
}

export async function readGolden(name: string): Promise<Buffer> {
  const path = resolve(__dirname, "__golden__", `${name}.png`);
  try {
    return await fs.readFile(path);
  } catch {
    return Buffer.alloc(0);
  }
}

export async function writeGolden(name: string, png: Buffer): Promise<void> {
  const dir = resolve(__dirname, "__golden__");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolve(dir, `${name}.png`), png);
}

/**
 * Naive pixel diff: compare bytes. Returns { match, diff } where diff is
 * the fraction of differing bytes. `tolerance` is the maximum allowed diff
 * for `match` to be true. Good enough for golden-image comparison; a real
 * perceptual diff (pixelmatch) can be added later if needed.
 */
export async function diffImages(
  actual: Buffer,
  expected: Buffer,
  tolerance: number
): Promise<{ match: boolean; diff: number }> {
  if (expected.length === 0) return { match: false, diff: 1 };
  if (actual.length !== expected.length) {
    const denom = Math.max(actual.length, expected.length);
    const diff = Math.abs(actual.length - expected.length) / denom;
    return { match: diff <= tolerance, diff };
  }
  let differing = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) differing++;
  }
  const diff = differing / actual.length;
  return { match: diff <= tolerance, diff };
}