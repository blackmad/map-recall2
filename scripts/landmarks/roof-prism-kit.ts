import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {planarPolygon} from './worship-shell';
import {wallTop, type Wall} from './worship-walls';
import {slab} from './nearbar-kit';

/**
 * Massing and window kit for the Zuid towers lane (ABN AMRO hoofdkantoor, De Wolkenkrabber, 2026-11-01):
 *  - roofPrism: a closed prism under one 3DBAG LoD2.2 roof plane, so a single-part 3DBAG shell can be rebuilt per roof
 *    and a tower replaced by authored volumes without leaving open edges (the shell itself cannot drop walls);
 *  - gridFacade: storey ribbons of glass with full-height piers in front (piers under 30 % of the glass, so the opening
 *    audit never sees a pane buried behind trim), clipped under the wall's own top.
 */
/** Closed prism under one (possibly sloped) roof polygon with holes: side quads to the roof edge, the roof, a floor. */
export function roofPrism(b: BuildingTools, rings: number[][][], wall: string, roof: string) {
  const clean = rings.map(r => {
    const q = r.length > 1 && r[0].every((v, i) => v === r[r.length - 1][i]) ? r.slice(0, -1) : r;
    return q.filter((p, i) => Math.hypot(p[0] - q[(i + 1) % q.length][0], p[2] - q[(i + 1) % q.length][2]) > 1e-3);
  }).filter(r => r.length >= 3);
  if (!clean.length) return;
  const sgn = (r: number[][]) => Math.sign(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[2] - q[0] * p[2]; }, 0)) || 1;
  const pos: number[] = [];
  const tri = (a: number[], c: number[], d: number[], want: [number, number, number]) => {
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) pos.push(...a, ...c, ...d); else pos.push(...a, ...d, ...c);
  };
  clean.forEach((r, ri) => {
    const s0 = sgn(r) * (ri === 0 ? 1 : -1);
    r.forEach((p, i) => {
      const q = r[(i + 1) % r.length], dx = q[0] - p[0], dz = q[2] - p[2];
      const out: [number, number, number] = [s0 * dz, 0, -s0 * dx];
      const A = [p[0], 0, p[2]], B = [q[0], 0, q[2]], At = [p[0], p[1], p[2]], Bt = [q[0], q[1], q[2]];
      tri(A, B, Bt, out); tri(A, Bt, At, out);
    });
  });
  const flat = T.ShapeUtils.triangulateShape(clean[0].map(p => new T.Vector2(p[0], p[2])), clean.slice(1).map(h => h.map(p => new T.Vector2(p[0], p[2]))));
  const all = clean.flat();
  for (const [i, j, k] of flat) tri([all[i][0], 0, all[i][2]], [all[j][0], 0, all[j][2]], [all[k][0], 0, all[k][2]], [0, -1, 0]);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add(g, wall as never);
  const top = planarPolygon(clean);
  if (!top) return;
  const P = top.getAttribute('position'), idx = top.getIndex()!;
  const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3();
  for (let k = 0; k < idx.count; k += 3) {
    A.fromBufferAttribute(P, idx.getX(k)); B.fromBufferAttribute(P, idx.getX(k + 1)); C.fromBufferAttribute(P, idx.getX(k + 2));
    if (B.sub(A).cross(C.sub(A)).y < 0) { const t = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, t); }
  }
  top.computeVertexNormals();
  top.userData.role = 'roof';
  b.add(top, roof as never);
}

export type GridOptions = {y0: number; pitch: number; colPitch: number; pierW: number; pierD: number; winBottom: number; winH: number; pier: string; glass: string; ground?: string; margin: number};
/**
 * Window grid as one glass ribbon per storey with full-height piers in front of it (the piers cover under 30 % of the
 * glass, so no pane hides behind trim), the wall itself showing as the spandrels; a plinth slab on a tall ground storey.
 * Ribbons stay under the wall's lowest top across their span, so nothing pierces a sloped or stepped 3DBAG wall top.
 */
export function gridFacade(b: BuildingTools, w: Wall, o: GridOptions) {
  const L = w.length, m = o.margin;
  if (L < 2 * m + o.colPitch) return;
  let top = Infinity;
  for (let k = 0; k <= 8; k++) { const v = wallTop(w, m + (L - 2 * m) * k / 8); if (Number.isFinite(v)) top = Math.min(top, v); }
  if (!Number.isFinite(top)) return;
  if (o.ground && w.base < o.y0 - 0.5) slab(b, w, L / 2, w.base, L - 0.4, Math.min(o.y0, top - 0.1) - w.base - 0.05, 0.14, o.ground);
  let yLo = Infinity, yHi = -Infinity;
  for (let k = Math.max(0, Math.ceil((w.base - o.y0 - 0.05) / o.pitch)); ; k++) {
    const yb = o.y0 + k * o.pitch + o.winBottom;
    if (yb + o.winH > top - 0.35) break;
    slab(b, w, L / 2, yb, L - 2 * m, o.winH, 0.06, o.glass);
    yLo = Math.min(yLo, yb); yHi = yb + o.winH;
  }
  if (!Number.isFinite(yLo)) return;
  const n = Math.max(1, Math.round((L - 2 * m) / o.colPitch)), pitch = (L - 2 * m) / n;
  // Thin mullions skip the two ends: on skewed 3DBAG pieces the end of the outermost plane can lie past the real wall edge.
  const thin = o.pierW < 0.3;
  for (let i = thin ? 1 : 0; i <= (thin ? n - 1 : n); i++) {
    const t = m + i * pitch, tt = Math.min(wallTop(w, Math.max(0.01, t - o.pierW / 2)), wallTop(w, Math.min(L - 0.01, t + o.pierW / 2)));
    const y1 = Math.min(yHi, Number.isFinite(tt) ? tt - 0.3 : yHi);
    if (y1 > yLo + 0.5) slab(b, w, t, yLo, o.pierW, y1 - yLo, o.pierD, o.pier);
  }
}
