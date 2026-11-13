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

// Fronts on the street, walls down to the ground (lane F4, feedback 2026-11-13: the Kinkerbrug approach). The lowest
// relief buried the street wall wherever the street stands above the yards behind it: Postjesweg runs 2.5 m over the
// gardens of its blocks, and the pavement covered the ground floor up to the first-floor sills. A building now stands on
// the high ground just outside its walls (`frontBase`: a high quantile of the relief sampled FRONT_OUT_M outside every
// wall, so the street side wins over the yard and the party walls), and the bottom of its walls reaches down to the
// relief under each wall foot (`drapeRange`), so the low sides show a taller plinth, not a gap.

/** Samples sit this far outside each wall, metres (past the wall line, where the relief is the street's own). */
export const FRONT_OUT_M = 0.75;
/** Spacing of the outside samples along a wall, metres (at least the midpoint of every wall). */
export const FRONT_STEP_M = 1.5;
/** At most this many outside samples per footprint (long walls spread them). */
export const FRONT_MAX_SAMPLES = 96;
/** The base is this quantile of the outside samples: the street wall's level, not one spike (a kerb, a lamp's footprint). */
export const FRONT_QUANTILE = 0.9;
/** Never more than this above the lowest relief under the footprint, metres (a dike's or an embankment's crown beside a low house). */
export const FRONT_MAX_RAISE_M = 3;
/** A wall foot drops to the relief only where that lies more than this below the base, metres (flat ground and the street wall: nothing moves). */
export const DRAPE_MIN_M = 0.05;
/**
 * A dropped wall foot sinks this far under the relief at its own point (the ground mesh between the 2 m relief samples
 * may lie a little lower: no hairline under the wall), metres. Only the foot's own point is read: a reach into the
 * footprint would pull the street wall's foot down into the interpolated relief under the building.
 */
export const DRAPE_SINK_M = 0.1;
/** Vertices this close to the building's own ground level (model z 0) are its wall feet, metres. */
export const DRAPE_FOOT_TOL_M = 0.002;

/** Quantile `q` of `values` (sorted copy, nearest rank). */
function quantile(values: readonly number[], q: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
}

/**
 * The street-wall base of a footprint (lane F4): FRONT_QUANTILE of the relief FRONT_OUT_M outside its walls, never below
 * the lowest relief under it (footprintBase.base) nor more than FRONT_MAX_RAISE_M above it. Undefined samples (non-finite
 * relief) are skipped; with none, the lowest relief.
 */
export function frontBase(ring: readonly Vec2[], height: HeightFn): BaseHeight & { front: number; low: number } {
  const low = footprintBase(ring, height);
  if (!low.samples) return { ...low, front: low.base, low: low.base };
  let area = 0, perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    area += a[0] * b[1] - b[0] * a[1];
    perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const outward = area > 0 ? 1 : -1; // CCW ring: the outside is to the right of each edge
  const step = Math.max(FRONT_STEP_M, perimeter / FRONT_MAX_SAMPLES);
  const zs: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, nx = uy * outward * FRONT_OUT_M, ny = -ux * outward * FRONT_OUT_M;
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, z = height(a[0] + (b[0] - a[0]) * t + nx, a[1] + (b[1] - a[1]) * t + ny);
      if (Number.isFinite(z)) zs.push(z);
    }
  }
  if (!zs.length) return { ...low, front: low.base, low: low.base };
  const front = Math.min(low.base + FRONT_MAX_RAISE_M, Math.max(low.base, quantile(zs, FRONT_QUANTILE)));
  return { ...low, base: front, front, low: low.base };
}

/**
 * Where a lifted building's wall foot meets the ground (lane F4): where the relief at (x, y) lies more than DRAPE_MIN_M
 * below `base`, that relief sunk DRAPE_SINK_M; else (or where the relief is unknown) `base` itself.
 */
export function drapeFoot(x: number, y: number, base: number, height: HeightFn): number {
  const g = height(x, y);
  return Number.isFinite(g) && g < base - DRAPE_MIN_M ? g - DRAPE_SINK_M : base;
}

/**
 * Lift one building's vertex range from base `prev` to base `next` (metres) with its wall feet draped (lane F4): a
 * vertex at the building's own ground level (within DRAPE_FOOT_TOL_M of `prev`, plus a grid step on an Int16 mesh) goes
 * to drapeFoot, every other vertex moves by `next − prev`. Positions are in model units of `unit` metres (1: Float32
 * metres; 0.1: an Int16 decimetre grid) with x, y in the own ground's local metres once multiplied by `unit` and shifted by
 * `offset`. Pure over `positions`; a later call with prev = this call's next re-lifts from where this one left off
 * (feet keep being feet: a drape only ever lowers a vertex below the moved one). Returns the vertices draped below the base.
 */
export function drapeRange(positions: Float32Array | Int16Array, start: number, count: number, prev: number, next: number, height: HeightFn | null, unit = 1, offset: readonly [number, number] = [0, 0]): number {
  const grid = unit !== 1;
  const shift = grid ? Math.round(next / unit) - Math.round(prev / unit) : next - prev;
  const footZ = grid ? Math.round(prev / unit) : prev, tol = grid ? 0.5 : DRAPE_FOOT_TOL_M;
  let draped = 0;
  for (let v = start; v < start + count; v++) {
    const k = v * 3 + 2, z = positions[k];
    // A foot was at the base (or draped below it): z <= base + tol. Anything above is the building itself.
    const moved = z + shift;
    if (height && z <= footZ + tol) {
      // Drape only ever lowers a foot (a vertex already below its base stays there, moved with it, if that is lower).
      const foot = drapeFoot(positions[v * 3] * unit + offset[0], positions[v * 3 + 1] * unit + offset[1], next, height);
      const f = grid ? Math.round(foot / unit) : foot;
      if (foot < next && f < moved) { positions[k] = f; draped++; continue; }
    }
    positions[k] = moved;
  }
  return draped;
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
