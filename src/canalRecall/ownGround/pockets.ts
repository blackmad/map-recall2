// Land pockets at junctions (pure): small patches of bare land a cell's own
// street, area, park, water and deck layers enclose on every side, near a
// junction. The Rozengracht × Marnixstraat corners (lane belt audit
// 2026-10-14) had them where three or four sidewalks of different ways, mapped
// separately or on dual carriageways, stop short of each other: the land grid
// showed through as a dark patch on a pavement the BGT surveys as voetpad.
//
// The cell's layers are rasterised at POCKET_RES_M (a pixel is covered when
// its centre is inside a triangle); 4-connected uncovered components that do
// not touch the cell's edge (they may run on into the neighbour), are at most
// POCKET_MAX_M2 and whose centroid lies within POCKET_NEAR_M of a junction
// node are paved, row by row, under every band (the fill's lift is the OSM
// areas'). Measured on the BGT wegdeel survey around the junction: see
// scripts/own-ground/check-ground-cells.ts (named regression) and HISTORY.

import { drapeTriangles, emptyMesh, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';

export const POCKET_RES_M = 0.5;
/** Largest pocket paved, m² (offline on the BGT: pockets up to 40 m² at the Rozengracht junction are 83 % wegdeel). */
export const POCKET_MAX_M2 = 40;
/** A pocket's centroid within this of a junction node. */
export const POCKET_NEAR_M = 30;

/**
 * The fill's lift over the land: 5 mm, so every band (carriageway 0.03) clears it by ≥ 2.5 cm and wins the depth
 * test where a pixel's square reaches under a band's edge (up to half a pixel); it wins the land by its draw rank.
 */
export const POCKET_LIFT = 0.005;

export interface PocketStats { pockets: number; m2: number; pixels: number; ms: number; skipped: number; /** roads-v1 survey-gap discs paved, and their m². */ gaps?: number; gapM2?: number }

/**
 * roads-v1: a junction node in a gap of the BGT survey (no wegdeel under it: Nieuwmarkt, a plein the survey files as
 * terrain) and the reach the band model paved around it. The covered ways there emit no bands, so the land the
 * bands used to pave showed; the pocket pass paves the bare land inside the disc again, whatever its size, with
 * the surface the covered pixels in the disc vote for.
 */
export interface SurveyGap { p: Vec2; r: number }
/**
 * Smallest survey-gap disc radius, metres: the arms' bands ran on into the gap past the junction's own reach (the
 * Nieuwmarkt nodes: 4–5 m reach, land showing 6–10 m out along the arms where the bands paved).
 */
export const SURVEY_GAP_MIN_R = 10;
/** Largest survey-gap disc radius, metres (a wide junction's reach; the band model's corner patches stop near it). */
export const SURVEY_GAP_MAX_R = 12;

/** A layer that hides the land, and the surface a pocket it borders would take (null: it does not vote for a fill). */
export interface PocketCover<S extends string> { meshes: readonly MeshArrays[]; as: S | null }

/**
 * Fill the land pockets of a cell: `cover` are the meshes that hide the land
 * (positions in scene metres), `rect` the cell rectangle, `junctions` the
 * junction nodes of the neighbourhood. A pocket takes the surface most of its
 * border votes for (a gap between sidewalks is paving, a sliver inside a
 * junction asphalt); a pocket mostly bordered by layers that do not vote
 * (water, a park) stays land. Each pixel row run is grown by half a pixel all
 * round so no sliver of land is left under the bands' edges (the fill lies
 * under them). Returns a mesh per surface and what it did.
 */
export function fillPockets<S extends string>(cover: readonly PocketCover<S>[], rect: readonly [number, number, number, number], junctions: readonly Vec2[], height: HeightFn, lift: number, opts: { res?: number; maxM2?: number; nearM?: number; gaps?: readonly SurveyGap[] } = {}): { meshes: Partial<Record<S, MeshArrays>>; stats: PocketStats } {
  const t0 = Date.now();
  const res = opts.res ?? POCKET_RES_M, maxM2 = opts.maxM2 ?? POCKET_MAX_M2, nearM = opts.nearM ?? POCKET_NEAR_M;
  const [x0, y0, x1, y1] = rect;
  const W = Math.ceil((x1 - x0) / res), H = Math.ceil((y1 - y0) / res);
  // 0 bare land, 1..253 the cover entry (1-based, the last drawn wins), 255 visited land.
  if (cover.length > 253) throw new Error('pockets: too many cover meshes');
  const meshes: Partial<Record<S, MeshArrays>> = {};
  const stats: PocketStats = { pockets: 0, m2: 0, pixels: 0, ms: 0, skipped: 0 };
  // No junction, no seed: nothing to rasterise (roads-v1 cells drop the junctions on the survey).
  const gaps = opts.gaps ?? [];
  if (!junctions.length && !gaps.length) { stats.ms = Date.now() - t0; return { meshes, stats }; }
  const raster = new Uint8Array(W * H);
  const votes = cover.map(c => c.as);
  cover.forEach((c, k) => { for (const m of c.meshes) rasterise(m, raster, k + 1, x0, y0, W, H, res); });
  const grow = res / 2;
  /** Pave sorted pixel indices as row runs, each grown by half a pixel all round. */
  const pave = (as: S, members: number[]): void => {
    const mesh = (meshes[as] ??= emptyMesh());
    members.sort((a, b) => a - b);
    for (let k = 0; k < members.length;) {
      const p = members[k], j = Math.floor(p / W), i0 = p - j * W;
      let i1 = i0;
      while (k + 1 < members.length && members[k + 1] === members[k] + 1 && Math.floor(members[k + 1] / W) === j) { k++; i1++; }
      k++;
      const ax = x0 + i0 * res - grow, bx = x0 + (i1 + 1) * res + grow, ay = y0 + j * res - grow, by = y0 + (j + 1) * res + grow;
      drapeTriangles(mesh, [ax, ay, bx, ay, bx, by, ax, by], [0, 1, 2, 0, 2, 3], height, lift, 4);
    }
  };
  // Survey-gap discs first: their bare pixels are paved and taken out of the pocket flood (marked visited).
  for (const g of gaps) {
    const r = Math.min(g.r, SURVEY_GAP_MAX_R);
    const i0 = Math.max(0, Math.floor((g.p[0] - r - x0) / res)), i1 = Math.min(W - 1, Math.floor((g.p[0] + r - x0) / res));
    const j0 = Math.max(0, Math.floor((g.p[1] - r - y0) / res)), j1 = Math.min(H - 1, Math.floor((g.p[1] + r - y0) / res));
    const tally = new Map<S | null, number>(), bare: number[] = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = x0 + (i + 0.5) * res, cy = y0 + (j + 0.5) * res;
      if ((cx - g.p[0]) ** 2 + (cy - g.p[1]) ** 2 > r * r) continue;
      const v = raster[j * W + i];
      if (v === 0) bare.push(j * W + i);
      else if (v <= cover.length) tally.set(votes[v - 1], (tally.get(votes[v - 1]) ?? 0) + 1);
    }
    if (!bare.length) continue;
    let as: S | null = null, best = 0;
    for (const [sv, c] of tally) if (sv !== null && c > best) { best = c; as = sv; }
    // A disc mostly over water or a park (votes null) stays land.
    if (as === null || best < (tally.get(null) ?? 0)) { stats.skipped++; continue; }
    for (const p of bare) raster[p] = 255;
    pave(as, bare);
    stats.gaps = (stats.gaps ?? 0) + 1; stats.gapM2 = (stats.gapM2 ?? 0) + bare.length * res * res;
  }
  const G = nearM, hash = new Map<string, Vec2[]>();
  for (const j of junctions) { const k = `${Math.floor(j[0] / G)}:${Math.floor(j[1] / G)}`; (hash.get(k) ?? hash.set(k, []).get(k)!).push(j); }
  const nearJunction = (x: number, y: number) => {
    const gx = Math.floor(x / G), gy = Math.floor(y / G);
    for (let a = gx - 1; a <= gx + 1; a++) for (let b = gy - 1; b <= gy + 1; b++) for (const j of hash.get(`${a}:${b}`) ?? []) if (Math.hypot(j[0] - x, j[1] - y) <= nearM) return true;
    return false;
  };
  const maxPx = Math.floor(maxM2 / (res * res));
  // Seeds only near a junction (8 m blocks within nearM + 8 m of one); a flood stops as soon as its component is
  // too big, touches the cell edge or meets a component already found too big (BIG), and marks what it saw BIG.
  const B = 8, bw = Math.ceil(W * res / B), bh = Math.ceil(H * res / B), seedBlock = new Uint8Array(bw * bh);
  for (const [jx, jy] of junctions) {
    const r = nearM + B;
    for (let by = Math.max(0, Math.floor((jy - r - y0) / B)); by <= Math.min(bh - 1, Math.floor((jy + r - y0) / B)); by++) for (let bx = Math.max(0, Math.floor((jx - r - x0) / B)); bx <= Math.min(bw - 1, Math.floor((jx + r - x0) / B)); bx++) seedBlock[by * bw + bx] = 1;
  }
  const BIG = 254, SEEN = 255;
  const stack = new Int32Array(maxPx * 4 + 8), tallies = new Int32Array(cover.length), members: number[] = [];
  const bp = Math.round(B / res);
  for (let blk = 0; blk < bw * bh; blk++) if (seedBlock[blk]) for (let sj = Math.floor(blk / bw) * bp, sj1 = Math.min(H, sj + bp); sj < sj1; sj++) for (let si = (blk % bw) * bp, si1 = Math.min(W, si + bp); si < si1; si++) {
    const start = sj * W + si;
    if (raster[start]) continue;
    let n = 0, sx = 0, sy = 0, top = 0, big = false;
    members.length = 0;
    tallies.fill(0);
    stack[top++] = start; raster[start] = SEEN;
    while (top && !big) {
      const p = stack[--top], i = p % W, j = (p - i) / W;
      n++; sx += i; sy += j; members.push(p);
      if (n > maxPx || i === 0 || j === 0 || i === W - 1 || j === H - 1) { big = true; break; }
      for (let d = 0; d < 4; d++) {
        const q = d === 0 ? p - 1 : d === 1 ? p + 1 : d === 2 ? p - W : p + W;
        const v = raster[q];
        if (v === 0) { raster[q] = SEEN; stack[top++] = q; } else if (v === BIG) { big = true; break; } else if (v !== SEEN) tallies[v - 1]++;
      }
    }
    if (big) { for (const p of members) raster[p] = BIG; for (let k = 0; k < top; k++) raster[stack[k]] = BIG; continue; }
    if (!nearJunction(x0 + (sx / n + 0.5) * res, y0 + (sy / n + 0.5) * res)) continue;
    const tally = new Map<S | null, number>();
    tallies.forEach((c, k) => { if (c) tally.set(votes[k], (tally.get(votes[k]) ?? 0) + c); });
    let as: S | null = null, best = 0;
    for (const [s, c] of tally) if (c > best) { best = c; as = s; }
    if (as === null) { stats.skipped++; continue; }
    pave(as, members);
    stats.pockets++; stats.pixels += n; stats.m2 += n * res * res;
  }
  stats.ms = Date.now() - t0;
  return { meshes, stats };
}

/** Mark every pixel whose centre lies inside one of the mesh's triangles. */
function rasterise(m: MeshArrays, out: Uint8Array, code: number, x0: number, y0: number, W: number, H: number, res: number): void {
  const p = m.positions, idx = m.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ax = (p[a] - x0) / res - 0.5, ay = (p[a + 1] - y0) / res - 0.5, bx = (p[b] - x0) / res - 0.5, by = (p[b + 1] - y0) / res - 0.5, cx = (p[c] - x0) / res - 0.5, cy = (p[c + 1] - y0) / res - 0.5;
    const i0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))), i1 = Math.min(W - 1, Math.floor(Math.max(ax, bx, cx)));
    const j0 = Math.max(0, Math.ceil(Math.min(ay, by, cy))), j1 = Math.min(H - 1, Math.floor(Math.max(ay, by, cy)));
    if (i0 > i1 || j0 > j1) continue;
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(d) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const u = ((by - cy) * (i - cx) + (cx - bx) * (j - cy)) / d, v = ((cy - ay) * (i - cx) + (ax - cx) * (j - cy)) / d;
      if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) out[j * W + i] = code;
    }
  }
}
