/**
 * Shell repair for `kind: large` recipes (opt-in per intent, 2026-10-14): 3DBAG LoD2.2 shells that leave open edges
 * (a roof edge with no wall under it, a missing roof facet, a slit between two walls) or whose LoD2.2 ground has
 * drifted from the BAG LoD0 outline are made authorable before the fit. Everything here is deterministic and works on
 * the facts, so the fitted recipe, the wall table (`walls.ts`) and the gates all see the same repaired shell.
 *
 * - `shellRepair: true` finds the genuine open edges of the bare host (the kit's own triangulation, T-junction seams
 *   excluded with the gate's 2 cm rule) and closes them with the smallest patch that fits:
 *   a planar loop gets a cap (`cap`: earcut in its plane; a roof facet when flat or sloped, a wall when vertical);
 *   a roof (or floating wall) edge gets a vertical strip down to whatever lies below it (`strip`): the top of a wall
 *   left short in the same plane, a lower roof, else the ground (a whole wall 3DBAG left out is the ground outline
 *   extruded to the roof edge); two vertical wall edges a few decimetres apart get a seam quad (`seam`).
 *   Patches are new wall surfaces (indices from `REPAIR_SURFACE_BASE`, listed by `walls.ts` like any other) and roof
 *   facets, so wall groups may list them.
 * - `footprint: "bag"` rebuilds the massing on the BAG outline: the outline is partitioned by the LoD2.2 roof planes
 *   (highest first, exact planes clipped to the outline), the outline left uncovered takes the nearest roof plane
 *   within `FILL_NEAREST_M` (a drift sliver) or else the pand's LoD1.2 height (`b3_h_dak_70p`, capped at the roof
 *   max: the max is often a pinnacle, Volewijkshof's 18.8 m over a 13.9 m block), and the walls are the repair strips
 *   from every roof edge down to the next roof or the ground. The LoD2.2 walls are not used.
 */
import * as T from 'three';
import type {BuildingFacts, RD, WallSurfaceFacts} from './facts.ts';
import {fitPlane, pointInRing} from './facts.ts';
import {footprintIoU, pointTriangleDistance, topology, type Tri} from './gates.ts';
import {MeshBuilder, type V3} from '../blockBuilding/mesh.ts';
import {newell, triangulate3} from '../blockBuilding/panels.ts';

/** First wall-surface index of a repair patch (3DBAG shells stay far below it; the intent validator allows < 100000). */
export const REPAIR_SURFACE_BASE = 90000;
/** Open-edge tolerance of the gate: a boundary edge within 2 cm of another triangle is a seam, not a hole. */
const TOL = 0.02;
/** Edges at or below this height are the open building base. */
const BASE_M = 0.05;
/** Sub-piece length when an open edge is split to find which part of it is open. */
const STEP_M = 0.25;
/** In-plane pairing of a roof edge with the short wall top under it: plan offset and angle. */
const PAIR_PLAN_M = 0.3, PAIR_DEG = 5;
/** Vertical slit: two vertical open edges at most this far apart in plan. */
const SEAM_M = 0.6;
/** Planar loop: every vertex within this of the loop's plane. */
const PLANAR_M = 0.05;
/** footprint "bag": an uncovered part whose centroid lies this close to a LoD2.2 roof takes that roof's plane. */
export const FILL_NEAREST_M = 1.5;

export type PatchKind = 'cap' | 'strip' | 'seam';
export interface ShellPatch { kind: PatchKind; target: 'wall' | 'roof'; surface?: number; areaM2: number; edgeM: number }
export interface ShellRepairReport {
  mode: {repair: boolean; footprint: 'lod22' | 'bag'};
  /** gate-rule open edge of the bare host (metres) before and after the repair */
  openBeforeM: number; openAfterM: number; closedM: number;
  /** spikes: wall vertices clamped to the roof edge (`clampSpikes`) */
  patches: {spikes: number; cap: number; strip: number; seam: number; wallSurfaces: number[]; roofFacets: number};
  /** footprint IoU of the shell's ground against BAG LoD0, before (LoD2.2 ground) and after */
  iouBefore: number; iouAfter: number;
  /** open pieces left after the repair (longest first, local metres), for the next pass */
  leftover: {mid: number[]; lengthM: number}[];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Local frame of the repair (the kit's: X east, Y up from ground, Z south) around an anchor. */
interface Frame { ax: number; ay: number; g: number }
const toLocal = (f: Frame, p: number[]): V3 => [p[0] - f.ax, p[2] - f.g, f.ay - p[1]];
const toRD = (f: Frame, p: V3): number[] => [r3(p[0] + f.ax), r3(f.ay - p[2]), r3(p[1] + f.g)];

/** `fromRoof`: triangulated from a roof surface (a warped 3DBAG roof facet can have triangles standing on end) */
interface HostTri { a: V3; b: V3; c: V3; roofLike: boolean; fromRoof?: boolean }

/** The bare host as the kit builds it: roofs facing up, walls as planes, slanted walls as roof, slivers sealed. */
export function hostTriangles(walls: V3[][][], roofs: V3[][][]): HostTri[] {
  const mesh = new MeshBuilder(), out: HostTri[] = [];
  for (const rings of roofs) { let n = newell(rings[0]); if (n[1] < 0) n = [-n[0], -n[1], -n[2]]; triangulate3(mesh, 'roof', rings, n, 0); }
  for (const rings of walls) {
    const nw = newell(rings[0]), l = len3(nw);
    if (l < 1e-6) continue;
    const n: V3 = [nw[0] / l, nw[1] / l, nw[2] / l];
    if (l >= 0.02 && Math.abs(n[1]) > 0.25) triangulate3(mesh, 'roof', rings, n[1] > 0 ? n : [-n[0], -n[1], -n[2]], 0);
    else triangulate3(mesh, 'wall', rings, n, 0);
  }
  for (const [slot, s] of mesh.slots) for (let i = 0; i < s.positions.length; i += 9) {
    const p = s.positions, a: V3 = [p[i], p[i + 1], p[i + 2]], b: V3 = [p[i + 3], p[i + 4], p[i + 5]], c: V3 = [p[i + 6], p[i + 7], p[i + 8]];
    const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    out.push({a, b, c, roofLike: Math.abs(n[1] / nl) > 0.25, ...(slot === 'roof' ? {fromRoof: true} : {})});
  }
  return out;
}

/** Spatial hash over triangles (1 m cells, inflated by the tolerance), as the gate's. */
class TriIndex {
  private grid = new Map<string, number[]>(); private big: number[] = [];
  constructor(readonly tris: {a: V3; b: V3; c: V3}[]) { tris.forEach((t, i) => this.add(t, i)); }
  add(t: {a: V3; b: V3; c: V3}, ti: number) {
    const lo = [0, 1, 2].map(i => Math.floor(Math.min(t.a[i], t.b[i], t.c[i]) - TOL)), hi = [0, 1, 2].map(i => Math.floor(Math.max(t.a[i], t.b[i], t.c[i]) + TOL));
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > 2000) { this.big.push(ti); return; }
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = `${x},${y},${z}`; const l = this.grid.get(k); if (l) l.push(ti); else this.grid.set(k, [ti]); }
  }
  near(q: V3) { return [...(this.grid.get(q.map(v => Math.floor(v)).join(',')) ?? []), ...this.big]; }
  covered(q: V3, except: number) { return this.near(q).some(ti => ti !== except && pointTriangleDistance(q, this.tris[ti]) < TOL); }
}

