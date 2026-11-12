// Ground v2 pose index (lane G2a #372; design "The riding surface"): the rider stands on what is drawn. A bucket grid
// over the baked surface triangles answers the drawn height under a point. G2b wires it into surface.ts riderPose /
// footprintBase; G2a lands it and measures its cost (bake hand-back).
//
// Compact (round 2, budget ≤ 1.5 MB per LOD 0 cell): it keeps the quantised vertices, not Float32 positions and Uint32
// indices (round 1: 10.4 MB at p50). Vertices are renumbered bucket by bucket (row-major), so a triangle's vertices
// lie close in the new order; each bucket stores its triangles as three u16 offsets from the bucket's lowest vertex
// id. A bucket whose triangles span more than 65,535 ids (none in the first bakes) keeps them as u32 in a side table.
// Bytes: 6 per surface vertex (u, v, z above the cell's base, all u16) + 6 per bucket entry + 8 per bucket.
//
// Pure: decoded GRD2 (groundV2Format.decodeGrd2) in, no THREE, no DOM.

import { GRID_Q, isSurfaceGroup, type Grd2Decoded } from './groundV2Format.js';
import type { Rect } from './groundStore.js';

/** Bucket side, metres. Round 2 on -4_-3: 8 m 2.50 MB / 0.33 µs a query, 16 m 1.91 MB / 0.44 µs, 32 m 1.65 MB. */
export const POSE_BUCKET_M = 16;
const WIDE = 0xffffffff;

export interface PoseIndex {
  rect: Rect; bucketM: number; nx: number; ny: number;
  /** Per pose vertex: u, v (the file's u16 grid), z in mm above zBaseMm. */
  u: Uint16Array; v: Uint16Array; z: Uint16Array; zBaseMm: number;
  /** CSR over buckets: bucket b's entries are [start[b], start[b + 1]); base[b] their lowest vertex id (WIDE: in `wide`). */
  start: Uint32Array; base: Uint32Array;
  /** 3 u16 offsets per entry. */
  tri: Uint16Array;
  /** Wide buckets: bucket → 3 u32 vertex ids per entry. */
  wide: Map<number, Uint32Array>;
}

/** Build from a decoded cell: its surface triangles only (step strips, kind 1, are vertical and never stood on). */
export function buildPoseIndex(dec: Grd2Decoded, bucketM = POSE_BUCKET_M): PoseIndex {
  const rect = dec.header.rect, W = rect[2] - rect[0], H = rect[3] - rect[1];
  const nx = Math.ceil(W / bucketM), ny = Math.ceil(H / bucketM), NB = nx * ny;
  const mPerU = W / GRID_Q, mPerV = H / GRID_Q;
  const bi = (u: number) => Math.min(nx - 1, Math.floor((u * mPerU) / bucketM)), bj = (v: number) => Math.min(ny - 1, Math.floor((v * mPerV) / bucketM));
  // Surface triangles and the vertices they use.
  const tris: number[] = [];
  for (const g of dec.groups) if (isSurfaceGroup(g)) for (let t = g.first; t < g.first + g.count; t++) tris.push(t);
  const used = new Uint8Array(dec.u.length);
  for (const t of tris) { used[dec.indices[3 * t]] = 1; used[dec.indices[3 * t + 1]] = 1; used[dec.indices[3 * t + 2]] = 1; }
  // Renumber bucket-major (stable within a bucket: old id order).
  const old: number[] = [];
  for (let i = 0; i < used.length; i++) if (used[i]) old.push(i);
  const bucketOf = (i: number) => bj(dec.v[i]) * nx + bi(dec.u[i]);
  old.sort((p, q) => bucketOf(p) - bucketOf(q) || p - q);
  const nid = new Int32Array(dec.u.length).fill(-1);
  const V = old.length, u = new Uint16Array(V), v = new Uint16Array(V), z = new Uint16Array(V);
  let zMin = Infinity;
  for (const i of old) if (dec.zMm[i] < zMin) zMin = dec.zMm[i];
  if (!V) zMin = 0;
  old.forEach((i, n) => { nid[i] = n; u[n] = dec.u[i]; v[n] = dec.v[i]; z[n] = Math.min(65535, dec.zMm[i] - zMin); });
  // Entries: each triangle in every bucket it overlaps (separating axes: a long diagonal triangle's bbox covers many
  // buckets it never touches; bbox-only entries were 2.3 per triangle on -4_-3, exact ones fewer).
  const count = new Uint32Array(NB + 1), lo = new Uint32Array(NB).fill(WIDE), hi = new Uint32Array(NB);
  const bu = bucketM / mPerU, bv = bucketM / mPerV; // bucket size in grid units
  const each = (t: number, f: (b: number) => void) => {
    const a = dec.indices[3 * t], b = dec.indices[3 * t + 1], c = dec.indices[3 * t + 2];
    const xs = [dec.u[a], dec.u[b], dec.u[c]], ys = [dec.v[a], dec.v[b], dec.v[c]];
    const i0 = bi(Math.min(xs[0], xs[1], xs[2])), i1 = bi(Math.max(xs[0], xs[1], xs[2]));
    const j0 = bj(Math.min(ys[0], ys[1], ys[2])), j1 = bj(Math.max(ys[0], ys[1], ys[2]));
    if (i0 === i1 && j0 === j1) { f(j0 * nx + i0); return; }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      // The triangle's edge normals as separating axes (the box axes are the bbox loop's).
      const x0 = i * bu, y0 = j * bv, x1 = (i + 1) * bu, y1 = (j + 1) * bv;
      let apart = false;
      for (let e = 0; e < 3 && !apart; e++) {
        const px = xs[e], py = ys[e], qx = xs[(e + 1) % 3], qy = ys[(e + 1) % 3], rx = xs[(e + 2) % 3], ry = ys[(e + 2) % 3];
        const nx2 = qy - py, ny2 = px - qx, tri0 = nx2 * px + ny2 * py, triR = nx2 * rx + ny2 * ry;
        const tMin = Math.min(tri0, triR), tMax = Math.max(tri0, triR);
        const c0 = nx2 * x0 + ny2 * y0, c1 = nx2 * x1 + ny2 * y0, c2 = nx2 * x0 + ny2 * y1, c3 = nx2 * x1 + ny2 * y1;
        if (Math.max(c0, c1, c2, c3) < tMin || Math.min(c0, c1, c2, c3) > tMax) apart = true;
      }
      if (!apart) f(j * nx + i);
    }
  };
  for (const t of tris) {
    const p = nid[dec.indices[3 * t]], q = nid[dec.indices[3 * t + 1]], r = nid[dec.indices[3 * t + 2]];
    const m0 = Math.min(p, q, r), m1 = Math.max(p, q, r);
    each(t, b => { count[b + 1]++; if (m0 < lo[b]) lo[b] = m0; if (m1 > hi[b]) hi[b] = m1; });
  }
  const base = new Uint32Array(NB), wideCount = new Map<number, number>();
  for (let b = 0; b < NB; b++) {
    if (lo[b] === WIDE) { base[b] = 0; continue; }
    if (hi[b] - lo[b] > 65535) { base[b] = WIDE; wideCount.set(b, count[b + 1]); count[b + 1] = 0; } else base[b] = lo[b];
  }
  for (let b = 0; b < NB; b++) count[b + 1] += count[b];
  const tri = new Uint16Array(count[NB] * 3), fill = count.slice(0, NB);
  const wide = new Map<number, Uint32Array>(), wideFill = new Map<number, number>();
  for (const [b, n] of wideCount) { wide.set(b, new Uint32Array(n * 3)); wideFill.set(b, 0); }
  for (const t of tris) {
    const p = nid[dec.indices[3 * t]], q = nid[dec.indices[3 * t + 1]], r = nid[dec.indices[3 * t + 2]];
    each(t, b => {
      if (base[b] === WIDE) { const w = wide.get(b)!, k = wideFill.get(b)!; w[k] = p; w[k + 1] = q; w[k + 2] = r; wideFill.set(b, k + 3); return; }
      const k = 3 * fill[b]++; tri[k] = p - base[b]; tri[k + 1] = q - base[b]; tri[k + 2] = r - base[b];
    });
  }
  return { rect, bucketM, nx, ny, u, v, z, zBaseMm: zMin, start: count, base, tri, wide };
}

