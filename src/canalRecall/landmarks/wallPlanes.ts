/**
 * Plane clustering of near-vertical triangles: the shared first step of the blank-wall check
 * (`glbQuality.ts`) and the facade rhythm check (`facadeRhythm.ts`).
 *
 * Coordinates are glTF native (Y up, metres). A wall's outward compass bearing treats -Z as north and +X as east,
 * which is how every surveyed Map Recall model is authored ("native east/south metres from the anchor").
 * Wall-local axes: `u` runs left to right as seen by someone standing outside facing the wall, `v` is up.
 */
import type {TriSoup} from './glbQuality';

export interface WallSegment {
  /** Triangle indices belonging to this segment. */
  tris: number[];
  /** Outward unit normal in (x, z). */
  n: [number, number];
  /** Wall-local right-hand axis in (x, z): u = x*t[0] + z*t[1]. */
  t: [number, number];
  /** Plane offset: n . (x, z). */
  d: number;
  /** Compass bearing the wall faces, degrees clockwise from north (0..360). */
  bearingDeg: number;
  /** Sum of 3D triangle areas. */
  area: number;
  uMin: number; uMax: number; vMin: number; vMax: number;
  /** Area-weighted centroid. */
  centre: [number, number, number];
}

export interface WallClusterOptions {
  /** Triangles with |normal.y| above this are not walls. */
  maxVerticalSkew?: number;
  /** Plane offset tolerance (m) for merging triangles into one plane. */
  planeTolerance?: number;
  /** Normal bearing tolerance (degrees). */
  angleToleranceDeg?: number;
  /** A gap in u larger than this (m) splits a plane into separate wall segments. */
  splitGap?: number;
  /** Segments smaller than this (m^2) are dropped. */
  minArea?: number;
}

export const bearingOf = (nx: number, nz: number): number => ((Math.atan2(nx, -nz) * 180) / Math.PI + 360) % 360;
export const bearingDelta = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
export const wallUV = (seg: Pick<WallSegment, 't'>, x: number, y: number, z: number): [number, number] => [x * seg.t[0] + z * seg.t[1], y];

/** Clusters near-vertical triangles into planar wall segments, keeping only those facing outward from the model centre. */
export function clusterWalls(soup: TriSoup, opts: WallClusterOptions = {}): WallSegment[] {
  const maxSkew = opts.maxVerticalSkew ?? 0.2, planeTol = opts.planeTolerance ?? 0.03, angTol = opts.angleToleranceDeg ?? 2.5;
  const splitGap = opts.splitGap ?? 1.0, minArea = opts.minArea ?? 1;
  const P = soup.positions, I = soup.indices, nTri = I.length / 3;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (!Number.isFinite(P[i] + P[i + 2])) continue;
    minX = Math.min(minX, P[i]); maxX = Math.max(maxX, P[i]); minZ = Math.min(minZ, P[i + 2]); maxZ = Math.max(maxZ, P[i + 2]);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  interface Cl { n: [number, number]; d: number; bearing: number; tris: number[] }
  const bins = new Map<number, Cl[]>();
  const all: Cl[] = [];
  const BIN = 5;
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
    const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (!(len > 1e-6) || Math.abs(ny / len) > maxSkew) continue;
    const h = Math.hypot(nx, nz);
    const n: [number, number] = [nx / h, nz / h];
    const d = n[0] * (P[a] + P[b] + P[c]) / 3 + n[1] * (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    const bearing = bearingOf(n[0], n[1]);
    const bin = Math.round(bearing / BIN);
    let hit: Cl | undefined;
    for (const k of [bin, bin - 1, bin + 1]) {
      const key = ((k % (360 / BIN)) + 360 / BIN) % (360 / BIN);
      for (const cl of bins.get(key) ?? []) if (bearingDelta(cl.bearing, bearing) <= angTol && Math.abs(cl.d - d) <= planeTol) { hit = cl; break; }
      if (hit) break;
    }
    if (!hit) {
      hit = {n, d, bearing, tris: []};
      all.push(hit);
      const key = ((bin % (360 / BIN)) + 360 / BIN) % (360 / BIN);
      const l = bins.get(key) ?? []; l.push(hit); bins.set(key, l);
    }
    hit.tris.push(t);
  }
  const out: WallSegment[] = [];
  for (const cl of all) {
    const t: [number, number] = [cl.n[1], -cl.n[0]];
    const info = cl.tris.map(tr => {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, ar = 0, gx = 0, gy = 0, gz = 0;
      const ia = I[tr * 3] * 3, ib = I[tr * 3 + 1] * 3, ic = I[tr * 3 + 2] * 3;
      for (const k of [ia, ib, ic]) {
        const u = P[k] * t[0] + P[k + 2] * t[1];
        u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, P[k + 1]); v1 = Math.max(v1, P[k + 1]);
        gx += P[k] / 3; gy += P[k + 1] / 3; gz += P[k + 2] / 3;
      }
      const e1 = [P[ib] - P[ia], P[ib + 1] - P[ia + 1], P[ib + 2] - P[ia + 2]], e2 = [P[ic] - P[ia], P[ic + 1] - P[ia + 1], P[ic + 2] - P[ia + 2]];
      ar = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
      return {tr, u0, u1, v0, v1, ar, gx, gy, gz};
    }).sort((p, q) => p.u0 - q.u0);
    let group: typeof info = [];
    let reach = -Infinity;
    const flush = () => {
      if (!group.length) return;
      let area = 0, gx = 0, gy = 0, gz = 0, uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
      for (const g of group) {
        area += g.ar; gx += g.gx * g.ar; gy += g.gy * g.ar; gz += g.gz * g.ar;
        uMin = Math.min(uMin, g.u0); uMax = Math.max(uMax, g.u1); vMin = Math.min(vMin, g.v0); vMax = Math.max(vMax, g.v1);
      }
      if (area >= minArea) {
        const centre: [number, number, number] = [gx / area, gy / area, gz / area];
        // Outward = normal points away from the model's plan centre.
        if ((centre[0] - cx) * cl.n[0] + (centre[2] - cz) * cl.n[1] > 0) {
          out.push({tris: group.map(g => g.tr), n: cl.n, t, d: cl.d, bearingDeg: cl.bearing, area, uMin, uMax, vMin, vMax, centre});
        }
      }
      group = [];
    };
    for (const g of info) {
      if (group.length && g.u0 > reach + splitGap) { flush(); reach = -Infinity; }
      group.push(g); reach = Math.max(reach, g.u1);
    }
    flush();
  }
  return out.sort((a, b) => b.area - a.area);
}
