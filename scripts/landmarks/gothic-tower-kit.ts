/**
 * three.js adapter for the Gothic-revival crown and rustication layouts (src/canalRecall/landmarks/gothicCrown.ts,
 * src/canalRecall/landmarks/rustication.ts):
 *  - `crocketedSpire`: a polygonal needle with leaf crockets on its arrises and a finial rod with a ball;
 *  - `openworkLantern`: base and top rings, corner (and mid-face) posts, a dark core, and a dome or cone cap;
 *  - `openworkParapet`: rails and balusters round a gallery polygon;
 *  - `rusticatedBase`: proud blocks with V-joints on a wall frame (each block a frustum: full back, inset front).
 * The core of a lantern uses a non-opening material (`bronze` by default): `dark` is an opening material for the
 * openings gate, and a lantern's interior is not a window in a wall.
 * Nothing changes for models that do not call these functions.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, type Frame} from './nearbar-kit';
import {crocketedSpireLayout, openworkLanternLayout, openworkParapetLayout, type LanternOptions, type ParapetOptions, type SpireOptions} from '../../src/canalRecall/landmarks/gothicCrown';
import {rusticationLayout, type RusticationOptions} from '../../src/canalRecall/landmarks/rustication';

type Col = string;
type P2 = [number, number];
const add = (b: BuildingTools, g: T.BufferGeometry, c: Col) => b.add(g, c as never);

/** Faces (flat-shaded, 3 vertices each) of a closed-or-open polyhedron given as corner list and triangles. */
function faces(corners: number[][], tris: number[][]): T.BufferGeometry {
  const pos: number[] = [];
  for (const t of tris) for (const i of t) pos.push(...corners[i]);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
/** Crocket leaf: a three-faced pyramid pointing up (+y) from its root at the origin, open at its back (it sits on the arris). */
function leaf(size: number): T.BufferGeometry {
  const r = size * 0.32, c = [[0, size, 0], [-r, 0, 0], [r, 0, 0], [0, 0, r * 1.4]];
  return faces(c, [[1, 3, 0], [3, 2, 0], [2, 1, 0]]);
}
/** Upright square post of width w and height h (foot at y = 0), four sides only: its ends are under rails. */
function post4(w: number, h: number): T.BufferGeometry {
  const r = w / 2, c = [[-r, 0, -r], [r, 0, -r], [r, 0, r], [-r, 0, r], [-r, h, -r], [r, h, -r], [r, h, r], [-r, h, r]];
  return faces(c, [[0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]]);
}

/** Crocketed needle spire about the axis `c` (x, z). Crockets lean out from their arris by `lean` radians (default 0.9). */
export function crocketedSpire(b: BuildingTools, c: P2, o: SpireOptions, col: {shaft: Col; crocket?: Col; finial?: Col}, lean = 0.9) {
  const L = crocketedSpireLayout(o), s = L.shaft;
  add(b, new T.ConeGeometry(s.radius, s.y1 - s.y0, s.sides).rotateY(s.yaw).translate(c[0], (s.y0 + s.y1) / 2, c[1]), col.shaft);
  for (const k of L.crockets) {
    const g = leaf(k.size).rotateX(lean).rotateY(Math.atan2(k.out[0], k.out[1]));
    add(b, g.translate(c[0] + k.at[0], k.at[1], c[1] + k.at[2]), col.crocket ?? col.shaft);
  }
  if (L.finial) {
    const f = L.finial, h = f.y1 - f.y0;
    add(b, new T.CylinderGeometry(0.035, 0.05, h, 4).translate(c[0], f.y0 + h / 2, c[1]), col.finial ?? 'gold');
    if (f.ball) add(b, new T.SphereGeometry(f.ball, 6, 4).translate(c[0], f.y0 + h * 0.62, c[1]), col.finial ?? 'gold');
  }
}

/** Openwork lantern about the axis `c`: rings, posts, core and cap. */
export function openworkLantern(b: BuildingTools, c: P2, o: LanternOptions, col: {ring: Col; post: Col; core?: Col; cap?: Col}) {
  const L = openworkLanternLayout(o);
  const prism = (r: number, y0: number, y1: number, colour: Col) => add(b, new T.CylinderGeometry(r, r, y1 - y0, L.sides).rotateY(L.yaw).translate(c[0], (y0 + y1) / 2, c[1]), colour);
  prism(L.base.radius, L.base.y0, L.base.y1, col.ring);
  prism(L.top.radius, L.top.y0, L.top.y1, col.ring);
  for (const p of L.posts) add(b, new T.BoxGeometry(p.w, p.y1 - p.y0 + 0.04, p.w).rotateY(p.yaw).translate(c[0] + p.at[0], (p.y0 + p.y1) / 2, c[1] + p.at[1]), col.post);
  if (L.core) prism(L.core.radius, L.core.y0, L.core.y1, col.core ?? 'bronze');
  if (L.cap) {
    const k = L.cap, h = k.y1 - k.y0;
    const g = k.kind === 'cone'
      ? new T.ConeGeometry(k.radius, h, L.sides).translate(0, h / 2, 0)
      : new T.LatheGeometry([[k.radius, 0], [k.radius * 0.93, h * 0.38], [k.radius * 0.72, h * 0.7], [k.radius * 0.38, h * 0.93], [0, h]].map(p => new T.Vector2(p[0], p[1])), L.sides);
    add(b, g.rotateY(L.yaw).translate(c[0], k.y0, c[1]), col.cap ?? col.ring);
  }
}

/** Openwork gallery parapet: a foot rail, balusters and a top rail along every side of the ring. */
export function openworkParapet(b: BuildingTools, o: ParapetOptions, col: Col) {
  const P = openworkParapetLayout(o), d = P.baluster * 1.6;
  for (const r of P.rails) {
    const L = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) + d, yaw = Math.atan2(r.b[0] - r.a[0], r.b[1] - r.a[1]) - Math.PI / 2;
    const mx = (r.a[0] + r.b[0]) / 2, mz = (r.a[1] + r.b[1]) / 2;
    add(b, new T.BoxGeometry(L, P.rail, d).rotateY(yaw).translate(mx, P.y1 - P.rail / 2, mz), col);
    add(b, new T.BoxGeometry(L, P.rail * 0.7, d).rotateY(yaw).translate(mx, P.y0 + P.rail * 0.35, mz), col);
  }
  const h = P.y1 - P.y0 - P.rail * 1.7 + 0.04;
  for (const s of P.balusters) add(b, post4(P.baluster, h).rotateY(s.yaw).translate(s.at[0], P.y0 + P.rail * 0.7 - 0.02, s.at[1]), col);
}

