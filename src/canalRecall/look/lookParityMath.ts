/**
 * Pure helpers for the look-parity check (lookParity.ts): which walls are
 * measured, how a rendered wall becomes one luma number, and how far apart the
 * pipelines may land. No DOM, no WebGL: unit-tested in node.
 */

/** Walls measured: one facing the shared sun's side (lit), one facing away (sky only). */
export type ParityFace = 'south' | 'west' | 'north' | 'east';
export const PARITY_FACES: readonly ParityFace[] = ['south', 'west', 'north', 'east'];

/** Outward ENU normal of a vertical wall. */
export function faceNormal(face: ParityFace): [number, number, number] {
  switch (face) {
    case 'south': return [0, -1, 0];
    case 'north': return [0, 1, 0];
    case 'east': return [1, 0, 0];
    case 'west': return [-1, 0, 0];
  }
}

/** Rec. 601 luma of an sRGB byte triple (what the screenshots' "mean luma" uses). */
export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Mean luma of the central part of a square RGBA readback, ignoring a border
 * of `margin` (fraction of the side) and any magenta clear-colour pixel (a wall
 * that did not cover the view is a failure, not a dark wall).
 */
export function meanLuma(pixels: Uint8Array, size: number, margin: number): number {
  const lo = Math.floor(size * margin), hi = size - lo;
  let sum = 0, n = 0;
  for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) {
    const i = (y * size + x) * 4, r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (r === 255 && g === 0 && b === 255) continue;
    sum += luma(r, g, b); n++;
  }
  return n ? +(sum / n).toFixed(2) : NaN;
}

export type ParityResult = {
  hex: string;
  rig: Record<string, unknown>;
  /** `${pipeline}/${face}` → mean sRGB luma 0..255. */
  walls: Record<string, number>;
};

/**
 * Spread of a face across pipelines: (max − min) / mean, plus the extremes.
 * The parity rule (docs/LOOK.md): under the shared rig the same brick slot on
 * the same wall orientation may differ by at most PARITY_TOLERANCE.
 */
export function lumaSpread(result: ParityResult, pipelines: readonly string[], face: ParityFace): { spread: number; min: [string, number]; max: [string, number] } {
  const values = pipelines.map(p => [p, result.walls[`${p}/${face}`]] as [string, number]);
  if (values.some(([, v]) => !Number.isFinite(v))) return { spread: Infinity, min: values[0], max: values[0] };
  const min = values.reduce((a, b) => (b[1] < a[1] ? b : a)), max = values.reduce((a, b) => (b[1] > a[1] ? b : a));
  const mean = values.reduce((s, [, v]) => s + v, 0) / values.length;
  return { spread: (max[1] - min[1]) / mean, min, max };
}

/** Allowed relative luma spread between pipelines on one wall (docs/LOOK.md). */
export const PARITY_TOLERANCE = 0.08;
