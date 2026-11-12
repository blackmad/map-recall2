// Ground v2 audit (lane G2a #372): the plan's G0 measures read on baked GRD2 cells, plus the seam comparison.
// Design docs/handoffs/ground-v2-design-20261110.md, "Gates". Pure: decoded cells in, numbers out.
//
//   sliver       surface triangle with aspect > 20 and area > 0.05 m² (G0's definition), split by what is beside it:
//                internal: the same layer at the same level across all three edges (a triangulation detail: shared
//                vertices and world-space uv = position.xy draw it like any other triangulation of the region);
//                edge: the same layer and level across at least one of its two long edges (the material continues);
//                strip: neither long edge has the same layer and level beside it (the material is this triangle wide)
//   overlap      plan area where two surface triangles cover the same point (a partition has none):
//                z-fight when their heights there are within ±5 mm (and layers differ), poke-through when apart by more
//   crack        plan area no surface triangle covers, off the water
//   float        surface height minus (relief + the level's lift), sampled; p99.9, max, area over 5 cm and over 10 cm,
//                off the step lines: a sample within stepLineM of a step strip's plan line (a kerb or wall the mesh draws
//                as a vertical face, where 2 m AHN smears the same step over a metre) is counted apart (floatStep*)
//   seams        every seam vertex (u or v at the edge, z, normal) identical to the neighbour's, per baked pair

import type { Rect } from './groundStore.js';
import { GRID_Q, unitX, unitY, type Grd2Decoded } from './groundV2Format.js';

export interface AuditInput {
  cell: Grd2Decoded;
  relief: (x: number, y: number) => number;
  /** True inside open water (a hole, not a crack). */
  water: (x: number, y: number) => boolean;
  /** Lift per level (groundV2Sources V2_LEVEL_Z); a vertex's level is recovered as the lift nearest its height over the relief. */
  levelZ: readonly number[];
  /** Sample spacing, metres (default 0.5). */
  step?: number;
  /** Only this disc (game frame, metres): a named place's window. Triangles count by centroid, samples by position. */
  window?: { x: number; y: number; r: number };
  /** Float samples this close to a step strip's plan line are the step's, not the surface's (default STEP_LINE_M). */
  stepLineM?: number;
}

/** The float gate's step-line band, metres: half the 2 m AHN cell the relief is read from (a step smears over it). */
export const STEP_LINE_M = 1;

export interface CellAudit {
  slivers: number; sliverM2: number; sliversByLayer: Record<string, number>;
  /** Slivers by what is beside them (see the header): internal + edge + strip = slivers. */
  sliversInternal: number; sliversEdge: number; sliversStrip: number; stripAt: [number, number, string][];
  overlapM2: number; zFightM2: number; pokeM2: number;
  crackM2: number; crackAt: [number, number][];
  /** Uncovered within 5 cm of the water: the shoreline on the 15 mm grid. */
  shoreM2: number;
  /** Off the step lines (the gate). */
  floatP999Mm: number; floatMaxMm: number; floatOver5cmM2: number; floatOver10cmM2: number;
  /** Within stepLineM of a step line: reported, not gated. */
  floatStepOver5cmM2: number; floatStepMaxMm: number;
  /** Where the float exceeds 10 cm (first few, game frame). */
  floatAt: [number, number, number][];
  triangles: number; stepTriangles: number;
}