/**
 * Rusticated base on a wall frame: each block a frustum from its full outline at `out` (its back, sunk `sink` into the wall
 * behind) to the outline inset by `joint` at `out + depth` (its face). Back faces are left out (they are against the wall).
 */
export function rusticatedBase(b: BuildingTools, f: Frame, o: RusticationOptions & {depth: number; joint: number; out?: number; sink?: number}, colour: Col): number {
  const blocks = rusticationLayout(o), out = o.out ?? 0, sink = o.sink ?? 0.01, j = o.joint, z1 = sink + o.depth;
  // four vertices per face (flat-shaded: the chamfers must not share the face's normal), two triangles each
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  for (const k of blocks) {
    if (k.t1 - k.t0 <= 2 * j || k.y1 - k.y0 <= 2 * j) continue;
    // back corners (z = 0, i.e. `sink` behind `out`), then front corners inset by the joint
    const v = [[k.t0, k.y0, 0], [k.t1, k.y0, 0], [k.t1, k.y1, 0], [k.t0, k.y1, 0], [k.t0 + j, k.y0 + j, z1], [k.t1 - j, k.y0 + j, z1], [k.t1 - j, k.y1 - j, z1], [k.t0 + j, k.y1 - j, z1]];
    const q = (a: number, b2: number, c: number, d: number) => {
      const n = pos.length / 3, A = new T.Vector3(...v[a]), B = new T.Vector3(...v[b2]), C = new T.Vector3(...v[c]);
      const N = B.sub(A).cross(C.sub(A)).normalize();
      for (const i of [a, b2, c, d]) { pos.push(...v[i]); nrm.push(N.x, N.y, N.z); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    };
    q(4, 5, 6, 7);            // face
    q(0, 1, 5, 4);            // bottom chamfer
    q(1, 2, 6, 5);            // right chamfer
    q(2, 3, 7, 6);            // top chamfer
    q(3, 0, 4, 7);            // left chamfer
  }
  if (!idx.length) return 0;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  put(b, f, g, 0, 0, out - sink, colour);
  return idx.length / 6;
}
