/**
 * Roof attachment audit: does a drawn roof stand on the walls under it?
 *
 * The mesh stops a roofed building's walls at the eaves and starts the roof
 * there, so a roof can fail to be "attached" in three ways, none of them a
 * height error (the vertical gap is always measured so that stays true):
 *
 *   hang      the roof's eave line runs out past the wall outline over a void
 *             (a fitted box on a footprint with a cut corner, a bay, a rake);
 *   bare-deck the roof covers only part of the footprint and the rest is a flat
 *             deck at the eaves, so a pitched roof reads as a hat on a box;
 *   vertical  where the roof surface meets the wall line it stands more than
 *             `VERTICAL_TOL_M` above the wall top or sinks more than `SINK_TOL_M`
 *             below it (an eave overhang drops below the wall top past the wall
 *             line, which is not a gap).
 *
 * Pure: no DOM, no network. `scripts/check-roof-attachment.ts` runs it over every
 * building tile through the game's decorator chain.
 */

import type { RoofTri } from './roofMesh.js';

type Vec2 = [number, number];

/** The legitimate eave overhang is 0.3 m; anything past this is a roof over empty air. */
export const HANG_TOL_M = 0.6;
/** The roof surface may not stand this far above the wall top where it meets the wall (a float). */
export const VERTICAL_TOL_M = 0.3;
/** ...nor sink this far below it. A little below is the eave skirt overlapping the cornice (Amsterdam School skirts reach 0.4 m). */
export const SINK_TOL_M = 0.5;
/** A deck this share of the footprint (or more) makes a pitched roof read as a hat on a flat block. */
export const BARE_DECK_SHARE = 0.25;
/** The same, in square metres, so a small shed-sized notch never counts. */
export const BARE_DECK_MIN_M2 = 12;

export type AttachmentFlag = 'vertical' | 'hang' | 'bare-deck';
export type AttachmentReport = {
  /** Roof surface height at the wall line (lowest sampled point) minus the wall top, metres. */
  verticalGapM: number;
  /** Lowest slope vertex minus the wall top: the eave overhang's drop, metres (informational). */
  lowestVertexGapM: number;
  /** How far the roof's eave line runs past the wall outline, metres (0 when inside). */
  hangM: number;
  /** Share of the roof slope area that lies outside the footprint. */
  hangAreaShare: number;
  /** Share of the footprint no roof slope covers (a flat deck, when the lid is drawn). */
  bareDeckShare: number;
  bareDeckM2: number;
  flags: AttachmentFlag[];
};

const inRing = (x: number, y: number, ring: readonly Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const distToRing = (x: number, y: number, ring: readonly Vec2[]): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
};

const inTri = (x: number, y: number, p: RoofTri['p']): boolean => {
  const d = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
  if (Math.abs(d) < 1e-9) return false;
  const a = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / d;
  const b = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / d;
  return a >= -1e-6 && b >= -1e-6 && a + b <= 1 + 1e-6;
};

/** The height of the plane through a triangle at (x, y); null for a vertical face. */
const zAt = (x: number, y: number, p: RoofTri['p']): number | null => {
  const d = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
  if (Math.abs(d) < 1e-9) return null;
  const a = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / d;
  const b = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / d;
  return a * p[0][2] + b * p[1][2] + (1 - a - b) * p[2][2];
};

const triArea = (p: RoofTri['p']): number => Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])) / 2;

/** The polygon's area (shoelace), metres squared. */
export const ringArea = (ring: readonly Vec2[]): number => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) { const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length]; s += ax * by - bx * ay; }
  return Math.abs(s) / 2;
};

/**
 * Measure one roof against its walls. `ring` is the open outer footprint ring in the
 * mesh frame (metres), `tris` the roof triangles in the same frame, `wallTopM` the
 * height the walls stop at, `hasLid` whether a flat lid is drawn under the roof
 * (a plan with `keepLid`); without a lid an uncovered footprint is a hole, not a deck.
 */