/** An open stretch of a boundary edge, directed as in its owner triangle. */
export interface OpenPiece { a: V3; b: V3; owner: number }

/** Genuine open edges (gate rule), split into `STEP_M` sub-pieces so a partly seamed edge yields only its open part. */
export function openPieces(tris: {a: V3; b: V3; c: V3}[], index = new TriIndex(tris)): OpenPiece[] {
  const key = (p: V3) => p.map(v => Math.round(v * 100)).join(',');
  const edges = new Map<string, {n: number; a: V3; b: V3; tri: number}>();
  tris.forEach((t, ti) => {
    for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [V3, V3][]) {
      const kp = key(p), kq = key(q); if (kp === kq) continue;
      const k = kp < kq ? `${kp}|${kq}` : `${kq}|${kp}`, e = edges.get(k) ?? {n: 0, a: p, b: q, tri: ti}; e.n++; edges.set(k, e);
    }
  });
  const out: OpenPiece[] = [];
  for (const e of edges.values()) {
    if (e.n !== 1 || Math.max(e.a[1], e.b[1]) <= BASE_M) continue;
    const L = len3(sub3(e.b, e.a)), k = Math.max(1, Math.ceil(L / STEP_M));
    let start = -1;
    for (let i = 0; i <= k; i++) {
      const open = i < k && ![0.25, 0.5, 0.75].every(s => { const q = lerp3(e.a, e.b, (i + s) / k); return q[1] <= BASE_M || index.covered(q, e.tri); });
      if (open && start < 0) start = i;
      if (!open && start >= 0) { out.push({a: lerp3(e.a, e.b, start / k), b: lerp3(e.a, e.b, i / k), owner: e.tri}); start = -1; }
    }
  }
  return out;
}

const planOf = (p: V3): [number, number] => [p[0], p[2]];
function inTri2(p: [number, number], t: {a: V3; b: V3; c: V3}, eps = 1e-6): boolean {
  const [a, b, c] = [planOf(t.a), planOf(t.b), planOf(t.c)];
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(d) < 1e-12) return false;
  const l1 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / d, l2 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / d;
  return l1 >= -eps && l2 >= -eps && 1 - l1 - l2 >= -eps;
}
/** Height of the plane of triangle t at plan point p (t must not be vertical). */
function triHeight(p: [number, number], t: {a: V3; b: V3; c: V3}): number {
  const [a, b, c] = [t.a, t.b, t.c];
  const u = sub3(b, a), v = sub3(c, a), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return a[1] - (n[0] * (p[0] - a[0]) + n[2] * (p[1] - a[2])) / n[1];
}

const triArea = (a: V3, b: V3, c: V3) => { const u = sub3(b, a), v = sub3(c, a); return len3([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]) / 2; };
/** Earcut a planar 3D loop in its dominant plane. */
function triangulateLoop(loop: V3[]): [V3, V3, V3][] {
  const n = newell(loop), ax = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2;
  const [i, j] = [0, 1, 2].filter(k => k !== ax);
  return T.ShapeUtils.triangulateShape(loop.map(p => new T.Vector2(p[i], p[j])), []).map(f => [loop[f[0]], loop[f[1]], loop[f[2]]] as [V3, V3, V3]);
}

interface Patch { kind: PatchKind; target: 'wall' | 'roof'; ring: V3[]; edgeM: number }

/** Max height of the roof-like triangles over a plan point, below `under` (null = none). */
function roofBelow(tris: HostTri[], p: [number, number], under: number): number | null {
  let best: number | null = null;
  for (const t of tris) {
    if (!t.roofLike || !inTri2(p, t, 1e-4)) continue;
    const h = triHeight(p, t);
    if (h < under - BASE_M && (best === null || h > best)) best = h;
  }
  return best;
}

/** Orient a vertical patch ring so its Newell normal points to the lower side (the outside of the step). */
function orientOutward(ring: V3[], tris: HostTri[]): V3[] {
  const n = newell(ring), l = Math.hypot(n[0], n[2]);
  if (l < 1e-9) return ring;
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[2], 0) / ring.length, top = Math.max(...ring.map(p => p[1]));
  const side = (s: number) => roofBelow(tris, [cx + s * n[0] / l * 0.3, cz + s * n[2] / l * 0.3], top + 10) ?? -1;
  return side(1) > side(-1) + 0.05 ? [...ring].reverse() : ring;
}

/**
 * The wall region under an open roof edge P: from P down to the highest roof below it (probed on the edge line and
 * 5 cm either side), else the ground, as convex pieces in P's vertical plane with every wall triangle already standing
 * in that plane (within `COPLANAR_M`) cut away. Pieces are 3D rings. `up`: the region over an open wall top up to the
 * lowest roof above it (none: no region there).
 */
