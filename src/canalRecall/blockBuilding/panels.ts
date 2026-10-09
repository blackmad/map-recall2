/**
 * Wall panels: coplanar, edge-connected 3DBAG wall surfaces merged into one
 * facade plane with a (u, v) frame (u to the viewer's right, v up), plus the
 * run links (left/right neighbour panels with a small turn angle) used for
 * mitred balcony and slab strips.
 */
import * as T from 'three';
import type { SurfaceSet } from './types.ts';
import { MeshBuilder, type V3, cross, sub, norm, dot } from './mesh.ts';

export type Poly2 = { outer: [number, number][]; holes: [number, number][][] };
export interface Panel {
  index: number;
  n: V3;            // unit outward normal (horizontal)
  r: V3;            // unit right vector (viewer outside, looking at the wall)
  o: V3;            // world point of (u=0, v=0, d=0)
  polys: Poly2[];
  uMin: number; uMax: number; vMin: number; vMax: number;
  partyH: number;   // height of a neighbouring building touching this wall (0 = free)
  onEdge: boolean;
  prev: number; next: number; // run links (panel index or -1)
  area: number;
}
export const pt = (p: Panel, u: number, v: number, d = 0): V3 => [p.o[0] + p.r[0] * u + p.n[0] * d, v + p.n[1] * d, p.o[2] + p.r[2] * u + p.n[2] * d];

function newell(r: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], b = r[(i + 1) % r.length];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}
export function pointInRing(p: [number, number], ring: [number, number][]): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
export const insidePoly = (p: [number, number], poly: Poly2) => pointInRing(p, poly.outer) && !poly.holes.some(h => pointInRing(p, h));
export const insidePanel = (panel: Panel, p: [number, number]) => panel.polys.some(q => insidePoly(p, q));

/** All corners and edge midpoints of a (u, v) polygon lie inside the wall, shrunk by `tol` metres of slack. */
export function fitsPanel(panel: Panel, poly: [number, number][], tol = 0.02): boolean {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const pull = (p: [number, number]): [number, number] => { const dx = cx - p[0], dy = cy - p[1], l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * tol, p[1] + dy / l * tol]; };
  const q = poly.map(pull);
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length];
    if (!insidePanel(panel, a) || !insidePanel(panel, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) return false;
  }
  return insidePanel(panel, [cx, cy]);
}
export const rectPoly = (u0: number, u1: number, v0: number, v1: number): [number, number][] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

export interface BuildResult { panels: Panel[]; stats: { walls: number; slanted: number; slivers: number; flipped: number; inwardEdge: number } }