export function roofAttachment(ring: readonly Vec2[], tris: readonly RoofTri[], wallTopM: number, hasLid: boolean, grid = 24): AttachmentReport {
  const slopes = tris.filter(t => t.part === 'slope');
  if (!slopes.length || ring.length < 3) return { verticalGapM: 0, lowestVertexGapM: 0, hangM: 0, hangAreaShare: 0, bareDeckShare: 0, bareDeckM2: 0, flags: [] };
  let minZ = Infinity;
  for (const t of slopes) for (const q of t.p) if (q[2] < minZ) minZ = q[2];
  const lowestVertexGapM = minZ - wallTopM;

  // The roof surface height straight above sample points on the wall line (just inside it).
  let contactZ = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.5) continue;
    // Away from the corners: a softened hip corner rounds the eave in on purpose.
    for (const f of len >= 3.6 ? [1.2 / len, 0.5, 1 - 1.2 / len] : [0.5]) {
      const x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
      for (const [nx, ny] of [[-(by - ay) / len, (bx - ax) / len], [(by - ay) / len, -(bx - ax) / len]]) {
        const px = x + nx * 0.08, py = y + ny * 0.08;
        if (!inRing(px, py, ring)) continue;
        for (const t of slopes) {
          if (!inTri(px, py, t.p)) continue;
          const z = zAt(px, py, t.p);
          if (z !== null && z < contactZ) contactZ = z;
        }
      }
    }
  }
  const verticalGapM = Number.isFinite(contactZ) ? contactZ - wallTopM : lowestVertexGapM;

  // The eave line: slope vertices within half a metre of the lowest edge.
  let hangM = 0;
  for (const t of slopes) for (const q of t.p) {
    if (q[2] > minZ + 0.5 || inRing(q[0], q[1], ring)) continue;
    hangM = Math.max(hangM, distToRing(q[0], q[1], ring));
  }

  // Share of slope area outside the footprint, by sampling each triangle on a 4x4 barycentric lattice.
  let area = 0, outside = 0;
  for (const t of slopes) {
    const a = triArea(t.p);
    if (a < 1e-6) continue;
    let out = 0, n = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) {
      const u = (i + 1 / 3) / 4, v = (j + 1 / 3) / 4, w = 1 - u - v;
      if (w < 0) continue;
      const x = u * t.p[0][0] + v * t.p[1][0] + w * t.p[2][0], y = u * t.p[0][1] + v * t.p[1][1] + w * t.p[2][1];
      n++; if (!inRing(x, y, ring) && distToRing(x, y, ring) > 0.35) out++;
    }
    area += a; outside += n ? (a * out) / n : 0;
  }
  const hangAreaShare = area ? outside / area : 0;

  // Footprint coverage: grid samples inside the footprint that no slope projects onto.
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const [x, y] of ring) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  const boxes = slopes.map(t => [Math.min(t.p[0][0], t.p[1][0], t.p[2][0]), Math.min(t.p[0][1], t.p[1][1], t.p[2][1]), Math.max(t.p[0][0], t.p[1][0], t.p[2][0]), Math.max(t.p[0][1], t.p[1][1], t.p[2][1])]);
  let total = 0, bare = 0;
  for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
    const x = xmin + ((i + 0.5) / grid) * (xmax - xmin), y = ymin + ((j + 0.5) / grid) * (ymax - ymin);
    if (!inRing(x, y, ring)) continue;
    total++;
    let covered = false;
    for (let k = 0; k < slopes.length && !covered; k++) {
      const b = boxes[k];
      if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && inTri(x, y, slopes[k].p)) covered = true;
    }
    if (!covered) bare++;
  }
  const bareDeckShare = total ? bare / total : 0;
  const bareDeckM2 = bareDeckShare * ringArea(ring);

  const flags: AttachmentFlag[] = [];
  if (verticalGapM > VERTICAL_TOL_M || verticalGapM < -SINK_TOL_M) flags.push('vertical');
  if (hangM > HANG_TOL_M) flags.push('hang');
  if (hasLid && bareDeckShare >= BARE_DECK_SHARE && bareDeckM2 >= BARE_DECK_MIN_M2) flags.push('bare-deck');
  return { verticalGapM, lowestVertexGapM, hangM, hangAreaShare, bareDeckShare, bareDeckM2, flags };
}