const COPLANAR_M = 0.03;
export function stripRegion(P: OpenPiece, tris: HostTri[], up = false): V3[][] {
  const dx = P.b[0] - P.a[0], dz = P.b[2] - P.a[2], L = Math.hypot(dx, dz), u: P2 = [dx / L, dz / L], nrm: P2 = [-u[1], u[0]];
  // the floor source is chosen 5 cm in from the edge's ends (a roof that only touches an end corner is not under it),
  // its height taken on the edge line itself so the strip's foot lies on that roof
  const inset = L > 0.2 ? 0.05 / L : 0;
  const floorAt = (t: number): {h: number; src: number} => {
    const p = lerp3(P.a, P.b, t), plan: P2 = [p[0], p[2]], q = lerp3(P.a, P.b, Math.min(1 - inset, Math.max(inset, t))), qp: P2 = [q[0], q[2]];
    let best = up ? {h: Infinity, src: -2} : {h: 0, src: -1};
    for (const s of [0, 0.05, -0.05]) {
      const probe: P2 = [qp[0] + nrm[0] * s, qp[1] + nrm[1] * s];
      tris.forEach((tr, ti) => {
        if (!tr.roofLike || !inTri2(probe, tr, 1e-4)) return;
        const h = triHeight(plan, tr), hp = triHeight(probe, tr);
        if (!up && hp < q[1] - BASE_M && h > best.h + 1e-4) best = {h: Math.max(0, Math.min(h, p[1])), src: ti};
        if (up && hp > q[1] + BASE_M && h < best.h - 1e-4) best = {h: Math.max(h, p[1]), src: ti};
      });
    }
    return Number.isFinite(best.h) ? best : {h: p[1], src: -2};
  };
  const n = Math.max(1, Math.ceil(L / 0.5));
  const samples = Array.from({length: n + 1}, (_, i) => ({t: i / n, ...floorAt(i / n)}));
  const refined: typeof samples = [samples[0]];
  for (let i = 1; i < samples.length; i++) {
    let lo = refined[refined.length - 1], hi = samples[i];
    if (lo.src !== hi.src) {
      for (let k = 0; k < 14 && (hi.t - lo.t) * L > 0.005; k++) { const m = (lo.t + hi.t) / 2, fm = {t: m, ...floorAt(m)}; if (fm.src === lo.src) lo = fm; else hi = fm; }
      if (lo !== refined[refined.length - 1]) refined.push(lo);
      if (hi !== samples[i]) refined.push(hi);
    }
    refined.push(samples[i]);
  }
  // (u, v) frame: u along the edge in plan from P.a, v = height
  const to2 = (p: V3): P2 => [(p[0] - P.a[0]) * u[0] + (p[2] - P.a[2]) * u[1], p[1]];
  const to3 = (q: P2): V3 => [r3(P.a[0] + u[0] * q[0]), r3(q[1]), r3(P.a[2] + u[1] * q[0])];
  const top = (t: number) => P.a[1] + (P.b[1] - P.a[1]) * t;
  if (refined.every(s => Math.abs(top(s.t) - s.h) < BASE_M)) return [];
  const region = ([[0, P.a[1]], [L, P.b[1]], ...[...refined].reverse().map(s => [s.t * L, s.h])] as P2[])
    .filter((q, i, all) => { const r = all[(i + 1) % all.length]; return Math.hypot(q[0] - r[0], q[1] - r[1]) > 1e-4; });
  // drop collinear foot samples (a floor plane is linear along the edge)
  const simple = region.filter((q, i, all) => { const a = all[(i + all.length - 1) % all.length], b = all[(i + 1) % all.length]; return Math.abs(cross2(a, b, q)) > 1e-6 * Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1])); });
  if (simple.length < 3 || Math.abs(area2(simple)) < 1e-3) return [];
  let pieces = triangulate2([ccw(simple)]), cut = false;
  const vmin = Math.min(...region.map(q => q[1])), vmax = Math.max(...region.map(q => q[1]));
  for (const tr of tris) {
    if (tr.roofLike) continue;
    const vs = [tr.a, tr.b, tr.c];
    if (vs.some(v => Math.abs((v[0] - P.a[0]) * nrm[0] + (v[2] - P.a[2]) * nrm[1]) > COPLANAR_M)) continue;
    const t2 = ccw(vs.map(to2));
    if (Math.abs(area2(t2)) < 1e-6) continue;
    const tb = bbox(t2);
    if (tb[2] < -1e-3 || tb[0] > L + 1e-3 || tb[3] < vmin || tb[1] > vmax) continue;
    pieces = pieces.flatMap(pc => { if (!boxesMeet(bbox(pc), tb)) return [pc]; const d = subtractConvex(pc, t2); if (Math.abs(d.reduce((a, q) => a + Math.abs(area2(q)), 0) - Math.abs(area2(pc))) > 1e-6) cut = true; return d; });
  }
  if (!cut) return [ccw(simple).map(to3)];
  return pieces.filter(pc => Math.abs(area2(pc)) > 1e-3).map(pc => pc.map(to3));
}