/** Sample the cell's surface triangles on a grid offset off any round coordinate (no sample sits on a shared edge). */
export function auditCell(a: AuditInput): CellAudit {
  const { cell } = a, rect = cell.header.rect, step = a.step ?? 0.5, w = a.window;
  const inWin = (x: number, y: number) => !w || (x - w.x) ** 2 + (y - w.y) ** 2 <= w.r * w.r;
  const nx = Math.ceil((rect[2] - rect[0]) / step), ny = Math.ceil((rect[3] - rect[1]) / step);
  const cover = new Uint8Array(nx * ny), zAt = new Float32Array(nx * ny), layerAt = new Uint8Array(nx * ny);
  const over = new Uint8Array(nx * ny); // 1 z-fight, 2 poke
  const ox = 0.1237 * step, oy = 0.3719 * step;
  const X = new Float64Array(cell.u.length), Y = new Float64Array(cell.u.length);
  for (let i = 0; i < cell.u.length; i++) { X[i] = unitX(rect, cell.u[i]); Y[i] = unitY(rect, cell.v[i]); }
  let slivers = 0, sliverM2 = 0, triangles = 0, stepTriangles = 0; const sliversByLayer: Record<string, number> = {};
  // Plan adjacency of the surface triangles: edge (by vertex ids, so another level's copy is not "beside") → triangles.
  const edgeTris = new Map<number, number[]>(), layerOfTri = new Map<number, string>();
  const ek = (p: number, q: number) => (p < q ? p * 4294967296 + q : q * 4294967296 + p);
  for (const g of cell.groups) if (g.kind === 0) for (let t = g.first; t < g.first + g.count; t++) {
    layerOfTri.set(t, g.layer);
    for (let j = 0; j < 3; j++) { const k = ek(cell.indices[3 * t + j], cell.indices[3 * t + (j + 1) % 3]); const l = edgeTris.get(k); if (l) l.push(t); else edgeTris.set(k, [t]); }
  }
  const sameBeside = (t: number, p: number, q: number) => (edgeTris.get(ek(p, q)) ?? []).some(o => o !== t && layerOfTri.get(o) === layerOfTri.get(t));
  let sliversInternal = 0, sliversEdge = 0, sliversStrip = 0; const stripAt: [number, number, string][] = [];
  for (const g of cell.groups) {
    if (g.kind === 1) { stepTriangles += g.count; continue; }
    for (let t = g.first; t < g.first + g.count; t++) {
      const i0 = cell.indices[3 * t], i1 = cell.indices[3 * t + 1], i2 = cell.indices[3 * t + 2];
      const ax = X[i0], ay = Y[i0], bx = X[i1], by = Y[i1], cx = X[i2], cy = Y[i2];
      const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay), area = Math.abs(d) / 2;
      const inside = inWin((ax + bx + cx) / 3, (ay + by + cy) / 3);
      if (inside) triangles++;
      const l = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(cx - bx, cy - by), Math.hypot(ax - cx, ay - cy));
      if (inside && area > 0.05 && (l * l) / (2 * area) > 20) {
        slivers++; sliverM2 += area; sliversByLayer[g.layer] = (sliversByLayer[g.layer] ?? 0) + 1;
        const e = [[i0, i1], [i1, i2], [i2, i0]].map(([p, q]) => ({ p, q, l: Math.hypot(X[q] - X[p], Y[q] - Y[p]), same: sameBeside(t, p, q) })).sort((m, n) => n.l - m.l);
        if (e.every(x => x.same)) sliversInternal++;
        else if (e[0].same || e[1].same) sliversEdge++;
        else { sliversStrip++; if (stripAt.length < 50) stripAt.push([+((ax + bx + cx) / 3).toFixed(2), +((ay + by + cy) / 3).toFixed(2), g.layer]); }
      }
      if (d === 0) continue;
      const za = cell.zMm[i0] / 1000, zb = cell.zMm[i1] / 1000, zc = cell.zMm[i2] / 1000;
      const gx0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - rect[0] - ox) / step)), gx1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - rect[0] - ox) / step));
      const gy0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - rect[1] - oy) / step)), gy1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) - rect[1] - oy) / step));
      const layer = (g.layer.length * 31 + g.layer.charCodeAt(0)) & 255;
      for (let j = gy0; j <= gy1; j++) for (let i = gx0; i <= gx1; i++) {
        const px = rect[0] + ox + i * step, py = rect[1] + oy + j * step;
        const w1 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d, w2 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d, w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        const z = w1 * za + w2 * zb + w3 * zc, k = j * nx + i;
        if (cover[k]) { if (Math.abs(z - zAt[k]) <= 0.005) { if (layerAt[k] !== layer) over[k] |= 1; } else over[k] |= 2; }
        else { zAt[k] = z; layerAt[k] = layer; }
        if (cover[k] < 255) cover[k]++;
      }
    }
  }
  // Step lines: each step triangle's plan footprint is a segment (its vertices project onto two points).
  const stepM = a.stepLineM ?? STEP_LINE_M, nearStep = new Uint8Array(nx * ny);
  for (const g of cell.groups) {
    if (g.kind !== 1) continue;
    for (let t = g.first; t < g.first + g.count; t++) {
      const ids = [cell.indices[3 * t], cell.indices[3 * t + 1], cell.indices[3 * t + 2]];
      let p = ids[0], q = ids[1]; if (X[p] === X[q] && Y[p] === Y[q]) q = ids[2];
      const px0 = X[p], py0 = Y[p], dx = X[q] - px0, dy = Y[q] - py0, L2 = dx * dx + dy * dy || 1;
      const i0 = Math.max(0, Math.floor((Math.min(px0, px0 + dx) - stepM - rect[0] - ox) / step)), i1 = Math.min(nx - 1, Math.ceil((Math.max(px0, px0 + dx) + stepM - rect[0] - ox) / step));
      const j0 = Math.max(0, Math.floor((Math.min(py0, py0 + dy) - stepM - rect[1] - oy) / step)), j1 = Math.min(ny - 1, Math.ceil((Math.max(py0, py0 + dy) + stepM - rect[1] - oy) / step));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const sx = rect[0] + ox + i * step - px0, sy = rect[1] + oy + j * step - py0, tt = Math.max(0, Math.min(1, (sx * dx + sy * dy) / L2));
        if ((sx - tt * dx) ** 2 + (sy - tt * dy) ** 2 <= stepM * stepM) nearStep[j * nx + i] = 1;
      }
    }
  }
  let fs5 = 0, fsMax = 0;
  const cellA = step * step;
  let overlapM2 = 0, zFightM2 = 0, pokeM2 = 0, crackM2 = 0, shoreM2 = 0, f5 = 0, f10 = 0; const crackAt: [number, number][] = [], floatAt: [number, number, number][] = [];
  const floats: number[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, px = rect[0] + ox + i * step, py = rect[1] + oy + j * step;
    if (px >= rect[2] || py >= rect[3] || !inWin(px, py)) continue;
    if (!cover[k]) {
      if (a.water(px, py)) continue;
      // Within 5 cm of the water: the shore moved by the 15 mm grid (the hole's edge), not a crack.
      if ([[0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]].some(([dx, dy]) => a.water(px + dx, py + dy))) { shoreM2 += cellA; continue; }
      crackM2 += cellA; if (crackAt.length < 20) crackAt.push([+px.toFixed(2), +py.toFixed(2)]);
      continue;
    }
    if (cover[k] > 1) { overlapM2 += cellA; if (over[k] & 1) zFightM2 += cellA; if (over[k] & 2) pokeM2 += cellA; }
    const r = a.relief(px, py); if (r !== r) continue;
    const dz = zAt[k] - r;
    // The level: the lift nearest the drawn height over the relief.
    let lift = a.levelZ[0]; for (const L of a.levelZ) if (Math.abs(dz - L) < Math.abs(dz - lift)) lift = L;
    const f = Math.abs(dz - lift);
    if (nearStep[k]) { if (f > 0.05) fs5 += cellA; if (f > fsMax) fsMax = f; continue; }
    floats.push(f);
    if (f > 0.05) f5 += cellA;
    if (f > 0.10) { f10 += cellA; if (floatAt.length < 20) floatAt.push([+px.toFixed(1), +py.toFixed(1), Math.round(f * 1000)]); }
  }
  floats.sort((p, q) => p - q);
  return {
    slivers, sliverM2: +sliverM2.toFixed(2), sliversByLayer, sliversInternal, sliversEdge, sliversStrip, stripAt, overlapM2, zFightM2, pokeM2, crackM2, shoreM2, crackAt,
    floatP999Mm: floats.length ? Math.round(floats[Math.floor(floats.length * 0.999)] * 1000) : 0, floatMaxMm: floats.length ? Math.round(floats[floats.length - 1] * 1000) : 0,
    floatOver5cmM2: f5, floatOver10cmM2: f10, floatAt, floatStepOver5cmM2: fs5, floatStepMaxMm: Math.round(fsMax * 1000), triangles, stepTriangles,
  };
}

