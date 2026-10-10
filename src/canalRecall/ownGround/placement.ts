// Base heights for models standing on the relief (pure).
//
// A building's base is the *lowest* relief along its footprint (vertices and
// edge midpoints, plus the centroid): it then never floats, and on a slope the
// uphill side's ground hides the bottom of the wall the way a real dike house
// sits in its bank. Chunked building meshes cannot move per building, so
// buildings are grouped into height bins (one mesh per bin and cell, lifted by
// the bin), which bounds the error at half a bin.

import type { HeightFn, Vec2 } from './surface.js';

export interface BaseHeight { base: number; max: number; mean: number; samples: number }

export function footprintBase(ring: readonly Vec2[], height: HeightFn): BaseHeight {
  const zs: number[] = [];
  let cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    zs.push(height(a[0], a[1]), height((a[0] + b[0]) / 2, (a[1] + b[1]) / 2));
    cx += a[0] / ring.length; cy += a[1] / ring.length;
  }
  zs.push(height(cx, cy));
  const finite = zs.filter(Number.isFinite);
  if (!finite.length) return { base: 0, max: 0, mean: 0, samples: 0 };
  return { base: Math.min(...finite), max: Math.max(...finite), mean: finite.reduce((s, z) => s + z, 0) / finite.length, samples: finite.length };
}

/** A point model (tree, lamp, the bike): the relief under it. */
export const pointBase = (p: Vec2, height: HeightFn) => height(p[0], p[1]);

/** Group items by base height into bins `binM` wide; returns bin z → items. */
export function binByBase<T>(items: readonly T[], baseOf: (t: T) => number, binM = 0.2): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const it of items) {
    // Floor, not round: a model may sink up to one bin, never float.
    const z = Math.floor(baseOf(it) / binM) * binM;
    const k = Math.round(z * 1000) / 1000;
    (out.get(k) ?? out.set(k, []).get(k)!).push(it);
  }
  return out;
}

/**
 * Lift each building's vertices in a merged chunk by its own base height, using
 * the chunk's per-building vertex ranges. Returns how many ranges were lifted.
 */
export function liftRanges(positions: Float32Array, ranges: readonly { id: string; start: number; count: number }[], baseOf: (id: string) => number | undefined): number {
  let lifted = 0;
  for (const r of ranges) {
    const z = baseOf(r.id);
    if (z === undefined || !Number.isFinite(z) || z === 0) continue;
    for (let v = r.start; v < r.start + r.count; v++) positions[v * 3 + 2] += z;
    lifted++;
  }
  return lifted;
}