/** One pass: caps on planar loops, strips under roof edges (highest first), seams between vertical slits. */
function repairPass(tris: HostTri[], patches: Patch[]): number {
  const before = patches.length;
  const index = new TriIndex(tris);
  const pieces = openPieces(tris, index);
  const addPatch = (p: Patch) => {
    patches.push(p);
    for (const [a, b, c] of triangulateLoop(p.ring)) { const t = {a, b, c, roofLike: p.target === 'roof'}; tris.push(t); index.add(t, tris.length - 1); }
  };
  // 1. planar loops of open pieces (undirected chaining at 1 cm).
  const key = (p: V3) => p.map(v => Math.round(v * 100)).join(',');
  const adj = new Map<string, number[]>();
  pieces.forEach((pc, i) => { for (const k of [key(pc.a), key(pc.b)]) (adj.get(k) ?? adj.set(k, []).get(k)!).push(i); });
  const inLoop = new Set<number>();
  for (let s = 0; s < pieces.length; s++) {
    if (inLoop.has(s)) continue;
    const loop: V3[] = [pieces[s].a], used = [s];
    let cur = pieces[s].b, ok = false;
    for (let guard = 0; guard < 256; guard++) {
      if (key(cur) === key(pieces[s].a)) { ok = true; break; }
      const nb = (adj.get(key(cur)) ?? []).filter(i => !used.includes(i));
      if (nb.length !== 1 || (adj.get(key(cur)) ?? []).length !== 2) break;
      const pc = pieces[nb[0]]; used.push(nb[0]); loop.push(cur);
      cur = key(pc.a) === key(cur) ? pc.b : pc.a;
    }
    if (!ok || loop.length < 3) continue;
    // collapse collinear sub-piece joints
    const ring = loop.filter((p, i) => { const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length], u = sub3(p, a), v = sub3(b, p); const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; return len3(c as V3) > 1e-6 * len3(u) * len3(v) + 1e-9; });
    if (ring.length < 3) continue;
    const n = newell(ring), nl = len3(n);
    if (nl < 1e-6) continue;
    const un: V3 = [n[0] / nl, n[1] / nl, n[2] / nl], d0 = ring[0][0] * un[0] + ring[0][1] * un[1] + ring[0][2] * un[2];
    if (ring.some(p => Math.abs(p[0] * un[0] + p[1] * un[1] + p[2] * un[2] - d0) > PLANAR_M)) continue;
    // a loop round a surface that is already there (a roof sheet with no walls) is that surface's edge, not a hole
    const capTris = triangulateLoop(ring), capArea = capTris.reduce((s2, [a, b, c]) => s2 + triArea(a, b, c), 0);
    const coveredArea = capTris.reduce((s2, [a, b, c]) => s2 + (index.covered([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], -1) ? triArea(a, b, c) : 0), 0);
    if (capArea < 1e-4 || coveredArea > 0.5 * capArea) continue;
    used.forEach(i => inLoop.add(i));
    const vertical = Math.abs(un[1]) <= 0.25, edgeM = used.reduce((s, i) => s + len3(sub3(pieces[i].b, pieces[i].a)), 0);
    addPatch({kind: 'cap', target: vertical ? 'wall' : 'roof', ring: vertical ? orientOutward(ring, tris) : ring, edgeM});
  }
  // 2. strips under spanning pieces whose owner lies at or above them, highest first: the region between the edge and
  // whatever lies below it (a lower roof, else the ground), minus the walls already standing in that plane.
  const spans = pieces.map((pc, i) => ({pc, i})).filter(({i}) => !inLoop.has(i)).filter(({pc}) => Math.hypot(pc.b[0] - pc.a[0], pc.b[2] - pc.a[2]) >= 0.03);
  const ownerAbove = (pc: OpenPiece) => {
    const t = tris[pc.owner];
    if (t.roofLike || t.fromRoof) return true;
    // the owner's vertex farthest from the piece's line, above or below that line
    const d = sub3(pc.b, pc.a), dl = len3(d) || 1, off = (v: V3) => { const w = sub3(v, pc.a), s2 = (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / (dl * dl); return {s2, dist: len3(sub3(w, [d[0] * s2, d[1] * s2, d[2] * s2]))}; };
    const third = [t.a, t.b, t.c].reduce((best, v) => off(v).dist > off(best).dist ? v : best), o = off(third);
    return third[1] > pc.a[1] + d[1] * o.s2;
  };
  const sources = spans.filter(s => ownerAbove(s.pc)).sort((x, y) => Math.max(y.pc.a[1], y.pc.b[1]) - Math.max(x.pc.a[1], x.pc.b[1]) || x.i - y.i);
  for (const {pc: P} of sources) {
    // still open? (a higher strip may have closed it from above)
    if ([0.2, 0.5, 0.8].every(t => index.covered(lerp3(P.a, P.b, t), P.owner))) continue;
    for (const ring of stripRegion(P, tris)) addPatch({kind: 'strip', target: 'wall', ring: orientOutward(ring, tris), edgeM: len3(sub3(P.b, P.a))});
  }
  // wall tops left open (a wall stopping short of the roof over it): the region up to that roof, lowest first
  const tops = spans.filter(s => !ownerAbove(s.pc)).sort((x, y) => Math.min(x.pc.a[1], x.pc.b[1]) - Math.min(y.pc.a[1], y.pc.b[1]) || x.i - y.i);
  for (const {pc: P} of tops) {
    if ([0.2, 0.5, 0.8].every(t => index.covered(lerp3(P.a, P.b, t), P.owner))) continue;
    for (const ring of stripRegion(P, tris, true)) addPatch({kind: 'strip', target: 'wall', ring: orientOutward(ring, tris), edgeM: len3(sub3(P.b, P.a))});
  }
  // 3. seams: pairs of vertical open pieces a few decimetres apart in plan, overlapping in height.
  const after = openPieces(tris, index);
  const verticals = after.filter(pc => Math.hypot(pc.b[0] - pc.a[0], pc.b[2] - pc.a[2]) < 0.03 && Math.abs(pc.b[1] - pc.a[1]) >= 0.2);
  const vmerged: {x: number; z: number; y0: number; y1: number}[] = [];
  for (const v of verticals) {
    const x = (v.a[0] + v.b[0]) / 2, z = (v.a[2] + v.b[2]) / 2, y0 = Math.min(v.a[1], v.b[1]), y1 = Math.max(v.a[1], v.b[1]);
    const m = vmerged.find(q => Math.hypot(q.x - x, q.z - z) < 0.01 && (Math.abs(q.y1 - y0) < 0.01 || Math.abs(q.y0 - y1) < 0.01));
    if (m) { m.y0 = Math.min(m.y0, y0); m.y1 = Math.max(m.y1, y1); } else vmerged.push({x, z, y0, y1});
  }
  const usedV = new Set<number>();
  vmerged.forEach((A, i) => {
    if (usedV.has(i)) return;
    let best = -1, bd = Infinity;
    vmerged.forEach((B, j) => {
      if (j === i || usedV.has(j)) return;
      const d = Math.hypot(A.x - B.x, A.z - B.z), ov = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      if (d >= 0.01 && d <= SEAM_M && ov >= 0.2 && d < bd) { bd = d; best = j; }
    });
    if (best < 0) return;
    const B = vmerged[best], y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y1, B.y1);
    usedV.add(i); usedV.add(best);
    const ring: V3[] = [[A.x, y0, A.z], [B.x, y0, B.z], [B.x, y1, B.z], [A.x, y1, A.z]];
    addPatch({kind: 'seam', target: 'wall', ring: orientOutward(ring, tris), edgeM: 2 * (y1 - y0)});
  });
  return patches.length - before;
}

/** Gate-rule open length (the `topology()` measure) of a triangle soup. */
function gateOpen(tris: {a: V3; b: V3; c: V3}[]) {
  return topology(tris.map(t => ({a: t.a, b: t.b, c: t.c, surface: 'host', metallic: 0}) as Tri)).openEdgeLengthM;
}

export interface RepairResult { tris: HostTri[]; patches: Patch[]; openBeforeM: number; openAfterM: number; leftover: ShellRepairReport['leftover'] }
/** Repair a host triangle soup in local metres (pure; unit-tested on synthetic shells). */
export function repairHost(host: HostTri[], passes = 3): RepairResult {
  const tris = host.map(t => ({...t})), patches: Patch[] = [], openBeforeM = gateOpen(tris);
  for (let k = 0; k < passes; k++) if (!repairPass(tris, patches)) break;
  const leftover = openPieces(tris).map(pc => ({mid: lerp3(pc.a, pc.b, 0.5).map(v => +v.toFixed(2)), lengthM: +len3(sub3(pc.b, pc.a)).toFixed(2)})).sort((a, b) => b.lengthM - a.lengthM).slice(0, 12);
  return {tris, patches, openBeforeM, openAfterM: gateOpen(tris), leftover};
}

