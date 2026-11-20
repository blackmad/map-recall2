// The edges of the surveyed ground that stands over mapped water as a deck (wetGround.ts), pure. Lane
// fb-ground2-20261120, feedback 4c1344ce ("bridge slightly broken here - why doesn't it meet the street?", the
// Doelensluis by the Hotel de l'Europe terrace).
//
// wetGround (and wetNearDecks) lift a BGT ground polygon over the Amstel's mapped water out of the street mask, so the
// terrace beside the Doelensluis is drawn. Two things stayed as if the water were open:
//  - `wetHoles`: the land layer is cut by the water alone (the mask's R channel), so a hole in such a polygon (BGT
//    leaves a lamp foot, a tree pit or a kademuur strip out of the wegdeel partition) and the slivers between two of
//    them showed the canal through the plein: the ragged water hole at the abutment (pin BRU0220). Inside a wet-ground
//    ring the land's cut is lifted to the ring's own edge (liftLandInRings).
//  - `wetFaces`: quay walls follow the OSM shore, which lies under the plein; the plein's real edge over the open water
//    had no face, so the terrace read as a slab floating at street height and the abutment's brick was gone. The ring
//    edges with open water outside get a quay wall (wetGroundShores), and the OSM shore inside a ring is buried
//    (insideRings skips it).

import { rasterInside, segmentDistances, type WaterMask } from './water.js';
import type { Vec2 } from './surface.js';

/** A wet-ground edge gets a face where open water lies this far outside it (metres). */
export const WET_FACE_PROBE_M = 0.6;
/** Edge pieces shorter than this are dropped (a polygon vertex's jitter is not a quay). */
export const WET_FACE_MIN_M = 0.8;
/** Edges are walked in steps of this (metres). */
export const WET_FACE_STEP_M = 0.5;

const boxOf = (r: readonly Vec2[]) => r.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
const inRing = (r: readonly Vec2[], x: number, y: number): boolean => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** Inside any of the rings (box first). */
export function insideRings(rings: readonly (readonly Vec2[])[]): (x: number, y: number) => boolean {
  const boxed = rings.map(r => ({ r, b: boxOf(r) }));
  return (x, y) => boxed.some(({ r, b }) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && inRing(r, x, y));
}

/**
 * A gap in the survey within this of a wet-ground ring, with a surveyed surface on both sides within this, is closed
 * (the slivers between BGT polygons, and the corner the survey leaves out between the Doelensluis's parapet line and the
 * terrace's kerb, which the 8 cm orthophoto shows paved), metres.
 */
export const WET_GAP_M = 2;
/** The bracket probes' distances out to WET_GAP_M (metres). */
const GAP_PROBES = [0.5, 1, 1.5, 2] as const;

/** What closes a gap beside a wet-ground ring: a surveyed surface on the far side, and the relief at street height. */
export interface WetGapTests {
  /** A surveyed surface (any roads-v1 polygon) or a wet-ground ring covers the point. */
  covered: (x: number, y: number) => boolean;
  /** The relief stands as a deck over the water there (wetGround.ts WET_CLEAR_M). */
  clear: (x: number, y: number) => boolean;
}

/**
 * The land channel with the water cut lifted inside the rings: max(sdf, distance to the ring edge) inside a ring, the
 * mask's own value elsewhere. With `gaps`, a texel over the water outside the rings within WET_GAP_M of one is lifted
 * too when a surveyed surface lies both ways along one axis within WET_GAP_M (a sliver between two polygons, a corner
 * the survey left out; never the plein's own edge over open water) and the relief there is at street height. A new
 * array; `mask` is not changed. Byte-identical when no ring meets the mask.
 */
export function liftLandInRings(mask: Pick<WaterMask, 'x0' | 'y0' | 'res' | 'width' | 'height' | 'range' | 'sdf'>, rings: readonly (readonly Vec2[])[], gaps?: WetGapTests): Float32Array {
  const { x0, y0, res, width, height, range } = mask;
  const near = rings.filter(r => { const b = boxOf(r); return b[2] >= x0 && b[0] <= x0 + width * res && b[3] >= y0 && b[1] <= y0 + height * res; });
  const out = mask.sdf.slice();
  if (!near.length) return out;
  const inside = rasterInside({ polygons: near.map(r => [r as Vec2[]]), shores: [] }, x0, y0, res, width, height);
  const dist = new Float32Array(width * height).fill(range);
  segmentDistances(dist, near, true, x0, y0, res, width, height, range);
  for (let k = 0; k < out.length; k++) if (inside[k] && dist[k] > out[k]) out[k] = dist[k];
  if (!gaps) return out;
  const d = Math.SQRT1_2;
  const dirs: Vec2[] = [[1, 0], [0, 1], [d, d], [d, -d]];
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const k = j * width + i;
    if (inside[k] || out[k] >= 0 || dist[k] > WET_GAP_M) continue;
    const x = x0 + (i + 0.5) * res, y = y0 + (j + 0.5) * res;
    // Bracketed: a surveyed surface both ways along one axis (the plein's own edge over open water has water on one side).
    const bracketed = dirs.some(([ux, uy]) => GAP_PROBES.some(g => gaps.covered(x + ux * g, y + uy * g)) && GAP_PROBES.some(g => gaps.covered(x - ux * g, y - uy * g)));
    if (bracketed && gaps.clear(x, y)) out[k] = res;
  }
  return out;
}

/**
 * The rings' edge pieces with open water outside them, as shorelines with the water on their left (water.ts
 * quayWallMesh). `open(x, y)`: mapped water not covered by a deck, a wet-ground ring or a surveyed surface.
 */
export function wetGroundShores(rings: readonly (readonly Vec2[])[], open: (x: number, y: number) => boolean): Vec2[][] {
  const out: Vec2[][] = [];
  for (const ring of rings) {
    const n = ring.length;
    if (n < 3) continue;
    // Orientation: the outside of a counter-clockwise ring lies right of each edge.
    let area = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    const ccw = area > 0;
    let run: Vec2[] = [];
    const flush = () => {
      let len = 0;
      for (let i = 1; i < run.length; i++) len += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]);
      // Water on the left: a ccw ring's outside is on the right, so walk it backwards.
      if (run.length >= 2 && len >= WET_FACE_MIN_M) out.push(ccw ? [...run].reverse() : run);
      run = [];
    };
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      // Outward normal: right of a→b for a ccw ring, left for a cw one.
      const s = ccw ? 1 : -1, nx = (dy / len) * s, ny = (-dx / len) * s;
      const steps = Math.max(1, Math.ceil(len / WET_FACE_STEP_M));
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps, t1 = (k + 1) / steps, tm = (t0 + t1) / 2;
        const mx = a[0] + dx * tm, my = a[1] + dy * tm;
        const wet = open(mx + nx * WET_FACE_PROBE_M, my + ny * WET_FACE_PROBE_M);
        if (!wet) { flush(); continue; }
        const p0: Vec2 = [a[0] + dx * t0, a[1] + dy * t0], p1: Vec2 = [a[0] + dx * t1, a[1] + dy * t1];
        const last = run[run.length - 1];
        if (!last || Math.hypot(last[0] - p0[0], last[1] - p0[1]) > 1e-6) { flush(); run.push(p0); }
        run.push(p1);
      }
    }
    flush();
  }
  return out;
}
