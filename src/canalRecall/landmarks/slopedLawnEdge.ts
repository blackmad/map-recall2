/**
 * The raised edge of a tilted lawn roof (a "ground-scraper": grass sloping up from a plain to a raised edge over a street):
 * a metal fascia following the edge's falling height, a soffit under its overhang and, set back under it, the fronts
 * (wall, glazing with mullions, or a dark opening) whose top follows the slope down until the edge meets the ground.
 *
 * Why (Albert Heijn Museumplein lane #221, 2026-11-05): the Museumplein "ezelsoor" lifts the lawn's corner to 7.5 m over
 * the Van Baerlestraat, edged in green copper, with the supermarket's glass under it and a granite retaining wall where
 * the edge falls (Gemeente Amsterdam panoramas recording_2025-07-30_11-08-35_00343, recording_2025-09-29_08-09-56_01107,
 * b_20250115_1006_Track23_Sphere_00028). The kit's walls, prisms and slabs all stand on a level top; a front whose
 * head runs down a slope to nothing had no component. Pure geometry: plan (x, z), y up; no three.js.
 */
export type EdgeP2 = [number, number];
export type EdgeV3 = [number, number, number];
export interface LawnEdgeZone {
  /** Distance along the edge from `a`. */
  s0: number;
  s1: number;
  kind: 'wall' | 'glass' | 'opening';
  /** Wall material (kind wall); glass uses `glass`, an opening `frame`. */
  material?: string;
  /** Mullion spacing on glass (frame material). */
  mullion?: number;
}
export interface LawnEdgeSpec {
  a: EdgeP2;
  b: EdgeP2;
  /** Lawn height at a plan point. */
  heightAt: (x: number, z: number) => number;
  zones: LawnEdgeZone[];
  /** +1: outward is the edge direction turned clockwise in (x, z) ([t.z, -t.x]); -1 the other way. */
  outSign: 1 | -1;
  /** Fascia depth below the lawn edge. */
  fascia: number;
  /** Fascia thickness, standing out of the edge line. */
  proud: number;
  /** How far the fronts stand behind the edge line. */
  setback: number;
  /** Station spacing along the edge. */
  step: number;
  fasciaMaterial?: string;
  soffitMaterial?: string;
}
export interface EdgeQuad {material: string; pts: [EdgeV3, EdgeV3, EdgeV3, EdgeV3]; out: EdgeV3}

/** Lowest front head (m) worth drawing: below it the fascia reaches the ground on its own. */
export const MIN_FRONT = 0.05;

export function slopedLawnEdge(e: LawnEdgeSpec): {quads: EdgeQuad[]; length: number} {
  const L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
  if (!(L > 0)) throw Error('slopedLawnEdge: a and b coincide');
  const t: EdgeP2 = [(e.b[0] - e.a[0]) / L, (e.b[1] - e.a[1]) / L];
  const n: EdgeP2 = [e.outSign * t[1], -e.outSign * t[0]];
  const at = (s: number, o: number, y: number): EdgeV3 => [e.a[0] + t[0] * s + n[0] * o, y, e.a[1] + t[1] * s + n[1] * o];
  const yEdge = (s: number) => e.heightAt(e.a[0] + t[0] * s, e.a[1] + t[1] * s);
  const head = (s: number) => yEdge(s) - e.fascia;
  const stations = new Set<number>([0, L]);
  for (let s = e.step; s < L - 1e-6; s += e.step) stations.add(+s.toFixed(6));
  for (const z of e.zones) for (const s of [z.s0, z.s1]) if (s > 0 && s < L) stations.add(+s.toFixed(6));
  const ss = [...stations].sort((p, q) => p - q);
  const out: EdgeV3 = [n[0], 0, n[1]], down: EdgeV3 = [0, -1, 0];
  const fm = e.fasciaMaterial ?? 'copper', sm = e.soffitMaterial ?? fm;
  const quads: EdgeQuad[] = [];
  const zoneAt = (s: number) => e.zones.find(z => s >= z.s0 - 1e-9 && s <= z.s1 + 1e-9);
  for (let i = 0; i + 1 < ss.length; i++) {
    const s0 = ss[i], s1 = ss[i + 1], y0 = yEdge(s0), y1 = yEdge(s1);
    const b0 = Math.max(0, head(s0)), b1 = Math.max(0, head(s1));
    // fascia: top lip and front, down to the soffit (or to the ground where the edge is low)
    quads.push({material: fm, pts: [at(s0, 0, y0), at(s1, 0, y1), at(s1, e.proud, y1 + 0.05), at(s0, e.proud, y0 + 0.05)], out: [n[0], 1, n[1]]});
    quads.push({material: fm, pts: [at(s0, e.proud, b0), at(s1, e.proud, b1), at(s1, e.proud, y1 + 0.05), at(s0, e.proud, y0 + 0.05)], out});
    if (Math.max(b0, b1) <= MIN_FRONT) continue;
    // soffit under the overhang, then the front standing `setback` behind the edge line
    quads.push({material: sm, pts: [at(s0, e.proud, b0), at(s1, e.proud, b1), at(s1, -e.setback, b1), at(s0, -e.setback, b0)], out: down});
    const z = zoneAt((s0 + s1) / 2);
    const material = !z || z.kind === 'wall' ? (z?.material ?? 'stone') : z.kind === 'glass' ? 'glass' : 'frame';
    quads.push({material, pts: [at(s0, -e.setback, 0), at(s1, -e.setback, 0), at(s1, -e.setback, b1), at(s0, -e.setback, b0)], out});
    if (z?.kind === 'glass' && z.mullion) {
      for (let m = Math.ceil((s0 - z.s0) / z.mullion) * z.mullion + z.s0; m < s1 - 1e-6; m += z.mullion) {
        if (m <= z.s0 + 1e-6 || m >= z.s1 - 1e-6) continue;   // a mullion on a station belongs to the segment it starts
        const f = (m - s0) / (s1 - s0), hb = b0 + (b1 - b0) * f;
        quads.push({material: 'frame', pts: [at(m - 0.04, -e.setback + 0.05, 0), at(m + 0.04, -e.setback + 0.05, 0), at(m + 0.04, -e.setback + 0.05, hb), at(m - 0.04, -e.setback + 0.05, hb)], out});
      }
    }
  }
  return {quads, length: L};
}