/**
 * Wall spikes: a wall vertex standing more than `SPIKE_M` above the roof edge that runs along that wall at its plan
 * position (else above every roof boundary there) drops onto it: 3DBAG draws a 7-8 m spike over Singel 457's
 * Kalvertoren corner and a 3.6 m slanted fin on Hirschpassage 2. A top vertex of a sound shell lies on a roof edge in
 * its own plane; and only a vertex of a triangle with an open edge in the bare host moves (`onlyNear`), so sound shells never change.
 */
export const SPIKE_M = 0.3;
export function clampSpikes(walls: V3[][][], roofs: V3[][][], onlyNear?: V3[]): {walls: V3[][][]; clamped: number} {
  const edges: [V3, V3][] = roofs.flatMap(rings => rings.flatMap(r => r.map((p, i) => [p, r[(i + 1) % r.length]] as [V3, V3])));
  let clamped = 0;
  const out = walls.map(rings => rings.map(ring => {
    const nw = newell(ring), nl = Math.hypot(nw[0], nw[2]), n2: P2 = nl > 1e-9 ? [nw[0] / nl, nw[2] / nl] : [0, 0], o = ring[0];
    const inPlane = (p: V3) => Math.abs((p[0] - o[0]) * n2[0] + (p[2] - o[2]) * n2[1]) <= COPLANAR_M;
    // along the wall: a roof edge counts as the wall's own when it also overlaps the wall's extent (two coplanar walls
    // meeting at a corner each carry their own roof edge)
    const along = (p: V3) => (p[0] - o[0]) * -n2[1] + (p[2] - o[2]) * n2[0], us = ring.map(along), u0 = Math.min(...us), u1 = Math.max(...us);
    const overlaps = (a: V3, b: V3) => Math.min(u1, Math.max(along(a), along(b))) - Math.max(u0, Math.min(along(a), along(b))) > 0.05;
    return ring.map(v => {
      const plan: P2 = [v[0], v[2]];
      let any = -Infinity, own = -Infinity;
      for (const [a, b] of edges) {
        if (segDist2(plan, [a[0], a[2]], [b[0], b[2]]) > 0.05) continue;
        const dx = b[0] - a[0], dz = b[2] - a[2], den = dx * dx + dz * dz, t = den ? Math.max(0, Math.min(1, ((v[0] - a[0]) * dx + (v[2] - a[2]) * dz) / den)) : 0, h = a[1] + (b[1] - a[1]) * t;
        any = Math.max(any, h);
        if (nl > 1e-9 && inPlane(a) && inPlane(b) && den > 1e-4 && overlaps(a, b)) own = Math.max(own, h);
      }
      // a roof edge along this wall at this point is the wall's top there; else the highest roof boundary at the point
      const cap = Number.isFinite(own) ? own : any;
      if (!Number.isFinite(cap) || v[1] <= cap + SPIKE_M) return v;
      // a sound shell is never touched: only vertices of triangles with an open edge in the bare host move
      if (onlyNear && !onlyNear.some(q => len3(sub3(q, v)) < 0.02)) return v;
      clamped++;
      return [v[0], r3(cap), v[2]] as V3;
    });
  }));
  return {walls: out, clamped};
}

/**
 * Merge classes for the kit's panels under `shellRepair`: two edge-connected walls share a panel only when every vertex
 * of each lies within 2 cm of the other's plane (the kit's own test is 1.2 degrees and 2 cm at one vertex). Westerdoksdijk
 * 9's step wall over a 10.6 m roof and the outline wall under it are 0.7 degrees apart over 14 m; dissolved into one
 * face, its interior strays 7 cm off the roof edge between them and the gate reads 14 m of open edge.
 */
export function strictMergeClasses(walls: {rings: V3[][]}[]): number[] {
  const parent = walls.map((_, i) => i), find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const planes = walls.map(w => { const n = newell(w.rings[0]), l = len3(n) || 1; return {n: [n[0] / l, n[1] / l, n[2] / l] as V3, o: w.rings[0][0]}; });
  const dist = (i: number, p: V3) => Math.abs((p[0] - planes[i].o[0]) * planes[i].n[0] + (p[1] - planes[i].o[1]) * planes[i].n[1] + (p[2] - planes[i].o[2]) * planes[i].n[2]);
  const key = (p: V3) => `${Math.round(p[0] * 50)},${Math.round(p[1] * 50)},${Math.round(p[2] * 50)}`;
  const byVertex = new Map<string, number[]>();
  walls.forEach((w, i) => { for (const k of new Set(w.rings[0].map(key))) (byVertex.get(k) ?? byVertex.set(k, []).get(k)!).push(i); });
  const shared = new Map<string, number>();
  for (const list of byVertex.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) { const k = `${list[a]}|${list[b]}`; shared.set(k, (shared.get(k) ?? 0) + 1); }
  for (const [k, cnt] of shared) {
    if (cnt < 2) continue;
    const [a, b] = k.split('|').map(Number);
    if (walls[b].rings[0].every(p => dist(a, p) <= 0.02) && walls[a].rings[0].every(p => dist(b, p) <= 0.02)) parent[find(a)] = find(b);
  }
  return walls.map((_, i) => find(i));
}

// ---- footprint "bag": the BAG outline partitioned by the LoD2.2 roof planes ----

