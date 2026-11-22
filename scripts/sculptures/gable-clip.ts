/**
 * Clamp a placed pediment relief to its tympanum triangle (round 3, lane sculpture-r3-20261122).
 *
 * A generated pediment group is fitted to its bounding rectangle (wallRelief.ts placeRelief), so its rim stands past the
 * raking cornice and the relief reads as a lid on the gable (Palace on the Dam, round 2). Here every vertex is held inside
 * the inner triangle (base at the frame origin, `halfBase` either side, apex `rise` above): a vertex above a raking edge is
 * pulled down onto it and, when it moved more than `flattenAt` metres, pressed back to the wall plane, so the group tapers
 * into the cornice soffit instead of overhanging it. Triangles that collapse (all three vertices on an edge) are dropped.
 * Pure geometry on [a, b, c] vertex triples in the landmark frame (x east, y up, z south).
 */
import type {V3} from '../../src/canalRecall/sculptures/kitParts.js';

export interface Gable { origin: V3; normal: [number, number]; halfBase: number; rise: number; embed?: number; flattenAt?: number }

export function clampToGable(tris: V3[][], g: Gable): {triangles: V3[][]; clamped: number; dropped: number} {
  const nl = Math.hypot(g.normal[0], g.normal[1]), n = [g.normal[0] / nl, g.normal[1] / nl], t = [n[1], -n[0]];
  const embed = g.embed ?? 0.02, flattenAt = g.flattenAt ?? 0.05;
  let clamped = 0, dropped = 0;
  const out: V3[][] = [];
  for (const tri of tris) {
    let onEdge = 0;
    const q = tri.map(p => {
      const dx = p[0] - g.origin[0], dz = p[2] - g.origin[2];
      let a = dx * t[0] + dz * t[1], u = p[1] - g.origin[1], o = dx * n[0] + dz * n[1];
      a = Math.max(-g.halfBase, Math.min(g.halfBase, a));
      u = Math.max(0, u);
      const top = g.rise * (1 - Math.abs(a) / g.halfBase);
      if (u > top) { if (u - top > flattenAt) o = Math.min(o, -embed); u = top; onEdge++; clamped++; }
      return [g.origin[0] + t[0] * a + n[0] * o, g.origin[1] + u, g.origin[2] + t[1] * a + n[1] * o] as V3;
    });
    const e1 = [0, 1, 2].map(k => q[1][k] - q[0][k]), e2 = [0, 1, 2].map(k => q[2][k] - q[0][k]);
    const area = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]);
    if (onEdge === 3 || area < 1e-8) { dropped++; continue; }
    out.push(q);
  }
  return {triangles: out, clamped, dropped};
}
