/**
 * Turns a single-sided sheet (a roof panel grid, a rib band, a canopy) into a closed slab for the shell audit.
 *
 * The audit (glbQuality `holes`) counts an open boundary edge as a hole unless it lies within 3 cm of another surface, and a roof
 * sheet that is only one triangle thick has its whole perimeter open: 800 m for the Centraal station sheds. This returns the extra
 * triangles that close such a sheet: an underside copy pushed `d` metres along the sheet's welded vertex normals (against the
 * normal, i.e. under a roof) with reversed winding, and a skirt quad on every boundary edge of the input.
 *
 * `positions` is a non-indexed triangle list (x,y,z per vertex, three vertices per triangle) whose top faces point along the
 * normals you want the slab to grow away from. Add the result with the same or a darker material; do not add the input twice.
 */
export interface ThickenOptions {
  /** Offset straight down (-y) instead of against the vertex normals: the skirts then land on a bottom surface built as the same sheet shifted by -d in y. */
  vertical?: boolean;
  /** A caller-built underside (a coarser tessellation of the same surface shifted down by d): used instead of a full copy, saves the triangles. Winding is reversed here. */
  bottom?: ArrayLike<number>;
}

export function thickenSheet(positions: ArrayLike<number>, d: number, opts: ThickenOptions = {}): number[] {
  const tris = Math.floor(positions.length / 9);
  const key = (i: number) => `${Math.round(positions[i * 3] * 1e4)},${Math.round(positions[i * 3 + 1] * 1e4)},${Math.round(positions[i * 3 + 2] * 1e4)}`;
  const ids = new Map<string, number>();
  const pos: number[][] = [], acc: number[][] = [];
  const vid = new Int32Array(tris * 3);
  for (let i = 0; i < tris * 3; i++) {
    const k = key(i);
    let id = ids.get(k);
    if (id === undefined) { id = pos.length; ids.set(k, id); pos.push([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]); acc.push([0, 0, 0]); }
    vid[i] = id;
  }
  for (let t = 0; t < tris; t++) {
    const a = pos[vid[t * 3]], b = pos[vid[t * 3 + 1]], c = pos[vid[t * 3 + 2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; // area-weighted
    for (let k = 0; k < 3; k++) { const s = acc[vid[t * 3 + k]]; s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; }
  }
  const low = pos.map((p, i) => {
    if (opts.vertical) return [p[0], p[1] - d, p[2]];
    const n = acc[i], l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [p[0] - (n[0] / l) * d, p[1] - (n[1] / l) * d, p[2] - (n[2] / l) * d];
  });
  const out: number[] = [];
  const push = (p: number[]) => { out.push(p[0], p[1], p[2]); };
  // Underside, reversed winding.
  if (opts.bottom) {
    const b = opts.bottom;
    for (let t = 0; t < Math.floor(b.length / 9); t++) for (const k of [0, 2, 1]) out.push(b[(t * 3 + k) * 3], b[(t * 3 + k) * 3 + 1], b[(t * 3 + k) * 3 + 2]);
  } else for (let t = 0; t < tris; t++) { push(low[vid[t * 3]]); push(low[vid[t * 3 + 2]]); push(low[vid[t * 3 + 1]]); }
  // Skirts on boundary edges (edges used by one triangle only).
  const edges = new Map<string, {n: number; a: number; b: number}>();
  for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) {
    const a = vid[t * 3 + k], b = vid[t * 3 + (k + 1) % 3];
    if (a === b) continue;
    const e = a < b ? `${a}_${b}` : `${b}_${a}`, cur = edges.get(e);
    if (cur) cur.n++; else edges.set(e, {n: 1, a, b});
  }
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    push(pos[e.b]); push(pos[e.a]); push(low[e.a]);
    push(pos[e.b]); push(low[e.a]); push(low[e.b]);
  }
  return out;
}

/** Positions of a three.js geometry as a plain non-indexed triangle list (applies the index when present). */
export function trianglePositions(g: {getAttribute(name: string): {count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number}; index: {count: number; getX(i: number): number} | null}): number[] {
  const p = g.getAttribute('position'), ix = g.index, out: number[] = [];
  const n = ix ? ix.count : p.count;
  for (let k = 0; k < n; k++) { const i = ix ? ix.getX(k) : k; out.push(p.getX(i), p.getY(i), p.getZ(i)); }
  return out;
}
