import type {Frame} from './nearbar-kit';
import {planarPolygon} from './worship-shell';
import type {ShellSource, Surface} from './worship-shell';

/**
 * Cut an axis-aligned box (in a wall frame: t along the wall, depth along the outward normal, any height) out of a 3DBAG
 * shell so a block it models badly (a tower front merged with its gable) can be rebuilt by hand. Every surface is
 * triangulated and clipped; the pieces outside the box keep their winding, so the rest of the shell is unchanged.
 */
type V = [number, number, number];

export function carveBox(src: ShellSource, f: Frame, box: {t0: number; t1: number; d0: number; d1: number; y0?: number}): ShellSource {
  const tOf = (p: V) => (p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1];
  const dOf = (p: V) => (p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1];
  // half-spaces: value(p) < 0 means inside the box side of that plane
  const planes: ((p: V) => number)[] = [p => box.t0 - tOf(p), p => tOf(p) - box.t1, p => box.d0 - dOf(p), p => dOf(p) - box.d1];
  if (box.y0 !== undefined) planes.push(p => box.y0! - p[1]);   // box is open at the top: only the part above y0 is cut
  /** Sutherland-Hodgman clip of a convex polygon to {sign * g(p) >= 0}. */
  const clip = (poly: V[], g: (p: V) => number, sign: 1 | -1): V[] => {
    const out: V[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ga = sign * g(a), gb = sign * g(b);
      if (ga >= 0) out.push(a);
      if ((ga >= 0) !== (gb >= 0)) {
        const u = ga / (ga - gb);
        out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
      }
    }
    return out;
  };
  const area2 = (poly: V[]) => {
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c = poly[(i + 1) % poly.length];
      nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]);
    }
    return Math.hypot(nx, ny, nz);
  };
  const surfaces: Surface[] = [];
  for (const s of src.surfaces) {
    if (s.type === 'GroundSurface') { surfaces.push(s); continue; }
    const verts = s.rings[0] as V[];
    if (planes.some(pl => verts.every(p => pl(p) >= -1e-6))) { surfaces.push(s); continue; }   // wholly on the outside of one plane
    const g = planarPolygon(s.rings);
    if (!g) continue;
    const pos = g.getAttribute('position'), idx = g.getIndex()!;
    for (let k = 0; k < idx.count; k += 3) {
      const tri: V[] = [0, 1, 2].map(j => [pos.getX(idx.getX(k + j)), pos.getY(idx.getX(k + j)), pos.getZ(idx.getX(k + j))] as V);
      let rest: V[] | null = tri;
      const pieces: V[][] = [];
      for (const pl of planes) {
        // the part of `rest` on the outside of this plane survives; the part inside carries on to the next plane
        const outside = clip(rest!, pl, 1);
        if (outside.length >= 3 && area2(outside) > 1e-6) pieces.push(outside);
        rest = clip(rest!, pl, -1);
        if (rest.length < 3) { rest = null; break; }
      }
      for (const piece of pieces) surfaces.push({type: s.type, rings: [piece.map(p => p.map(v => +v.toFixed(4)))]});
    }
  }
  return {...src, surfaces};
}
