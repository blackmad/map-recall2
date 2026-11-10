/**
 * The footprint wall the preview frames (`--wall`): an edge of the pand's outer ring by index, or the edge whose outward
 * normal bearing is closest to a given bearing. Ring edges follow scripts/house-audit/suppressed-faces.ts (the closing point
 * dropped, edge i from ring[i] to ring[i + 1]), so an index taken from the audit frames the same wall.
 */
import { chunkMetres } from '../../src/canalRecall/world/shellMesh.ts';

export type LngLat = [number, number];
export type WallPick = { a: LngLat; b: LngLat; lengthM: number; edge: number; bearingDeg: number; spec: string };

/** Outer ring without its closing point. */
export function openRing(ring: LngLat[]): LngLat[] {
  const r = ring.slice();
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  return r;
}

/** Bearing (degrees clockwise from north) of the outward normal of edge i, and the edge's length in metres. */
export function edgeNormal(ring: LngLat[], i: number): { bearingDeg: number; lengthM: number } {
  const M = ring.map(([lng, lat]) => chunkMetres(lng, lat));
  let area = 0;
  for (let k = 0; k < M.length; k++) { const [x0, y0] = M[k], [x1, y1] = M[(k + 1) % M.length]; area += x0 * y1 - x1 * y0; }
  const sign = area >= 0 ? 1 : -1;
  const [ax, ay] = M[i], [bx, by] = M[(i + 1) % M.length];
  const len = Math.hypot(bx - ax, by - ay);
  // Right-hand normal of a CCW ring is outward; the normal's east and north components give the bearing.
  const nE = ((by - ay) / len) * sign, nN = (-(bx - ax) / len) * sign;
  return { bearingDeg: ((Math.atan2(nE, nN) * 180) / Math.PI + 360) % 360, lengthM: len };
}

/**
 * `spec` is an edge index ("3") or an outward bearing with a "deg" suffix ("215deg"). Throws when the index is out of range
 * or no edge exists.
 */
export function pickWall(ring: LngLat[], spec: string): WallPick {
  const R = openRing(ring);
  if (R.length < 3) throw new Error(`--wall ${spec}: the footprint has no edges`);
  const bearing = /^(-?\d+(?:\.\d+)?)deg$/.exec(spec);
  let i: number;
  if (bearing) {
    const want = Number(bearing[1]);
    let best = -1, bestD = Infinity;
    for (let k = 0; k < R.length; k++) {
      const { bearingDeg } = edgeNormal(R, k);
      const d = Math.abs(((bearingDeg - want + 540) % 360) - 180);
      if (d < bestD) { bestD = d; best = k; }
    }
    i = best;
  } else {
    if (!/^\d+$/.test(spec)) throw new Error(`--wall ${spec}: an edge index or a bearing like 215deg`);
    i = Number(spec);
    if (i >= R.length) throw new Error(`--wall ${spec}: the footprint has ${R.length} edges (0 to ${R.length - 1})`);
  }
  const { bearingDeg, lengthM } = edgeNormal(R, i);
  return { a: R[i], b: R[(i + 1) % R.length], lengthM, edge: i, bearingDeg, spec };
}
