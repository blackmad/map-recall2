// Small buildings on a bridge's abutment over the mapped water (pure; lane fb-bridges-20261119, feedback c361c8 "the
// house that stands on a bridge", the Kinkerbrug bridge-keeper's house, BAG pand 0363100012197936, OSM w276306000).
//
// The rule an audit applies (scripts/own-ground/build-pand-abutments.ts): a pand of at most PAND_ABUTMENT_MAX_M2 whose
// footprint overlaps the water by at least PAND_ABUTMENT_MIN_WET_M2, with a surveyed deck polygon (roads-v1 h >= 1)
// within PAND_ABUTMENT_NEAR_M, on relief at street height under its wet part (an abutment, not a house on piles).
//
// Not wired into the ground: measured 2026-11-19, the Kinkerbrug house has 0 of its 105 footprint samples over the
// mapped water (its north wall on the water's edge, as the 8 cm orthophoto shows), so adding footprints to the mask's
// deck rings would change nothing there. City-wide the rule finds three other pands (0363100012171355,
// 0363100012181645, w858955798) that are unreviewed against photos; the audit stays for that review.

/** Largest footprint taken, m2 (a kiosk or bridge-keeper's house; a canal house is larger). */
export const PAND_ABUTMENT_MAX_M2 = 80;
/** Least footprint over the water, m2. */
export const PAND_ABUTMENT_MIN_WET_M2 = 1;
/** A surveyed deck polygon within this of the footprint, metres. */
export const PAND_ABUTMENT_NEAR_M = 2;
/** The extract file (extract root; scripts/own-ground/build-pand-abutments.ts). */
export const PAND_ABUTMENTS_FILE = 'pand-abutments.json';

export interface PandAbutmentsExtract { version: 1; generated?: string; pands: { id: string; ring: [number, number][] }[] }

type Vec2 = readonly [number, number];

/** Shoelace area of a ring, m2. */
export function ringArea(ring: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a) / 2;
}

export function inRing(ring: readonly Vec2[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Points inside the ring on a `step` grid (cell centres). */
export function ringSamples(ring: readonly Vec2[], step = 0.5): [number, number][] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const out: [number, number][] = [];
  for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) if (inRing(ring, x, y)) out.push([x, y]);
  return out;
}

const segDist = (px: number, py: number, a: Vec2, b: Vec2): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t);
};

/** Least distance between two rings (0 when they overlap). */
export function ringDistance(a: readonly Vec2[], b: readonly Vec2[]): number {
  if (a.some(([x, y]) => inRing(b, x, y)) || b.some(([x, y]) => inRing(a, x, y))) return 0;
  let d = Infinity;
  for (const [x, y] of a) for (let i = 0, j = b.length - 1; i < b.length; j = i++) d = Math.min(d, segDist(x, y, b[j], b[i]));
  for (const [x, y] of b) for (let i = 0, j = a.length - 1; i < a.length; j = i++) d = Math.min(d, segDist(x, y, a[j], a[i]));
  return d;
}

/**
 * Is this footprint a small building on a bridge's abutment? `wet(x, y)`: over the mapped water; `ground(x, y)`: the
 * relief; `waterZ`: the water surface there; `decks`: the surveyed deck polygons (h >= 1) around; `clear`: WET_CLEAR_M.
 */
export function isPandAbutment(ring: readonly Vec2[], wet: (x: number, y: number) => boolean, ground: (x: number, y: number) => number, waterZ: number, decks: readonly (readonly Vec2[])[], clear: number): boolean {
  if (ring.length < 3 || ringArea(ring) > PAND_ABUTMENT_MAX_M2) return false;
  const step = 0.5, wetPts = ringSamples(ring, step).filter(([x, y]) => wet(x, y));
  if (wetPts.length * step * step < PAND_ABUTMENT_MIN_WET_M2) return false;
  if (!decks.some(d => ringDistance(ring, d) <= PAND_ABUTMENT_NEAR_M)) return false;
  // The abutment: the relief under the wet part stands at street height (median of the samples).
  const zs = wetPts.map(([x, y]) => ground(x, y)).sort((p, q) => p - q);
  return zs[zs.length >> 1] >= waterZ + clear;
}
