export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Diagonal wipe clip-path. The overlay (showing the previous theme) starts
 * covering everything and retreats toward the bottom-right corner along the
 * main diagonal as `p` goes 0 → 1, revealing the new theme underneath.
 */
export function diagonalClipPath(p: number): string {
  if (p <= 0) return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
  if (p >= 1) return "polygon(100% 100%, 100% 100%, 100% 100%)";
  if (p < 0.5) {
    const a = 200 * p;
    return `polygon(${a}% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${a}%)`;
  }
  const a = 200 * p - 100;
  return `polygon(100% ${a}%, 100% 100%, ${a}% 100%)`;
}
