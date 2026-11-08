// Junction slivers and kerb stubs in the roads-v1 partition (engine round 5, lane R5-C2, issue #263).
//
// The BGT partition is drawn as surveyed: at junction mouths the bronhouder's polygons leave slivers (a wedge of
// footway 30 cm wide between a fietspad and a carriageway, a 1 m² triangle of island) and every shared edge between a
// road-level and a pavement-level polygon becomes a kerb line, also around those slivers. This module measures them
// (the lane's step 1) and dissolves them (step 2) on decoded or raw polygons, pure and dependency-free so the
// extractor, the probes and the tests share it.
//
// Rules (brief R5-C2 step 2):
//   sliver   a polygon under SLIVER_AREA_M2 or thinner than SLIVER_WIDTH_M (2·area / perimeter, the mean width of a
//            strip) merges into its longest same-level neighbour (shared boundary length, same `h`);
//   dissolve same-class, same-mesh, same-`h` neighbours sharing an edge dissolve into one polygon (no kerb between);
//   kerbs    a kerb run shorter than KERB_MIN_M is not drawn.

import type { EncodedLine, RoadCell, RoadClass, RoadSurface } from './roadCells.js';
import { kerbBetween } from './roadCells.js';

export type Vec2 = [number, number];

/** A polygon under this area (m²) is a sliver. */
export const SLIVER_AREA_M2 = 2;
/** A polygon thinner than this (m, 2·area / perimeter) is a sliver. */
export const SLIVER_WIDTH_M = 0.4;
/** A kerb run shorter than this (m) is a stub, not drawn. */
export const KERB_MIN_M = 1.5;

export function ringArea(r: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
}
export function ringPerimeter(r: readonly Vec2[]): number {
  let p = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) p += Math.hypot(r[i][0] - r[j][0], r[i][1] - r[j][1]);
  return p;
}
export function lineLength(l: readonly Vec2[]): number {
  let p = 0;
  for (let i = 1; i < l.length; i++) p += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
  return p;
}

/** Net area (outer minus holes) and total perimeter of a polygon given as rings (outer first; open or closed). */
export function polygonShape(rings: readonly (readonly Vec2[])[]): { area: number; perimeter: number; width: number } {
  let area = 0, perimeter = 0;
  rings.forEach((r, i) => { const a = Math.abs(ringArea(r)); area += i === 0 ? a : -a; perimeter += ringPerimeter(r); });
  area = Math.max(0, area);
  return { area, perimeter, width: perimeter > 0 ? 2 * area / perimeter : 0 };
}

export function isSliver(shape: { area: number; width: number }): boolean {
  return shape.area < SLIVER_AREA_M2 || shape.width < SLIVER_WIDTH_M;
}

/** A vertex key on the decimetre grid of the published cells (exact: shared edges carry identical vertices). */
export const dmKey = (p: Vec2): string => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
const edgeKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;

export interface SliverPoly { c: string; k: string; h: number; rings: Vec2[][] }

export interface SliverStats {
  polygons: number;
  /** Polygons under SLIVER_AREA_M2. */
  tiny: number;
  /** Polygons at or above the area floor but thinner than SLIVER_WIDTH_M. */
  thin: number;
  /** tiny + thin. */
  slivers: number;
  /** Sliver area (m²). */
  sliverM2: number;
  /** Shared edges between two polygons of the same class, mesh and h (a seam the dissolve removes). */
  sameClassEdges: number;
  /** Polygons with at least one same-class same-h neighbour. */
  sameClassPolys: number;
  kerbRuns: number;
  /** Kerb runs shorter than KERB_MIN_M. */
  kerbShort: number;
  /** Kerb segments (between consecutive vertices). */
  kerbEdges: number;
  /** Kerb segments shorter than KERB_MIN_M. */
  kerbEdgesShort: number;
  kerbM: number;
  /** Kerb runs that touch a sliver polygon's boundary (a kerb drawn around a sliver). */
  kerbAroundSliver: number;
}