export interface SeamResult { a: string; b: string; side: 'east' | 'north'; vertices: number; equal: number; firstDiff?: string }

/**
 * The vertices on a side's seam edges: a surface triangle edge lying along the side (both ends on it). A vertex that
 * only touches the side at a triangle's corner, where both cells are water along the side, carries no shared edge:
 * the neighbour may rightly not hold it (first audit, -4_0 | -3_0 at a canal edge 3 cm off the 2 m seam grid).
 */
export function seamEdgeVertices(c: Grd2Decoded, s: number): number[] {
  const on = (i: number) => (s === 0 ? c.u[i] === 0 : s === 1 ? c.u[i] === GRID_Q : s === 2 ? c.v[i] === 0 : c.v[i] === GRID_Q);
  const out = new Set<number>();
  for (const g of c.groups) {
    if (g.kind !== 0) continue;
    for (let t = g.first; t < g.first + g.count; t++) for (let j = 0; j < 3; j++) {
      const p = c.indices[3 * t + j], q = c.indices[3 * t + (j + 1) % 3];
      if (on(p) && on(q)) { out.add(p); out.add(q); }
    }
  }
  return [...out];
}

/** Compare A's east (or north) seam edges with B's west (or south): the sorted (along, z, normal) lists must be identical. */
export function compareSeam(a: Grd2Decoded, b: Grd2Decoded, side: 'east' | 'north', keys: [string, string]): SeamResult {
  const list = (c: Grd2Decoded, s: number, along: 'u' | 'v') => seamEdgeVertices(c, s).map(i => `${c[along][i]}:${c.zMm[i]}:${c.oct[2 * i]},${c.oct[2 * i + 1]}`).sort();
  const la = side === 'east' ? list(a, 1, 'v') : list(a, 3, 'u'), lb = side === 'east' ? list(b, 0, 'v') : list(b, 2, 'u');
  let equal = 0, firstDiff: string | undefined; const sb = new Set(lb);
  for (const x of la) { if (sb.has(x)) equal++; else if (!firstDiff) firstDiff = `${keys[0]} has ${x}`; }
  if (!firstDiff && la.length !== lb.length) firstDiff = `count ${la.length} vs ${lb.length}`;
  if (!firstDiff) { const sa = new Set(la); const miss = lb.find(x => !sa.has(x)); if (miss) firstDiff = `${keys[1]} has ${miss}`; }
  return { a: keys[0], b: keys[1], side, vertices: Math.max(la.length, lb.length), equal, ...(firstDiff ? { firstDiff } : {}) };
}

/** The neighbour pairs among a set of keys: [a, b, side] with b east or north of a. */
export function seamPairs(keys: readonly string[]): [string, string, 'east' | 'north'][] {
  const set = new Set(keys), out: [string, string, 'east' | 'north'][] = [];
  for (const k of [...keys].sort()) { const [x, y] = k.split('_').map(Number); if (set.has(`${x + 1}_${y}`)) out.push([k, `${x + 1}_${y}`, 'east']); if (set.has(`${x}_${y + 1}`)) out.push([k, `${x}_${y + 1}`, 'north']); }
  return out;
}

export const rectContains = (r: Rect, x: number, y: number) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
export { GRID_Q };