type P2 = [number, number];
const cross2 = (a: P2, b: P2, p: P2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const area2 = (poly: P2[]) => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Sutherland-Hodgman: keep the side of a->b where cross >= 0 (left) or <= 0. */
function clipHalf(poly: P2[], a: P2, b: P2, left: boolean): P2[] {
  const out: P2[] = [], s = (p: P2) => (left ? 1 : -1) * cross2(a, b, p);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = s(p), sq = s(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0) && Math.abs(sp - sq) > 1e-15) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out.filter((p, i) => { const q = out[(i + 1) % out.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-7; });
}
const ccw = (t: P2[]) => area2(t) >= 0 ? t : [...t].reverse();
function triangulate2(rings: P2[][]): P2[][] {
  const [outer, ...holes] = rings, all = [...outer, ...holes.flat()];
  return T.ShapeUtils.triangulateShape(outer.map(p => new T.Vector2(p[0], p[1])), holes.map(h => h.map(p => new T.Vector2(p[0], p[1])))).map(f => ccw([all[f[0]], all[f[1]], all[f[2]]]));
}
const MIN_PIECE_M2 = 1e-4;
function intersectConvex(poly: P2[], tri: P2[]): P2[] {
  let out = poly;
  for (let i = 0; i < 3 && out.length >= 3; i++) out = clipHalf(out, tri[i], tri[(i + 1) % 3], true);
  return out.length >= 3 && Math.abs(area2(out)) > MIN_PIECE_M2 ? out : [];
}
function subtractConvex(poly: P2[], tri: P2[]): P2[][] {
  const out: P2[][] = [];
  let rem = poly;
  for (let i = 0; i < 3 && rem.length >= 3; i++) {
    const outside = clipHalf(rem, tri[i], tri[(i + 1) % 3], false);
    if (outside.length >= 3 && Math.abs(area2(outside)) > MIN_PIECE_M2) out.push(outside);
    rem = clipHalf(rem, tri[i], tri[(i + 1) % 3], true);
  }
  return out;
}
const bbox = (poly: P2[]) => [Math.min(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[0])), Math.max(...poly.map(p => p[1]))];
const boxesMeet = (a: number[], b: number[]) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/** BAG LoD0 rings → polygons (outer rings with the holes they contain). */
export function bagPolygons(rings: RD[][]): RD[][][] {
  const outers = rings.filter(r => !rings.some(o => o !== r && pointInRing(r[0], o)));
  return outers.map(o => [o, ...rings.filter(r => r !== o && pointInRing(r[0], o))]);
}

/** Roof facets on the BAG outline (local metres), highest LoD2.2 roof first; uncovered parts per `FILL_NEAREST_M`. */
export function bagRoofPieces(bag: P2[][][], roofs: {rings: V3[][]}[], maxM: number, fillM = maxM): {ring: V3[]; source: number | 'max'}[] {
  return bagRoofConvex(bag, roofs, maxM, fillM).map(c => ({ring: c.poly.map(p => [r3(p[0]), r3(Math.min(maxM, Math.max(0, c.plane(p[0], p[1])))), r3(p[1])] as V3), source: c.source}));
}

