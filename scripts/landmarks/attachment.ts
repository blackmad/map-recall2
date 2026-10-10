import * as T from 'three';

/**
 * Facade attachment audit: every detail part (everything added after the builder's `mark('shell')`)
 * must connect to the shell, directly or through other parts, within `tolerance` metres. The reported
 * gap is the bottleneck distance: attach parts nearest-first (Dijkstra-style) and take the largest
 * hop. Mesh-to-mesh distance is the smaller of (vertices of A to triangles of B) and the reverse.
 */
export type Tri = [T.Vector3, T.Vector3, T.Vector3];
export interface Piece {tris: Tri[]; verts: T.Vector3[]; box: T.Box3}

export function pieceOf(g: T.BufferGeometry): Piece {
  const pos = g.getAttribute('position'), idx = g.index;
  const v = (i: number) => new T.Vector3().fromBufferAttribute(pos, i);
  const tris: Tri[] = [];
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) tris.push(idx ? [v(idx.getX(i)), v(idx.getX(i + 1)), v(idx.getX(i + 2))] : [v(i), v(i + 1), v(i + 2)]);
  const verts = new Map<string, T.Vector3>();
  for (const t of tris) for (const p of t) verts.set(`${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`, p);
  const box = new T.Box3();
  for (const p of verts.values()) box.expandByPoint(p);
  return {tris, verts: [...verts.values()], box};
}
const tmp = new T.Triangle(), cp = new T.Vector3();
function oneWay(a: Piece, b: Piece, best: number) {
  for (const p of a.verts) {
    if (b.box.distanceToPoint(p) >= best) continue;
    for (const t of b.tris) {
      tmp.set(t[0], t[1], t[2]); tmp.closestPointToPoint(p, cp);
      const d = cp.distanceTo(p);
      if (d < best) { best = d; if (best < 1e-6) return best; }
    }
  }
  return best;
}
function boxGap(a: T.Box3, b: T.Box3) {
  const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x), dy = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y), dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return Math.hypot(dx, dy, dz);
}
const ray = new T.Ray(), hit = new T.Vector3();
/** True when an edge of `a` passes through a triangle of `b` (a part sunk into a surface is attached). */
function pierces(a: Piece, b: Piece) {
  const seen = new Set<string>();
  for (const t of a.tris) for (let k = 0; k < 3; k++) {
    const p = t[k], q = t[(k + 1) % 3], key = [p, q].map(v => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`).sort().join('|');
    if (seen.has(key)) continue; seen.add(key);
    const len = p.distanceTo(q);
    if (len < 1e-6) continue;
    ray.origin.copy(p); ray.direction.copy(q).sub(p).normalize();
    for (const u of b.tris) if (ray.intersectTriangle(u[0], u[1], u[2], false, hit) && hit.distanceTo(p) <= len) return true;
  }
  return false;
}
export function distance(a: Piece, b: Piece, cap = Infinity) {
  if (boxGap(a.box, b.box) >= cap) return cap;
  const d = Math.min(oneWay(a, b, cap), oneWay(b, a, cap));
  // A piercing part is attached even when `cap` (the best hop found so far) hides a farther surface it passes through.
  if (d > 0.01 && cap > 0.01 && (pierces(a, b) || pierces(b, a))) return 0;
  return d;
}

/** Merge shell triangles into one piece (spatially partitioned so queries stay cheap). */
export function measureAttachment(shell: T.BufferGeometry[], details: T.BufferGeometry[], tolerance = 0.05) {
  const shellPieces = shell.map(pieceOf), parts = details.map(pieceOf);
  const attached: Piece[] = [...shellPieces];
  const remaining = new Set(parts.keys());
  // best known distance of each remaining part to the attached set
  const dist = new Map<number, number>();
  const toNew = (i: number, a: Piece) => distance(parts[i], a, dist.get(i) ?? Infinity);
  for (const i of remaining) dist.set(i, Infinity);
  for (const a of attached) for (const i of remaining) dist.set(i, Math.min(dist.get(i)!, toNew(i, a)));
  let max = 0;
  const worst: {index: number; gap: number; box: number[]}[] = [];
  while (remaining.size) {
    let pick = -1, pd = Infinity;
    for (const i of remaining) if (dist.get(i)! < pd) { pd = dist.get(i)!; pick = i; }
    if (pick < 0) { max = Infinity; break; }
    remaining.delete(pick);
    if (pd > tolerance) worst.push({index: pick, gap: pd, box: [...parts[pick].box.min.toArray(), ...parts[pick].box.max.toArray()].map(n => +n.toFixed(2))});
    max = Math.max(max, pd);
    attached.push(parts[pick]);
    for (const i of remaining) dist.set(i, Math.min(dist.get(i)!, toNew(i, parts[pick])));
  }
  return {max, worst: worst.sort((a, b) => b.gap - a.gap), parts: parts.length};
}