/** The edge → polygon-index map of a polygon set on the decimetre grid. */
export function edgeOwners(polys: readonly SliverPoly[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  polys.forEach((p, i) => {
    for (const r of p.rings) for (let a = 0; a < r.length; a++) {
      const ka = dmKey(r[a]), kb = dmKey(r[(a + 1) % r.length]);
      if (ka === kb) continue;
      const k = edgeKey(ka, kb), l = out.get(k);
      if (!l) out.set(k, [i]); else if (!l.includes(i)) l.push(i);
    }
  });
  return out;
}

/** Sliver, seam and kerb counts for one decoded cell. */
export function sliverStats(polys: readonly SliverPoly[], kerbs: readonly (readonly Vec2[])[]): SliverStats {
  const s: SliverStats = { polygons: polys.length, tiny: 0, thin: 0, slivers: 0, sliverM2: 0, sameClassEdges: 0, sameClassPolys: 0, kerbRuns: kerbs.length, kerbShort: 0, kerbEdges: 0, kerbEdgesShort: 0, kerbM: 0, kerbAroundSliver: 0 };
  const sliverVerts = new Set<string>();
  for (const p of polys) {
    const sh = polygonShape(p.rings);
    if (sh.area < SLIVER_AREA_M2) s.tiny++; else if (sh.width < SLIVER_WIDTH_M) s.thin++; else continue;
    s.sliverM2 += sh.area;
    for (const r of p.rings) for (const v of r) sliverVerts.add(dmKey(v));
  }
  s.slivers = s.tiny + s.thin;
  const seamPolys = new Set<number>();
  for (const owners of edgeOwners(polys).values()) {
    if (owners.length !== 2) continue;
    const [a, b] = owners.map(i => polys[i]);
    if (a.c === b.c && a.k === b.k && a.h === b.h) { s.sameClassEdges++; seamPolys.add(owners[0]); seamPolys.add(owners[1]); }
  }
  s.sameClassPolys = seamPolys.size;
  for (const k of kerbs) {
    const len = lineLength(k);
    s.kerbM += len;
    if (len < KERB_MIN_M) s.kerbShort++;
    for (let i = 1; i < k.length; i++) { s.kerbEdges++; if (Math.hypot(k[i][0] - k[i - 1][0], k[i][1] - k[i - 1][1]) < KERB_MIN_M) s.kerbEdgesShort++; }
    if (k.filter(v => sliverVerts.has(dmKey(v))).length >= 2) s.kerbAroundSliver++;
  }
  s.sliverM2 = Math.round(s.sliverM2 * 10) / 10;
  s.kerbM = Math.round(s.kerbM);
  return s;
}

// ------------------------------------------------------------------ the dissolve (step 2)


/**
 * Classes whose same-mesh neighbours at ground level dissolve into one polygon (no kerb runs between them). Not the
 * footway family: the runtime reads single foot polygons (RoadIndex.parkingIslands, crossingStrips) and a merged strip
 * would stop being one; not a red carriageway (fietsstraat): greyFietsstraat turns a whole polygon grey by one point.
 */
export const DISSOLVE_CLASSES: readonly RoadClass[] = ['carriage', 'cycle', 'parking'];

type P = [number, number];
const pk = (p: P) => `${p[0]},${p[1]}`;
const ek = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;

function decodeInt(e: readonly number[]): P[] {
  const out: P[] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < e.length; i += 2) { x += e[i]; y += e[i + 1]; if (!out.length || out[out.length - 1][0] !== x || out[out.length - 1][1] !== y) out.push([x, y]); }
  while (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out;
}
function encodeInt(pts: readonly P[]): EncodedLine {
  const out: number[] = [];
  let x = 0, y = 0;
  for (const [px, py] of pts) { out.push(px - x, py - y); x = px; y = py; }
  return out;
}
const area2 = (r: readonly P[]) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return -a; };
function inRingInt(r: readonly P[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
}

/** Rings (outer CCW, holes CW) traced from a set of directed edges; at a vertex with several ways out, the rightmost turn. */
function traceRings(edges: Map<string, P[]>, at: Map<string, P>): P[][] | null {
  const out: P[][] = [];
  const left = new Map<string, P[]>();
  let n = 0;
  for (const [k, l] of edges) { left.set(k, [...l]); n += l.length; }
  let guard = 0;
  while (n > 0) {
    const startKey = [...left.entries()].find(([, l]) => l.length)![0];
    const ring: P[] = [];
    let cur = startKey, prev: P | null = null;
    for (;;) {
      if (++guard > 1e6) return null;
      const outs = left.get(cur)!;
      if (!outs?.length) return null;
      const p = at.get(cur)!;
      let pick = 0;
      if (outs.length > 1 && prev) {
        // Rightmost turn from the incoming direction (keeps touching regions apart).
        const din = Math.atan2(p[1] - prev[1], p[0] - prev[0]);
        let best = Infinity;
        outs.forEach((q, i) => { let t = Math.atan2(q[1] - p[1], q[0] - p[0]) - din; while (t <= -Math.PI) t += 2 * Math.PI; while (t > Math.PI) t -= 2 * Math.PI; if (t < best) { best = t; pick = i; } });
      }
      const next = outs.splice(pick, 1)[0];
      n--;
      ring.push(p);
      prev = p;
      cur = pk(next);
      if (cur === startKey) break;
    }
    if (ring.length >= 3) out.push(ring);
  }
  return out;
}

/** The union of polygons (rings normalised) that tile without overlap: shared edges cancel. Null when the trace fails. */
function unionPolys(polys: readonly P[][][]): P[][][] | null {
  const directed = new Map<string, P[]>(), at = new Map<string, P>(), count = new Map<string, number>();
  for (const rings of polys) rings.forEach((r0, i) => {
    const r = (i === 0) === (area2(r0) > 0) ? r0 : [...r0].reverse();
    for (let a = 0; a < r.length; a++) {
      const p = r[a], q = r[(a + 1) % r.length], kp = pk(p), kq = pk(q);
      if (kp === kq) continue;
      at.set(kp, p); at.set(kq, q);
      const rev = `${kq}>${kp}`;
      if ((count.get(rev) ?? 0) > 0) { count.set(rev, count.get(rev)! - 1); continue; }
      count.set(`${kp}>${kq}`, (count.get(`${kp}>${kq}`) ?? 0) + 1);
    }
  });
  for (const [k, c] of count) for (let i = 0; i < c; i++) { const [a, b] = k.split('>'); (directed.get(a) ?? directed.set(a, []).get(a)!).push(at.get(b)!); }
  const rings = traceRings(directed, at);
  if (!rings) return null;
  const outers = rings.filter(r => area2(r) > 0), holes = rings.filter(r => area2(r) < 0);
  if (!outers.length) return null;
  const result: P[][][] = outers.map(o => [o]);
  for (const h of holes) {
    // A point just inside the hole's first edge (to its right: holes run clockwise, so the hole's interior is right).
    const a = h[0], b = h[1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const px = mx + (b[1] - a[1]) / l * 0.01, py = my - (b[0] - a[0]) / l * 0.01;
    const owner = result.filter(o => inRingInt(o[0], px, py)).sort((u, v) => Math.abs(area2(u[0])) - Math.abs(area2(v[0])))[0];
    if (!owner) return null;
    owner.push(h);
  }
  return result;
}

export interface DissolveStats {
  polygonsBefore: number; polygonsAfter: number;
  slivers: number; sliversMerged: number; sliversKept: number;
  /** Ground-level polygons dissolved into a same-class neighbour. */
  seamsDissolved: number;
  /** m² of sliver area that changed class, by `from>to`. */
  movedM2: Record<string, number>;
  byClassBefore: Record<string, number>; byClassAfter: Record<string, number>;
  kerbRunsBefore: number; kerbRunsAfter: number; kerbStubsDropped: number; kerbSegmentsRemoved: number; kerbSegmentsAdded: number;
  unionFailed: number;
}

/**
 * Step 2 of R5-C2 on one cell (version 2 in, version 3 out). Coordinates stay on the published decimetre grid, where
 * two polygons sharing an edge carry identical vertices (topoSimplify.ts), so the shared edges cancel exactly:
 *   1. a ground-level sliver (isSliver) joins the same-level neighbour it shares the longest boundary with and takes
 *      its class and mesh (deck slivers are left to the deck path);
 *   2. ground-level DISSOLVE_CLASSES neighbours of the same class and mesh dissolve (`seams`, default on);
 *   3. kerb segments on an edge that is now inside a polygon, or between classes that no longer kerb, go; a sliver's
 *      outer edge that now kerbs (an in-cell neighbour) gains one; runs shorter than KERB_MIN_M go.
 * Untouched polygons and kerb runs are written back as they were.
 */
export function dissolveSlivers(cell: RoadCell, opts: { seams?: boolean } = {}): { cell: RoadCell; stats: DissolveStats } {
  const seams = opts.seams !== false;
  const surf = cell.surfaces;
  const rings = surf.map(s => s.r.map(decodeInt));
  const stats: DissolveStats = { polygonsBefore: surf.length, polygonsAfter: 0, slivers: 0, sliversMerged: 0, sliversKept: 0, seamsDissolved: 0, movedM2: {}, byClassBefore: {}, byClassAfter: {}, kerbRunsBefore: cell.kerbs.length, kerbRunsAfter: 0, kerbStubsDropped: 0, kerbSegmentsRemoved: 0, kerbSegmentsAdded: 0, unionFailed: 0 };
  for (const s of surf) stats.byClassBefore[s.c] = (stats.byClassBefore[s.c] ?? 0) + 1;
  // Undirected edges → polygons.
  const owners = new Map<string, number[]>(), edgeLen = new Map<string, number>();
  rings.forEach((rs, i) => { for (const r of rs) for (let a = 0; a < r.length; a++) {
    const p = r[a], q = r[(a + 1) % r.length], k = ek(pk(p), pk(q));
    const l = owners.get(k);
    if (!l) { owners.set(k, [i]); edgeLen.set(k, Math.hypot(q[0] - p[0], q[1] - p[1]) / 10); } else if (!l.includes(i)) l.push(i);
  } });
  const nbrLen = (i: number): Map<number, number> => {
    const m = new Map<number, number>();
    for (const r of rings[i]) for (let a = 0; a < r.length; a++) {
      const k = ek(pk(r[a]), pk(r[(a + 1) % r.length]));
      for (const j of owners.get(k) ?? []) if (j !== i) m.set(j, (m.get(j) ?? 0) + edgeLen.get(k)!);
    }
    return m;
  };
  const parent = surf.map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  // Group attributes: the class and mesh of the group's non-sliver member (its root is chosen to be that one).
  const shape = rings.map(rs => polygonShape(rs.map(r => r.map(([x, y]) => [x / 10, y / 10] as Vec2))));
  const sliver = shape.map((sh, i) => surf[i].h === 0 && isSliver(sh));
  // 1. Slivers, smallest first, each into its longest same-level neighbour (a non-sliver group wins a tie).
  const order = surf.map((_, i) => i).filter(i => sliver[i]).sort((a, b) => shape[a].area - shape[b].area);
  for (const i of surf.keys()) if (surf[i].h === 0 && isSliver(shape[i])) stats.slivers++;
  for (const i of order) {
    let best = -1, bestLen = 0;
    for (const [j, len] of nbrLen(i)) {
      if (surf[j].h !== surf[i].h || find(j) === find(i)) continue;
      const score = len + (sliver[find(j)] ? 0 : 1e-3);
      if (score > bestLen) { bestLen = score; best = j; }
    }
    if (best < 0) { stats.sliversKept++; continue; }
    const ri = find(i), rj = find(best);
    parent[ri] = rj;
    stats.sliversMerged++;
    const from = surf[i].c, to = surf[rj].c;
    if (from !== to || surf[i].k !== surf[rj].k) stats.movedM2[`${from}>${to}`] = +((stats.movedM2[`${from}>${to}`] ?? 0) + shape[i].area).toFixed(2);
  }
  // 2. Same-class seams.
  if (seams) for (const [, l] of owners) {
    if (l.length !== 2) continue;
    const [a, b] = l, ra = find(a), rb = find(b);
    if (ra === rb) continue;
    const A = surf[ra], B = surf[rb];
    if (A.h !== 0 || B.h !== 0 || A.c !== B.c || A.k !== B.k || !DISSOLVE_CLASSES.includes(A.c) || (A.c === 'carriage' && A.k === 'cycle')) continue;
    parent[ra] = rb; stats.seamsDissolved++;
  }
  // Groups → polygons.
  const groups = new Map<number, number[]>();
  surf.forEach((_, i) => { const r = find(i); (groups.get(r) ?? groups.set(r, []).get(r)!).push(i); });
  const outSurf: RoadSurface[] = [];
  const classOfMember = new Map<number, RoadSurface>();
  for (const [root, members] of [...groups.entries()].sort((x, y) => Math.min(...x[1]) - Math.min(...y[1]))) {
    const base = surf[root];
    for (const m of members) classOfMember.set(m, base);
    if (members.length === 1) { outSurf.push(surf[root]); continue; }
    const u = unionPolys(members.map(m => rings[m]));
    if (!u) { stats.unionFailed++; for (const m of members) { outSurf.push(surf[m]); classOfMember.set(m, surf[m]); } continue; }
    for (const poly of u) outSurf.push({ k: base.k, c: base.c, h: base.h, r: poly.map(encodeInt) });
  }
  stats.polygonsAfter = outSurf.length;
  for (const s of outSurf) stats.byClassAfter[s.c] = (stats.byClassAfter[s.c] ?? 0) + 1;
  // 3. Kerbs. A segment on an edge whose two polygons are now one group, or whose new classes do not kerb, goes.
  const changed = new Set<number>();
  for (const [, members] of groups) if (members.length > 1) for (const m of members) changed.add(m);
  const kerbAfter = (k: string): boolean | null => {
    const l = owners.get(k);
    if (!l || l.length !== 2 || (!changed.has(l[0]) && !changed.has(l[1]))) return null; // not ours to judge
    if (find(l[0]) === find(l[1])) return false;
    return kerbBetween({ c: classOfMember.get(l[0])!.c, h: classOfMember.get(l[0])!.h }, { c: classOfMember.get(l[1])!.c, h: classOfMember.get(l[1])!.h });
  };
  const kept: EncodedLine[] = [], segs: [P, P][] = [], hasKerb = new Set<string>();
  for (const e of cell.kerbs) {
    const run = decodeInt(e);
    let touched = false;
    for (let a = 0; a + 1 < run.length; a++) if (kerbAfter(ek(pk(run[a]), pk(run[a + 1]))) === false) { touched = true; break; }
    for (let a = 0; a + 1 < run.length; a++) hasKerb.add(ek(pk(run[a]), pk(run[a + 1])));
    if (!touched) { kept.push(e); continue; }
    for (let a = 0; a + 1 < run.length; a++) { if (kerbAfter(ek(pk(run[a]), pk(run[a + 1]))) === false) stats.kerbSegmentsRemoved++; else segs.push([run[a], run[a + 1]]); }
  }
  // New kerbs along a merged sliver's outer edges that now separate a low and a high class (both polygons in the cell).
  // Only where the pair did not kerb before (a sliver changed class): elsewhere a missing kerb is the neighbour cell's run
  // (a run belongs to the cell its midpoint is in) or one the extract left out on purpose.
  for (const [k, l] of owners) {
    if (hasKerb.has(k) || kerbAfter(k) !== true || kerbBetween({ c: surf[l[0]].c, h: surf[l[0]].h }, { c: surf[l[1]].c, h: surf[l[1]].h })) continue;
    const [a, b] = k.split('|').map(s => s.split(',').map(Number) as P);
    segs.push([a, b]); stats.kerbSegmentsAdded++;
  }
  // Untouched runs keep their exact encoding; re-chained runs are encoded anew; stubs go.
  const out: EncodedLine[] = [];
  const long = (r: readonly P[]) => lineLength(r.map(([x, y]) => [x / 10, y / 10] as Vec2)) >= KERB_MIN_M;
  for (const e of kept) { if (long(decodeInt(e))) out.push(e); else stats.kerbStubsDropped++; }
  for (const r of chainSegments(segs)) { if (long(r)) out.push(encodeInt(r)); else stats.kerbStubsDropped++; }
  stats.kerbRunsAfter = out.length;
  return { cell: { version: 3, key: cell.key, surfaces: outSurf, kerbs: out, coverWays: cell.coverWays }, stats };
}

/** Segments chained into runs at vertices of degree ≠ 2 (then any leftover loops), as build-bgt-roads kerbRuns. */
function chainSegments(segs: readonly [P, P][]): P[][] {
  const adj = new Map<string, string[]>(), at = new Map<string, P>();
  for (const [a, b] of segs) {
    const ka = pk(a), kb = pk(b);
    if (ka === kb) continue;
    at.set(ka, a); at.set(kb, b);
    (adj.get(ka) ?? adj.set(ka, []).get(ka)!).push(kb);
    (adj.get(kb) ?? adj.set(kb, []).get(kb)!).push(ka);
  }
  const used = new Set<string>(), runs: P[][] = [];
  const walk = (start: string, next: string) => {
    const run = [at.get(start)!];
    let prev = start, cur = next;
    used.add(ek(prev, cur));
    for (;;) {
      run.push(at.get(cur)!);
      const ns = adj.get(cur)!;
      if (ns.length !== 2) break;
      const n = ns[0] === prev ? ns[1] : ns[0], e = ek(cur, n);
      if (used.has(e)) break;
      used.add(e); prev = cur; cur = n;
    }
    runs.push(run);
  };
  for (const [v, ns] of adj) if (ns.length !== 2) for (const n of ns) if (!used.has(ek(v, n))) walk(v, n);
  for (const [v, ns] of adj) for (const n of ns) if (!used.has(ek(v, n))) walk(v, n);
  return runs;
}
