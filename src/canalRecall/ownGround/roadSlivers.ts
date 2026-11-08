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
