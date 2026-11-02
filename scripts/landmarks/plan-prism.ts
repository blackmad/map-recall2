import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import type {Frame} from './nearbar-kit';
import type {Pt, Run} from '../../src/canalRecall/landmarks/terraceBands';

/**
 * Plan-prism massing shared by the Vijzelstraat landmarks (Vijzelbank, Carlton Hotel): one closed prism per plan polygon
 * (3DBAG roof piece, ground storey cut back for an arcade or a street passage), and the frame of an exposed edge run
 * (terraceBands.exposedRuns) for laying facade parts on it.
 */
const open = (r: Pt[]) => (r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);

/** Closed prism over one plan polygon (with holes): walls, an upward roof and (optionally) a downward soffit. */
export function prism(b: BuildingTools, poly: Pt[][], y0: number, y1: number, wall: string, roof: string | null, soffit: string | null) {
  const [outer, ...holes] = poly.map(open);
  const shape = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, z)));
  for (const h of holes) shape.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
  const pos: number[] = [];
  [outer, ...holes].forEach((r, ri) => {
    const s = Math.sign(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) * (ri === 0 ? 1 : -1) || 1;
    r.forEach((p, i) => {
      const q = r[(i + 1) % r.length], nx = s * (q[1] - p[1]), nz = -s * (q[0] - p[0]);
      const A = [p[0], y0, p[1]], B = [q[0], y0, q[1]], C = [q[0], y1, q[1]], D = [p[0], y1, p[1]];
      // winding so the face looks along (nx, 0, nz)
      const ux = B[0] - A[0], uz = B[2] - A[2], cross = [-(uz * (y1 - y0)), 0, ux * (y1 - y0)]; // (B-A) x (D-A) with D-A = (0, h, 0)
      if (cross[0] * nx + cross[2] * nz >= 0) pos.push(...A, ...B, ...C, ...A, ...C, ...D); else pos.push(...A, ...C, ...B, ...A, ...D, ...C);
    });
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add(g, wall as never);
  const flat = (y: number, up: boolean) => {
    const sg = new T.ShapeGeometry(shape).toNonIndexed();
    const p = sg.getAttribute('position'), out: number[] = [];
    for (let i = 0; i < p.count; i += 3) {
      const v = [0, 1, 2].map(j => [p.getX(i + j), y, p.getY(i + j)]);
      const ny = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
      if ((ny > 0) === up) out.push(...v[0], ...v[1], ...v[2]); else out.push(...v[0], ...v[2], ...v[1]);
    }
    const r = new T.BufferGeometry();
    r.setAttribute('position', new T.Float32BufferAttribute(out, 3));
    r.computeVertexNormals();
    return r;
  };
  if (roof) b.add(flat(y1, true), roof as never);
  if (soffit) b.add(flat(y0, false), soffit as never);
}

/** A run's own frame: origin at its start, tangent along it, n its outward normal (nearbar-kit Frame). */
export const runFrame = (r: Run): {f: Frame; len: number} => {
  const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]);
  return {f: {origin: r.a, tangent: [(r.b[0] - r.a[0]) / len, (r.b[1] - r.a[1]) / len], n: r.n}, len};
};

/**
 * Closed prism whose top follows `topAt(x, z)` per vertex (a sloped 3DBAG roof plane, a mansard), base flat at y0: walls are
 * quads with a slanted top edge, the roof is the plan triangulation lifted to topAt, the soffit (optional) faces down.
 */
export function slopedPrism(b: BuildingTools, poly: Pt[][], y0: number, topAt: (x: number, z: number) => number, wall: string, roof: string | null, soffit: string | null) {
  const [outer, ...holes] = poly.map(open);
  const pos: number[] = [];
  [outer, ...holes].forEach((r, ri) => {
    const s = Math.sign(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) * (ri === 0 ? 1 : -1) || 1;
    r.forEach((p, i) => {
      const q = r[(i + 1) % r.length], nx = s * (q[1] - p[1]), nz = -s * (q[0] - p[0]);
      const A = [p[0], y0, p[1]], B = [q[0], y0, q[1]], C = [q[0], topAt(q[0], q[1]), q[1]], D = [p[0], topAt(p[0], p[1]), p[1]];
      const ux = B[0] - A[0], uz = B[2] - A[2];
      if (-uz * nx + ux * nz >= 0) pos.push(...A, ...B, ...C, ...A, ...C, ...D); else pos.push(...A, ...C, ...B, ...A, ...D, ...C);
    });
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add(g, wall as never);
  const shape = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, z)));
  for (const h of holes) shape.holes.push(new T.Path(h.map(([x, z]) => new T.Vector2(x, z))));
  const flat = (yAt: (x: number, z: number) => number, up: boolean) => {
    const sg = new T.ShapeGeometry(shape).toNonIndexed();
    const p = sg.getAttribute('position'), out: number[] = [];
    for (let i = 0; i < p.count; i += 3) {
      const v = [0, 1, 2].map(j => [p.getX(i + j), yAt(p.getX(i + j), p.getY(i + j)), p.getY(i + j)]);
      const ny = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
      if ((ny > 0) === up) out.push(...v[0], ...v[1], ...v[2]); else out.push(...v[0], ...v[2], ...v[1]);
    }
    const r = new T.BufferGeometry();
    r.setAttribute('position', new T.Float32BufferAttribute(out, 3));
    r.computeVertexNormals();
    return r;
  };
  if (roof) { const g2 = flat(topAt, true); g2.userData.role = 'roof'; b.add(g2, roof as never); }
  if (soffit) b.add(flat(() => y0, false), soffit as never);
}