export function buildHost(set: SurfaceSet, mesh: MeshBuilder, roofSlot: string, wallSlot: string): BuildResult {
  // ground solid (outer rings minus holes) for orientation sanity checks
  const groundOuter: [number, number][][] = [], groundHoles: [number, number][][] = [];
  for (const g of set.ground) g.rings.forEach((r, i) => (i === 0 ? groundOuter : groundHoles).push(r.map(p => [p[0], p[2]] as [number, number])));
  const solid = (p: [number, number]) => groundOuter.some(r => pointInRing(p, r)) && !groundHoles.some(r => pointInRing(p, r));

  const stats = { walls: set.walls.length, slanted: 0, slivers: 0, flipped: 0, inwardEdge: 0 };
  // roofs
  for (const roof of set.roofs) {
    const ring = roof.rings[0];
    let n = newell(ring); if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
    triangulate3(mesh, roofSlot, roof.rings, norm(n), 0);
  }
  // wall surfaces -> candidates
  interface Cand { i: number; n: V3; ring: V3[]; rings: V3[][]; edge: boolean }
  const cands: Cand[] = [];
  set.walls.forEach((w, i) => {
    const ring = w.rings[0];
    const nw = newell(ring), l = Math.hypot(...nw);
    if (l < 0.02) { stats.slivers++; return; }
    const n0 = norm(nw);
    if (Math.abs(n0[1]) > 0.25) { stats.slanted++; triangulate3(mesh, roofSlot, w.rings, n0[1] > 0 ? n0 : [-n0[0], -n0[1], -n0[2]], 0); return; }
    let n = norm([n0[0], 0, n0[2]]);
    // orientation: an on-edge wall's outward point must lie outside the ground solid
    const mid: [number, number] = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[2], 0) / ring.length];
    if (w.onFootprintEdge) {
      const probeOut: [number, number] = [mid[0] + n[0] * 0.2, mid[1] + n[2] * 0.2], probeIn: [number, number] = [mid[0] - n[0] * 0.2, mid[1] - n[2] * 0.2];
      if (solid(probeOut) && !solid(probeIn)) { n = [-n[0], 0, -n[2]]; stats.flipped++; }
      else if (solid(probeOut) && solid(probeIn)) stats.inwardEdge++;
    }
    cands.push({ i, n, ring, rings: w.rings, edge: w.onFootprintEdge });
  });
  // union-find: coplanar + sharing an edge
  const parent = cands.map((_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const key = (p: V3) => `${Math.round(p[0] * 50)},${Math.round(p[1] * 50)},${Math.round(p[2] * 50)}`;
  const vmap = new Map<string, number[]>();
  cands.forEach((c, ci) => { for (const p of c.ring) { const k = key(p); (vmap.get(k) ?? vmap.set(k, []).get(k)!).push(ci); } });
  const shared = new Map<string, number>();
  for (const list of vmap.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const k = `${list[a]}|${list[b]}`; shared.set(k, (shared.get(k) ?? 0) + 1);
  }
  for (const [k, cnt] of shared) {
    if (cnt < 2) continue;
    const [a, b] = k.split('|').map(Number), ca = cands[a], cb = cands[b];
    if (dot(ca.n, cb.n) < Math.cos(1.2 * Math.PI / 180)) continue;
    const d = Math.abs(dot(ca.n, sub(cb.ring[0], ca.ring[0])));
    if (d > 0.02) continue;
    parent[find(a)] = find(b);
  }
  const groups = new Map<number, number[]>();
  cands.forEach((_, i) => { const g = find(i); (groups.get(g) ?? groups.set(g, []).get(g)!).push(i); });

  const panels: Panel[] = [];
  for (const members of groups.values()) {
    const first = cands[members[0]];
    const n = first.n, r: V3 = [n[2], 0, -n[0]];
    const ref = first.ring[0];
    const o: V3 = [ref[0], 0, ref[2]];
    const polys: Poly2[] = [];
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity, area = 0, edge = false;
    for (const ci of members) {
      const c = cands[ci];
      edge ||= c.edge;
      const to2 = (p: V3): [number, number] => [(p[0] - o[0]) * r[0] + (p[2] - o[2]) * r[2], p[1]];
      const rings2 = c.rings.map(rr => rr.map(to2));
      // drop duplicate closing vertex and collinear repeats
      const clean = (q: [number, number][]) => q.filter((p, i) => { const nx = q[(i + 1) % q.length]; return Math.hypot(p[0] - nx[0], p[1] - nx[1]) > 1e-4; });
      const outer = clean(rings2[0]), holes = rings2.slice(1).map(clean);
      polys.push({ outer, holes });
      for (const p of outer) { uMin = Math.min(uMin, p[0]); uMax = Math.max(uMax, p[0]); vMin = Math.min(vMin, p[1]); vMax = Math.max(vMax, p[1]); }
      let a = 0; for (let i = 0; i < outer.length; i++) { const p = outer[i], q = outer[(i + 1) % outer.length]; a += p[0] * q[1] - q[0] * p[1]; } area += Math.abs(a) / 2;
      triangulate3(mesh, wallSlot, c.rings, n, 0);
    }
    panels.push({ index: panels.length, n, r, o, polys, uMin, uMax, vMin, vMax, partyH: 0, onEdge: edge, prev: -1, next: -1, area });
  }
  // party heights from neighbouring footprints
  for (const p of panels) {
    if (!p.onEdge) continue;
    let h = 0;
    const w = p.uMax - p.uMin;
    for (const f of [0.15, 0.5, 0.85]) {
      const u = p.uMin + w * f, probe: [number, number] = [p.o[0] + p.r[0] * u + p.n[0] * 0.4, p.o[2] + p.r[2] * u + p.n[2] * 0.4];
      for (const nb of set.neighbours) if (pointInRing(probe, nb.ring)) h = Math.max(h, nb.height);
    }
    p.partyH = h;
  }
  // run links
  const endKey = (p: Panel, u: number) => { const x = p.o[0] + p.r[0] * u, z = p.o[2] + p.r[2] * u; return `${Math.round(x * 20)},${Math.round(z * 20)}`; };
  const starts = new Map<string, Panel[]>();
  for (const p of panels) if (p.onEdge && p.uMax - p.uMin > 0.3) { const k = endKey(p, p.uMin); (starts.get(k) ?? starts.set(k, []).get(k)!).push(p); }
  for (const p of panels) {
    if (!p.onEdge || p.uMax - p.uMin <= 0.3) continue;
    const cand = (starts.get(endKey(p, p.uMax)) ?? []).filter(q => q !== p && dot(p.n, q.n) > Math.cos(50 * Math.PI / 180) && q.prev < 0);
    if (cand.length) { p.next = cand[0].index; cand[0].prev = p.index; }
  }
  return { panels, stats };
}

/** Triangulate a planar polygon (with holes) in 3D and add it to the host (part 0) with a fixed facing. */
export function triangulate3(mesh: MeshBuilder, slot: string, rs: V3[][], facing: V3, part: number): void {
  const nrm = norm(newell(rs[0]));
  // project to the dominant plane
  const ax = Math.abs(nrm[0]) >= Math.abs(nrm[1]) && Math.abs(nrm[0]) >= Math.abs(nrm[2]) ? 0 : Math.abs(nrm[1]) >= Math.abs(nrm[2]) ? 1 : 2;
  const proj = (p: V3) => { const [a, b] = [0, 1, 2].filter(k => k !== ax); return new T.Vector2(p[a], p[b]); };
  const clean = (r: V3[]) => r.filter((p, i) => { const q = r[(i + 1) % r.length]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 1e-4; });
  const outer = clean(rs[0]), holes = rs.slice(1).map(clean);
  const all = [...outer, ...holes.flat()];
  const faces = T.ShapeUtils.triangulateShape(outer.map(proj), holes.map(h => h.map(proj)));
  for (const f of faces) mesh.tri(slot, all[f[0]], all[f[1]], all[f[2]], part, facing);
}
export { cross };