/** The drawn height at (x, y) (game frame, metres), or NaN off the baked surface (water, outside the cell): the caller falls back. */
export function poseHeight(p: PoseIndex, x: number, y: number): number {
  const { rect } = p, W = rect[2] - rect[0], H = rect[3] - rect[1];
  if (!(x >= rect[0] && y >= rect[1] && x <= rect[2] && y <= rect[3])) return NaN;
  const i = Math.min(p.nx - 1, Math.floor((x - rect[0]) / p.bucketM)), j = Math.min(p.ny - 1, Math.floor((y - rect[1]) / p.bucketM)), b = j * p.nx + i;
  // In grid units, as the vertices are stored.
  const qx = ((x - rect[0]) / W) * GRID_Q, qy = ((y - rect[1]) / H) * GRID_Q;
  const at = (a: number, bb: number, c: number): number => {
    const ax = p.u[a], ay = p.v[a], bx = p.u[bb], by = p.v[bb], cx = p.u[c], cy = p.v[c];
    const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (!d) return NaN;
    const w1 = ((bx - qx) * (cy - qy) - (cx - qx) * (by - qy)) / d, w2 = ((cx - qx) * (ay - qy) - (ax - qx) * (cy - qy)) / d, w3 = 1 - w1 - w2;
    if (w1 < -1e-9 || w2 < -1e-9 || w3 < -1e-9) return NaN;
    return (p.zBaseMm + w1 * p.z[a] + w2 * p.z[bb] + w3 * p.z[c]) / 1000;
  };
  if (p.base[b] === WIDE) {
    const w = p.wide.get(b);
    if (w) for (let k = 0; k < w.length; k += 3) { const h = at(w[k], w[k + 1], w[k + 2]); if (h === h) return h; }
    return NaN;
  }
  const o = p.base[b];
  for (let k = 3 * p.start[b]; k < 3 * p.start[b + 1]; k += 3) { const h = at(o + p.tri[k], o + p.tri[k + 1], o + p.tri[k + 2]); if (h === h) return h; }
  return NaN;
}

/** CPU bytes the index keeps. */
export function poseIndexBytes(p: PoseIndex): number {
  let w = 0; for (const a of p.wide.values()) w += a.byteLength;
  return p.u.byteLength + p.v.byteLength + p.z.byteLength + p.start.byteLength + p.base.byteLength + p.tri.byteLength + w;
}
