import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

export type Surface = {type: string; rings: number[][][]};
export type ShellSource = {surfaces: Surface[]; nativeRing: number[][]};

/** Triangulate one planar 3D polygon (with holes) into an indexed geometry. */
export function planarPolygon(rings: number[][][]): T.BufferGeometry | null {
  const outer = rings[0];
  // Newell normal picks the projection plane.
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], q = outer[(i + 1) % outer.length];
    nx += (a[1] - q[1]) * (a[2] + q[2]); ny += (a[2] - q[2]) * (a[0] + q[0]); nz += (a[0] - q[0]) * (a[1] + q[1]);
  }
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  if (Math.max(ax, ay, az) < 1e-6) return null;
  const proj = (p: number[]) => ay >= ax && ay >= az ? new T.Vector2(p[0], p[2]) : ax >= az ? new T.Vector2(p[1], p[2]) : new T.Vector2(p[0], p[1]);
  const clean = (r: number[][]) => r.length > 1 && r[0].every((v, i) => v === r[r.length - 1][i]) ? r.slice(0, -1) : r;
  const rs = rings.map(clean), pts = rs.flat();
  const contour = rs[0].map(proj), holes = rs.slice(1).map(h => h.map(proj));
  const tris = T.ShapeUtils.triangulateShape(contour, holes);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3));
  const idx: number[] = [];
  const n = new T.Vector3(nx, ny, nz);
  for (const [a, q, r] of tris) {
    const A = new T.Vector3(...pts[a]), B = new T.Vector3(...pts[q]), C = new T.Vector3(...pts[r]);
    const fn = B.clone().sub(A).cross(C.clone().sub(A));
    if (fn.dot(n) >= 0) idx.push(a, q, r); else idx.push(a, r, q);
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Add the 3DBAG LoD2.2 walls and roofs as a closed texture-free shell. */
export function addShell(b: BuildingTools, src: ShellSource, colours: {wall: string; roof: string; skip?: (s: Surface, i: number) => boolean; roofFor?: (s: Surface, i: number) => string}) {
  src.surfaces.forEach((s, i) => {
    if (s.type === 'GroundSurface' || colours.skip?.(s, i)) return;
    const g = planarPolygon(s.rings);
    if (!g) return;
    if (s.type === 'RoofSurface') g.userData.role = 'roof';
    b.add(g, s.type === 'RoofSurface' ? (colours.roofFor?.(s, i) ?? colours.roof) as never : colours.wall as never);
  });
}
