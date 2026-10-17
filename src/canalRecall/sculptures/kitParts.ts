/**
 * Kit-model surgery for statue reconstructions: split a kit landmark's triangles into parts (welded connected pieces of one
 * material, merged where their boxes touch), so a reconstructed figure can replace exactly the kit figure it stands for while the
 * plinth, pier or architecture stay kit. Pure geometry; glTF IO lives in scripts/sculptures/kit-compose.ts.
 */
export type V3 = [number, number, number];
export interface Tri { a: V3; b: V3; c: V3; material: string }
export interface Part { material: string; count: number; min: V3; max: V3; tris: number[] }
export interface Box { min: V3; max: V3 }

const key = (v: V3) => `${Math.round(v[0] * 1000)},${Math.round(v[1] * 1000)},${Math.round(v[2] * 1000)}`;

function find(p: number[], i: number): number {
  while (p[i] !== i) { p[i] = p[p[i]]; i = p[i]; }
  return i;
}

/** Parts: triangles sharing a welded vertex (1 mm) and a material are one piece; pieces of a material whose boxes come within `touch` metres merge. Sorted by triangle count, largest first. */
export function partsOf(tris: Tri[], touch = 0.03): Part[] {
  const parent = tris.map((_, i) => i);
  const seen = new Map<string, number>();
  tris.forEach((t, i) => {
    for (const v of [t.a, t.b, t.c]) {
      const k = `${t.material}|${key(v)}`;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i); else parent[find(parent, i)] = find(parent, j);
    }
  });
  const groups = new Map<number, number[]>();
  tris.forEach((_, i) => { const r = find(parent, i); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(i); });
  let parts: Part[] = [...groups.values()].map(ix => {
    const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
    for (const i of ix) for (const v of [tris[i].a, tris[i].b, tris[i].c]) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
    return {material: tris[ix[0]].material, count: ix.length, min, max, tris: ix};
  });
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      const p = parts[i], q = parts[j];
      if (p.material !== q.material) continue;
      if ([0, 1, 2].some(k => p.min[k] > q.max[k] + touch || q.min[k] > p.max[k] + touch)) continue;
      parts[i] = {material: p.material, count: p.count + q.count, tris: [...p.tris, ...q.tris],
        min: [0, 1, 2].map(k => Math.min(p.min[k], q.min[k])) as V3, max: [0, 1, 2].map(k => Math.max(p.max[k], q.max[k])) as V3};
      parts.splice(j, 1);
      merged = true;
      break outer;
    }
  }
  parts = parts.sort((a, b) => b.count - a.count);
  return parts;
}

/** True when the triangle's centroid lies inside the box. */
export function centroidIn(t: Tri, b: Box): boolean {
  return [0, 1, 2].every(k => { const c = (t.a[k] + t.b[k] + t.c[k]) / 3; return c >= b.min[k] && c <= b.max[k]; });
}

/** Indices of the kit triangles to drop: centroid inside any cut box, restricted to the given materials when listed. */
export function cutTriangles(tris: Tri[], cuts: Box[], materials?: string[]): Set<number> {
  const out = new Set<number>();
  tris.forEach((t, i) => {
    if (materials?.length && !materials.some(m => t.material.includes(m))) return;
    if (cuts.some(b => centroidIn(t, b))) out.add(i);
  });
  return out;
}

export interface MaterialCut { box: Box; materials: string[] }

/**
 * The same cut applied to one builder part (a flat non-indexed position array of one material) while the landmark is built:
 * indices of the triangles to keep. A triangle goes when its centroid lies in a cut whose materials match (by substring, as
 * in cutTriangles; an empty list matches every material), so an installed reconstruction drops exactly the kit triangles its
 * comparison sheet dropped.
 */
export function keptTriangles(positions: ArrayLike<number>, material: string, cuts: MaterialCut[]): number[] {
  const live = cuts.filter(c => !c.materials.length || c.materials.some(m => material.includes(m)));
  const keep: number[] = [];
  for (let t = 0; t * 9 + 8 < positions.length; t++) {
    const v = (k: number): V3 => [positions[t * 9 + k * 3], positions[t * 9 + k * 3 + 1], positions[t * 9 + k * 3 + 2]];
    if (!live.some(c => centroidIn({a: v(0), b: v(1), c: v(2), material}, c.box))) keep.push(t);
  }
  return keep;
}

/** Union box of the dropped triangles: where the replacement stands (base centre) and how tall it is. */
export function boxOf(tris: Tri[], idx: Iterable<number>): Box | null {
  const min: V3 = [Infinity, Infinity, Infinity], max: V3 = [-Infinity, -Infinity, -Infinity];
  let any = false;
  for (const i of idx) for (const v of [tris[i].a, tris[i].b, tris[i].c]) { any = true; for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); } }
  return any ? {min, max} : null;
}
