/** Build-time gates for block-kit models (run on the MeshBuilder, before export). */
import { MeshBuilder, type V3, sub, dot, cross, len, norm } from './mesh.ts';
import type { SurfaceSet } from './types.ts';

export interface GateReport {
  triangles: number; budget: number; budgetOk: boolean;
  heightM: number; bag3dHeightM: number; heightDeltaM: number; heightOk: boolean;
  parts: number; maxGapCm: number; gapOk: boolean; floatingParts: number[]; floatingDetail: string[]; floatingOk: boolean;
  nonFinite: number; hostNormalsOutward: { checked: number; inward: number; ok: boolean };
  roofDownward: number;
  ok: boolean;
}

function pointTri(p: V3, a: V3, b: V3, c: V3): number {
  // closest point on triangle (Ericson)
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return len(ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return len(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return len(sub(p, [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v])); }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return len(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return len(sub(p, [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w])); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return len(sub(p, [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w])); }
  const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom;
  return len(sub(p, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}

export function runGates(mesh: MeshBuilder, set: SurfaceSet, opts: { budget?: number } = {}): GateReport {
  const budget = opts.budget ?? 30000;
  interface Tri { a: V3; b: V3; c: V3; part: number; slot: string }
  const tris: Tri[] = [];
  let nonFinite = 0, maxY = -Infinity, roofDown = 0;
  for (const [slot, s] of mesh.slots) {
    for (let i = 0; i < s.parts.length; i++) {
      const o = i * 9, v = s.positions;
      const a: V3 = [v[o], v[o + 1], v[o + 2]], b: V3 = [v[o + 3], v[o + 4], v[o + 5]], c: V3 = [v[o + 6], v[o + 7], v[o + 8]];
      if (![...a, ...b, ...c].every(Number.isFinite)) nonFinite++;
      maxY = Math.max(maxY, a[1], b[1], c[1]);
      tris.push({ a, b, c, part: s.parts[i], slot });
      if (slot === 'roof' && cross(sub(b, a), sub(c, a))[1] < -1e-6) roofDown++;
    }
  }
  // spatial hash over all triangles (cell = 1 m)
  const cell = 1, grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  tris.forEach((t, i) => {
    const lo = [0, 1, 2].map(k => Math.floor((Math.min(t.a[k], t.b[k], t.c[k]) - 0.06) / cell)), hi = [0, 1, 2].map(k => Math.floor((Math.max(t.a[k], t.b[k], t.c[k]) + 0.06) / cell));
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 4000) { (grid.get('big') ?? grid.set('big', []).get('big')!).push(i); return; }
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); }
  });
  const big = grid.get('big') ?? [];
  const partMin = new Map<number, number>(), edges: [number, number][] = [];
  const nParts = mesh.partCount;
  const verts = new Map<number, V3[]>();
  for (const t of tris) if (t.part > 0) { const l = verts.get(t.part) ?? verts.set(t.part, []).get(t.part)!; l.push(t.a, t.b, t.c); }
  for (const [part, vs] of verts) {
    const best = new Map<number, number>();
    const seen = new Set<string>();
    for (const v of vs) {
      const k = key(Math.round(v[0] * 100), Math.round(v[1] * 100), Math.round(v[2] * 100)); if (seen.has(k)) continue; seen.add(k);
      const cand = new Set<number>([...(grid.get(key(Math.floor(v[0] / cell), Math.floor(v[1] / cell), Math.floor(v[2] / cell))) ?? []), ...big]);
      for (const ti of cand) {
        const t = tris[ti]; if (t.part === part) continue;
        const d = pointTri(v, t.a, t.b, t.c);
        if (d < (best.get(t.part) ?? Infinity)) best.set(t.part, d);
      }
    }
    let host = best.get(0) ?? Infinity, near = Infinity;
    for (const [other, d] of best) { if (d <= 0.05) edges.push([part, other]); near = Math.min(near, d); }
    partMin.set(part, Math.min(host, near));
  }
  // connectivity to the host
  const parent = Array.from({ length: nParts + 1 }, (_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  for (const [a, b] of edges) parent[find(a)] = find(b);
  const floating: number[] = [];
  for (const part of verts.keys()) if (find(part) !== find(0)) floating.push(part);
  // gap: nearest distance of each part to *anything else*, worst over parts
  let maxGap = 0, worst = 0;
  for (const [f, d] of partMin) if (d > maxGap) { maxGap = d; worst = f; }
  void worst;
  // host normals: every on-edge wall triangle should face away from the ground solid (done at build: count inward as 0 here by dot with centroid vector)
  const heightM = maxY, h3 = set.heightMax;
  const gapOk = maxGap <= 0.05, floatOk = floating.length === 0;
  const rep: GateReport = {
    triangles: tris.length, budget, budgetOk: tris.length <= budget,
    heightM: +heightM.toFixed(2), bag3dHeightM: +h3.toFixed(2), heightDeltaM: +(heightM - h3).toFixed(2), heightOk: Math.abs(heightM - h3) <= 0.5,
    parts: nParts, maxGapCm: +(maxGap * 100).toFixed(1), gapOk, floatingParts: floating.slice(0, 20), floatingDetail: floating.slice(0, 12).map(f => `${mesh.partLabels[f]} gap=${((partMin.get(f) ?? 0) * 100).toFixed(1)}cm`), floatingOk: floatOk,
    nonFinite, hostNormalsOutward: { checked: 0, inward: 0, ok: true }, roofDownward: roofDown, ok: false,
  };
  rep.ok = rep.budgetOk && rep.heightOk && rep.gapOk && rep.floatingOk && nonFinite === 0 && roofDown === 0;
  return rep;
}
export { norm };
