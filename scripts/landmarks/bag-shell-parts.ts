/**
 * The 3DBAG LoD2.2 shell of one BAG pand as `Surface`s in a landmark's native frame (x east, z south, y up from the 3DBAG
 * ground, metres from an RD anchor), over every BuildingPart of the pand (lane hand-blocks-c-20261122).
 *
 * bag-shell-prepare.ts used to read only part `-0`; a pand 3DBAG splits into parts (Klapmutsenveem 30-62: three parts,
 * 110 + 76 + 11 surfaces) then lost most of its length. Parts are read in numeric order, so a single-part pand comes out
 * exactly as before. Where two parts abut, each solid carries a wall on the shared plane; a wall of one part that lies
 * wholly inside an opposite-facing coplanar wall of another part is interior and dropped (the taller part keeps its wall,
 * whose top half is the exterior step).
 */
export type Surface = {type: string; rings: number[][][]};
type Geometry = {lod: string; boundaries: number[][][][]; semantics: {surfaces: {type: string}[]; values: number[][]}};
type CityObject = {children?: string[]; geometry?: Geometry[]};
export type BagFeature = {CityObjects: Record<string, CityObject>; vertices: number[][]};
export type Transform = {scale: number[]; translate: number[]};

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The pand's BuildingPart ids in numeric suffix order; `<pand>-0` when the parent lists none. */
export function partIds(feature: BagFeature, pand: string): string[] {
  const key = `NL.IMBAG.Pand.${pand}`, kids = feature.CityObjects[key]?.children ?? [];
  const suffix = (s: string) => Number(s.slice(s.lastIndexOf('-') + 1));
  return kids.length ? [...kids].sort((a, b) => suffix(a) - suffix(b)) : [`${key}-0`];
}

/** Native vertices: RD minus anchor, y above `ground` (clamped at 0), z = -north. */
export function nativeVertices(feature: BagFeature, tr: Transform, anchor: [number, number], ground: number): number[][] {
  return feature.vertices.map(v => {
    const p = v.map((n, i) => n * tr.scale[i] + tr.translate[i]);
    return [r3(p[0] - anchor[0]), r3(Math.max(0, p[2] - ground)), r3(-(p[1] - anchor[1]))];
  });
}

/** Newell normal (unit) of a ring, or null when degenerate. */
function normal(r: number[][]): number[] | null {
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < r.length; k++) {
    const a = r[k], b = r[(k + 1) % r.length];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z);
  return l < 1e-9 ? null : [x / l, y / l, z / l];
}
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Point in polygon (2D, boundary within `tol` counts as inside). */
function inside(p: number[], poly: number[][], tol: number): boolean {
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) <= tol) return true;
  }
  let c = false;
  for (let k = 0, j = poly.length - 1; k < poly.length; j = k++) {
    const a = poly[k], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/**
 * Indices of wall surfaces that are interior: wholly inside an opposite-facing coplanar wall (plane within `tol` m) of a
 * different part. `part[i]` is the part index of surface i.
 */
export function sharedWalls(surfaces: Surface[], part: number[], tol = 0.03): Set<number> {
  const walls = surfaces.map((s, i) => ({i, n: s.type === 'WallSurface' ? normal(s.rings[0]) : null, r: s.rings[0]}))
    .filter((w): w is {i: number; n: number[]; r: number[][]} => !!w.n && part[w.i] !== undefined);
  const out = new Set<number>();
  for (const A of walls) for (const B of walls) {
    if (part[A.i] === part[B.i] || dot(A.n, B.n) > -0.999) continue;
    const off = dot(B.n, B.r[0]);
    if (A.r.some(p => Math.abs(dot(B.n, p) - off) > tol)) continue;
    // in-plane 2D frame of B: u horizontal along the wall, v up (walls are vertical; fall back to any axis otherwise)
    const u = Math.hypot(B.n[0], B.n[2]) > 1e-6 ? [B.n[2], 0, -B.n[0]] : [1, 0, 0], uL = Math.hypot(...u), uu = u.map(c => c / uL);
    const v = [B.n[1] * uu[2] - B.n[2] * uu[1], B.n[2] * uu[0] - B.n[0] * uu[2], B.n[0] * uu[1] - B.n[1] * uu[0]];
    const to2 = (p: number[]) => [dot(uu, p), dot(v, p)];
    const poly = B.r.map(to2);
    if (A.r.every(p => inside(to2(p), poly, tol))) { out.add(A.i); break; }
  }
  return out;
}

/** The LoD2.2 shell over all parts of `pand`, shared walls between parts dropped. */
export function shellSurfaces(feature: BagFeature, pand: string, verts: number[][]): Surface[] {
  const all: Surface[] = [], part: number[] = [];
  partIds(feature, pand).forEach((id, k) => {
    const g = feature.CityObjects[id]?.geometry?.find(x => x.lod === '2.2');
    if (!g) return;
    g.boundaries[0].forEach((s, i) => {
      all.push({type: g.semantics.surfaces[g.semantics.values[0][i]].type, rings: s.map(r => r.map(j => verts[j]))});
      part.push(k);
    });
  });
  const drop = sharedWalls(all, part);
  return drop.size ? all.filter((_, i) => !drop.has(i)) : all;
}