/** The BAG outline partitioned into convex pieces, each on a LoD2.2 roof plane (or the drift-fill / max plane). */
export function bagRoofConvex(bag: P2[][][], roofs: {rings: V3[][]}[], maxM: number, fillM = maxM): {poly: P2[]; source: number | 'max'; plane: (x: number, z: number) => number}[] {
  let region: P2[][] = bag.flatMap(poly => triangulate2(poly));
  // each roof's own plane (Newell normal through its centroid); facets steeper than 60 degrees cover next to nothing in
  // plan and their plane, extended over a clipped piece, runs to the ground: they are left to the drift fill
  const planes = roofs.map(r => {
    const ring = r.rings[0], n = newell(ring), nl = len3(n) || 1, c = ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length, s[2] + p[2] / ring.length], [0, 0, 0]);
    const plane = (x: number, z: number) => c[1] - (n[0] * (x - c[0]) + n[2] * (z - c[2])) / n[1];
    return {r, plane, steep: Math.abs(n[1]) / nl < 0.5, top: Math.max(...ring.map(p => p[1])), tris: triangulate2(r.rings.map(rr => rr.map(planOf)))};
  });
  const order = planes.map((_, i) => i).filter(i => !planes[i].steep).sort((a, b) => planes[b].top - planes[a].top || a - b);
  const out: {poly: P2[]; source: number | 'max'; plane: (x: number, z: number) => number}[] = [];
  for (const ri of order) {
    const {plane, tris} = planes[ri];
    for (const t of tris) {
      const tb = bbox(t), next: P2[][] = [];
      for (const piece of region) {
        if (!boxesMeet(bbox(piece), tb)) { next.push(piece); continue; }
        const inter = intersectConvex(piece, t);
        if (inter.length) out.push({poly: inter, source: ri, plane});
        next.push(...subtractConvex(piece, t));
      }
      region = next;
    }
  }
  // what no LoD2.2 roof covers: the nearest roof's plane when close (outline drift), else the pand's roof max
  for (const piece of region) {
    const cx = piece.reduce((s, p) => s + p[0], 0) / piece.length, cz = piece.reduce((s, p) => s + p[1], 0) / piece.length;
    let best = -1, bd = Infinity;
    planes.forEach((pl, i) => { if (pl.steep) return; for (const ring of pl.r.rings) for (let k = 0; k < ring.length; k++) { const a = planOf(ring[k]), b = planOf(ring[(k + 1) % ring.length]); const d = segDist2([cx, cz], a, b); if (d < bd) { bd = d; best = i; } } });
    out.push(best >= 0 && bd <= FILL_NEAREST_M ? {poly: piece, source: best, plane: planes[best].plane} : {poly: piece, source: 'max', plane: () => fillM});
  }
  // slivers under 2 cm wide (clipping along near-collinear edges) are dropped: they triangulate to nothing and hide
  // the edges beside them; `bagWalls` pairs the pieces across the gap they leave
  return out.filter(c => { const A = Math.abs(area2(c.poly)), longest = Math.max(...c.poly.map((p, i) => Math.hypot(c.poly[(i + 1) % c.poly.length][0] - p[0], c.poly[(i + 1) % c.poly.length][1] - p[1]))); return 2 * A / longest >= SLIVER_M; });
}
const SLIVER_M = 0.02;
function segDist2(p: P2, a: P2, b: P2) {
  const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy, t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/**
 * Walls of a convex roof partition by adjacency in plan (collinear within a dropped sliver's width), not by the gate's 3D proximity, so thin
 * wedges from the outline triangulation cannot hide an edge: along every piece edge, the stretches no other piece
 * borders are outline (wall to the ground), the stretches a lower piece borders are steps (wall down to that piece).
 * Consecutive stretches of one edge with the same neighbour merge into one wall. Rings are local 3D, unoriented.
 */
export function bagWalls(pieces: {poly: P2[]; plane: (x: number, z: number) => number}[]): V3[][] {
  // adjacency: within a dropped sliver's width of the edge's line (and at least 1 mm along it)
  const EPS = 1e-3, NEAR = SLIVER_M + 0.005, G = 2;
  interface E { a: P2; b: P2; i: number }
  const edges: E[] = pieces.flatMap((pc, i) => pc.poly.map((a, k) => ({a, b: pc.poly[(k + 1) % pc.poly.length], i})));
  const grid = new Map<string, number[]>();
  edges.forEach((e, ei) => {
    for (let x = Math.floor(Math.min(e.a[0], e.b[0]) / G); x <= Math.floor(Math.max(e.a[0], e.b[0]) / G); x++)
      for (let z = Math.floor(Math.min(e.a[1], e.b[1]) / G); z <= Math.floor(Math.max(e.a[1], e.b[1]) / G); z++) { const k = `${x},${z}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(ei); }
  });
  const out: V3[][] = [];
  const h = (i: number, p: P2) => pieces[i].plane(p[0], p[1]);
  const centroid = pieces.map(pc => [pc.poly.reduce((s, p) => s + p[0], 0) / pc.poly.length, pc.poly.reduce((s, p) => s + p[1], 0) / pc.poly.length] as P2);
  for (const e of edges) {
    const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1], L = Math.hypot(dx, dz);
    if (L < 1e-4) continue;
    const at = (t: number): P2 => [e.a[0] + dx * t, e.a[1] + dz * t];
    const cand = new Set<number>();
    for (let x = Math.floor(Math.min(e.a[0], e.b[0]) / G); x <= Math.floor(Math.max(e.a[0], e.b[0]) / G); x++)
      for (let z = Math.floor(Math.min(e.a[1], e.b[1]) / G); z <= Math.floor(Math.max(e.a[1], e.b[1]) / G); z++) for (const ei of grid.get(`${x},${z}`) ?? []) cand.add(ei);
    const spans: {t0: number; t1: number; j: number}[] = [];
    for (const ei of cand) {
      const f = edges[ei];
      if (f.i === e.i) continue;
      const off = (p: P2) => Math.abs((p[0] - e.a[0]) * dz - (p[1] - e.a[1]) * dx) / L;
      if (off(f.a) > NEAR || off(f.b) > NEAR) continue;
      // a neighbour lies across the edge: its piece on the other side of the line from this piece
      const side = (p: P2) => (p[0] - e.a[0]) * dz - (p[1] - e.a[1]) * dx;
      if (side(centroid[e.i]) * side(centroid[f.i]) >= 0) continue;
      const ta = ((f.a[0] - e.a[0]) * dx + (f.a[1] - e.a[1]) * dz) / (L * L), tb = ((f.b[0] - e.a[0]) * dx + (f.b[1] - e.a[1]) * dz) / (L * L);
      const t0 = Math.max(0, Math.min(ta, tb)), t1 = Math.min(1, Math.max(ta, tb));
      if ((t1 - t0) * L > EPS) spans.push({t0, t1, j: f.i});
    }
    const cuts = [...new Set([0, 1, ...spans.flatMap(s => [s.t0, s.t1])])].sort((x, y) => x - y);
    // elementary stretches: the neighbour (or none) and the wall's foot at both ends
    const parts: {t0: number; t1: number; j: number}[] = [];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const t0 = cuts[k], t1 = cuts[k + 1];
      if ((t1 - t0) * L < EPS) continue;
      const m = (t0 + t1) / 2, s = spans.find(sp => sp.t0 <= m && sp.t1 >= m);
      const prev = parts[parts.length - 1];
      if (prev && prev.j === (s?.j ?? -1) && Math.abs(prev.t1 - t0) < 1e-12) prev.t1 = t1; else parts.push({t0, t1, j: s?.j ?? -1});
    }
    for (const pt of parts) {
      const p0 = at(pt.t0), p1 = at(pt.t1), top0 = h(e.i, p0), top1 = h(e.i, p1);
      const foot0 = pt.j < 0 ? 0 : h(pt.j, p0), foot1 = pt.j < 0 ? 0 : h(pt.j, p1);
      if (top0 - foot0 < 0.01 && top1 - foot1 < 0.01) continue;
      const v = (p: P2, y: number): V3 => [r3(p[0]), r3(y), r3(p[1])];
      if (top0 - foot0 >= 0.01 && top1 - foot1 >= 0.01) { out.push([v(p0, foot0), v(p1, foot1), v(p1, top1), v(p0, top0)]); continue; }
      // the two planes cross along this stretch: a triangle on the side where this piece is higher
      const c = (top0 - foot0) / ((top0 - foot0) - (top1 - foot1)), pc = at(pt.t0 + (pt.t1 - pt.t0) * c), yc = top0 + (top1 - top0) * c;
      out.push(top0 - foot0 > 0 ? [v(p0, foot0), v(pc, yc), v(p0, top0)] : [v(pc, yc), v(p1, foot1), v(p1, top1)]);
    }
  }
  return out;
}

// ---- facts in, facts out ----

const signedArea = (ring: number[][]) => ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

function wallFacts(surface: number, ringRD: number[][], groundNAP: number, onFootprintEdge: boolean): WallSurfaceFacts {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < ringRD.length; i++) {
    const a = ringRD[i], b = ringRD[(i + 1) % ringRD.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const zs = ringRD.map(p => p[2] - groundNAP);
  return {surface, ringsRD: [ringRD], onFootprintEdge, areaM2: +(Math.hypot(nx, ny, nz) / 2).toFixed(3), bearingDeg: +((Math.atan2(nx, ny) * 180 / Math.PI + 360) % 360).toFixed(2), bottomM: +Math.min(...zs).toFixed(3), topM: +Math.max(...zs).toFixed(3)};
}

export interface ShellOptions { repair: boolean; footprint: 'lod22' | 'bag' }

/**
 * The fitted pre-step: facts with the repaired shell (extra wall surfaces from `REPAIR_SURFACE_BASE`, extra roof
 * facets) and the report. Deterministic; facts without the opt-in never come here.
 */
export function prepareShell(facts: BuildingFacts, opts: ShellOptions): {facts: BuildingFacts; report: ShellRepairReport} {
  if (!facts.wallsRD?.length) throw Error(`${facts.pandId}: facts have no wallsRD; rerun facts.ts with --large`);
  const all = facts.bagFootprintRD.flat(), g = facts.heights.groundNAP;
  const f: Frame = {ax: Math.round(all.reduce((s, p) => s + p[0], 0) / all.length * 100) / 100, ay: Math.round(all.reduce((s, p) => s + p[1], 0) / all.length * 100) / 100, g};
  const loc = (rings: number[][][]) => rings.map(r => r.map(p => toLocal(f, p)));
  const lodWalls = facts.wallsRD.map(w => loc(w.ringsRD)), lodRoofs = facts.roofsRD.map(r => loc(r.ringsRD));
  const lodHost = hostTriangles(lodWalls, lodRoofs);
  // as the large gate: a courtyard-less LoD0 ring may take the LoD2.2 ground's holes as its courtyards
  const iouOf = (polys: number[][][][]) => {
    const rings = polys.flatMap(poly => poly.map(r => r.map(p => [p[0] - f.ax, f.ay - p[1]])));
    const holes = polys.flatMap(poly => poly.slice(1));
    const plain = footprintIoU(facts, rings, [f.ax, f.ay]);
    return +(facts.bagFootprintRD.length === 1 && holes.length ? Math.max(plain, footprintIoU({...facts, bagFootprintRD: [...facts.bagFootprintRD, ...holes as RD[][]]}, rings, [f.ax, f.ay])) : plain).toFixed(3);
  };
  const iouBefore = iouOf(facts.surveyFootprintPolygonsRD);
  let host = lodHost, roofsRD = facts.roofsRD, wallsRD: WallSurfaceFacts[] = facts.wallsRD, ground = facts.surveyFootprintPolygonsRD, spikes = 0;
  let preset: Patch[] = [];
  const openBeforeM = gateOpen(lodHost);
  if (opts.repair && opts.footprint !== 'bag') {
    // slanted LoD2.2 walls are roof for the kit (and for the spike rule)
    const slanted = lodWalls.filter(w => { const n = newell(w[0]), l = len3(n); return l >= 0.02 && Math.abs(n[1] / l) > 0.25; });
    const ends = openPieces(lodHost).flatMap(pc => { const t = lodHost[pc.owner]; return [t.a, t.b, t.c]; });
    const c = clampSpikes(lodWalls, [...lodRoofs, ...slanted], ends);
    spikes = c.clamped;
    if (spikes) {
      wallsRD = facts.wallsRD.map((w, i) => c.walls[i].every((r, k) => r.every((p, j) => p[1] === lodWalls[i][k][j][1])) ? w
        : {...wallFacts(w.surface, c.walls[i][0].map(q => toRD(f, q)), g, w.onFootprintEdge), ringsRD: c.walls[i].map(r => r.map(q => toRD(f, q)))});
      host = hostTriangles(c.walls, lodRoofs);
    }
  }
  if (opts.footprint === 'bag') {
    const polys = bagPolygons(facts.bagFootprintRD);
    const local = polys.map(poly => poly.map(r => r.map(p => [p[0] - f.ax, f.ay - p[1]] as P2)));
    const maxM = facts.heights.roofMaxM, conv = bagRoofConvex(local, lodRoofs.map(rings => ({rings})), maxM, Math.min(maxM, facts.heights.dak70pM));
    const pieces = conv.map(c => ({rings: [c.poly.map(p => [r3(p[0]), r3(Math.min(maxM, Math.max(0, c.plane(p[0], p[1])))), r3(p[1])] as V3)], source: c.source}));
    roofsRD = pieces.map((p, i) => {
      const rings = p.rings.map(r => r.map(q => toRD(f, q))), ring = rings[0], plane = fitPlane(ring), x0 = ring[0];
      const gx = plane(x0[0] + 1, x0[1]) - plane(x0[0], x0[1]), gy = plane(x0[0], x0[1] + 1) - plane(x0[0], x0[1]);
      return {surfaceId: `${facts.pandId}:bag:roof:${i}${p.source === 'max' ? ':fill' : `:from${p.source}`}`, vertices: ring, ringsRD: rings, slopeDeg: Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI, areaM2: Math.abs(signedArea(ring))};
    });
    wallsRD = [];
    ground = polys;
    const roofTris = hostTriangles([], pieces.map(p => p.rings));
    preset = bagWalls(conv.map(c => ({poly: c.poly, plane: (x: number, z: number) => Math.min(maxM, Math.max(0, c.plane(x, z)))}))).map(ring => ({kind: 'strip' as const, target: 'wall' as const, ring: orientOutward(ring, roofTris), edgeM: 0}));
    host = hostTriangles(preset.map(p => [p.ring]), pieces.map(p => p.rings));
  }
  const res = opts.repair || opts.footprint === 'bag' ? repairHost(host) : {tris: host, patches: [] as Patch[], openBeforeM: gateOpen(host), openAfterM: gateOpen(host), leftover: []};
  res.patches = [...preset, ...res.patches];
  const newWalls: WallSurfaceFacts[] = [], newRoofs: BuildingFacts['roofsRD'] = [];
  res.patches.forEach((p, i) => {
    const ring = p.ring.map(q => toRD(f, q));
    if (p.target === 'wall') newWalls.push(wallFacts(REPAIR_SURFACE_BASE + newWalls.length, ring, g, p.ring.some(q => q[1] <= BASE_M)));
    else {
      const plane = fitPlane(ring), x0 = ring[0], gx = plane(x0[0] + 1, x0[1]) - plane(x0[0], x0[1]), gy = plane(x0[0], x0[1] + 1) - plane(x0[0], x0[1]);
      newRoofs.push({surfaceId: `${facts.pandId}:repair:${p.kind}:${i}`, vertices: ring, ringsRD: [ring], slopeDeg: Math.atan(Math.hypot(gx, gy)) * 180 / Math.PI, areaM2: Math.abs(signedArea(ring))});
    }
  });
  const out: BuildingFacts = {...facts, surveyFootprintPolygonsRD: ground, roofsRD: [...roofsRD, ...newRoofs], wallsRD: [...wallsRD, ...newWalls]};
  const count = (k: PatchKind) => res.patches.filter(p => p.kind === k).length;
  const report: ShellRepairReport = {
    mode: {...opts}, openBeforeM: +openBeforeM.toFixed(2), openAfterM: +res.openAfterM.toFixed(2), closedM: +(openBeforeM - res.openAfterM).toFixed(2),
    patches: {spikes, cap: count('cap'), strip: count('strip'), seam: count('seam'), wallSurfaces: newWalls.map(w => w.surface), roofFacets: newRoofs.length},
    iouBefore, iouAfter: opts.footprint === 'bag' ? iouOf(ground) : iouBefore, leftover: res.leftover,
  };
  return {facts: out, report};
}
