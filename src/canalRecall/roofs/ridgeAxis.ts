// The dominant ridge axis of a pand from its 3DBAG LoD2.2 roof planes (open data, CC BY 4.0).
//
// Feedback round 2026-11-13 (notes ba7fc535, 10bd9a08, Bilderdijkkade): pitched roofs drawn with their triangular
// gable ends sideways to the street. The city tier fits a saddle to the footprint box and turns it across the street
// front (streetRidge.ts), a guess from the footprint and the street; 3DBAG measured the real ridge. This module reads
// that measurement so the guess can be checked (scripts/audit-ridge-vs-bag.ts) and, where the roof is a clean saddle,
// preferred. Pure: callers pass the decoded CityJSON.
import type { CityJson } from '../bag3dCityJson.js';

export type RidgeAxis = {
  /** Ridge direction in RD New, degrees counter-clockwise from east, folded to [0, 180). */
  angleDeg: number;
  /** 0..1: how much of the slanted roof area agrees on one axis (1 = every plane falls across it). Low = hipped or mixed. */
  coherence: number;
  /** Slanted roof area, m2. */
  slantedM2: number;
  /** Mean pitch of the slanted planes, degrees. */
  slopeDeg: number;
};

const SLANT_MIN_DEG = 10, AREA_MIN_M2 = 3;

/** Newell normal of a ring (x, y, z); roof normals point up. */
function planeOf(ring: number[][]): { n: [number, number, number]; area: number } {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const m = Math.hypot(nx, ny, nz) || 1, s = nz < 0 ? -1 : 1;
  return { n: [s * nx / m, s * ny / m, s * nz / m], area: m / 2 };
}

/**
 * The ridge axis of one Building object (its LoD2.2 roof surfaces, over the parts), or null for a flat roof. Planes vote
 * for the axis perpendicular to their fall direction with their area, as doubled angles so opposite slopes agree.
 */
export function ridgeAxisOf(cj: Pick<CityJson, 'transform' | 'vertices' | 'CityObjects'>, buildingId: string): RidgeAxis | null {
  const root = cj.CityObjects[buildingId];
  if (!root) return null;
  const t = cj.transform;
  const ids = [buildingId, ...(root.children ?? [])];
  let sx = 0, sy = 0, total = 0, slopeSum = 0;
  for (const id of ids) for (const g of cj.CityObjects[id]?.geometry ?? []) {
    if (String(g.lod) !== '2.2' || !g.semantics) continue;
    const shells = g.boundaries as number[][][][];
    const values = g.semantics.values as number[][];
    for (let si = 0; si < shells.length; si++) for (let j = 0; j < shells[si].length; j++) {
      if (g.semantics.surfaces[values[si][j]]?.type !== 'RoofSurface') continue;
      const ring = shells[si][j][0].map(k => cj.vertices[k].map((x, i) => x * t.scale[i] + t.translate[i]));
      const { n, area } = planeOf(ring), h = Math.hypot(n[0], n[1]);
      if (area <= AREA_MIN_M2 || h / Math.max(1e-9, n[2]) <= Math.tan(SLANT_MIN_DEG * Math.PI / 180)) continue;
      const ridge = Math.atan2(n[0], -n[1]); // fall = (n0, n1); the ridge is perpendicular: (-n1, n0)
      sx += area * Math.cos(2 * ridge); sy += area * Math.sin(2 * ridge); total += area;
      slopeSum += area * Math.atan2(h, n[2]) * 180 / Math.PI;
    }
  }
  if (total <= 0) return null;
  const angle = Math.atan2(sy, sx) / 2 * 180 / Math.PI;
  return { angleDeg: ((angle % 180) + 180) % 180, coherence: Math.hypot(sx, sy) / total, slantedM2: total, slopeDeg: slopeSum / total };
}

/** Smallest angle between two undirected axes, degrees 0..90. */
export function axisGapDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 180 + 180) % 180);
  return d > 90 ? 180 - d : d;
}
