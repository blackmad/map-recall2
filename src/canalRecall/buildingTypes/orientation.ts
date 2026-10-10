/**
 * Which long side of a post-war block is its front? The side that faces the
 * nearest street (an OSM highway). Pure and tested; the generator never guesses.
 *
 * Rule (documented in types/README of the proposal): sample five points along
 * each long side, 0.5 m outside it; for each sample take the distance to the
 * nearest street segment that lies in front of the side (the street point must
 * be on the outward half plane), add the class penalty of that street, and
 * average. The side with the lower mean wins. Footpaths and cycleways count,
 * but a drivable street 10 m further away still beats a garden path.
 */
import {nearestOnSegment, type Pt, type Rect} from './geometry.ts';

export interface Street { name?: string; highway: string; path: Pt[] }

/** Added to the distance (m) per OSM highway class: drivable streets are the real front, paths only break ties. */
export const HIGHWAY_PENALTY_M: Record<string, number> = {
  primary: 0, secondary: 0, tertiary: 0, residential: 0, unclassified: 0, living_street: 0, primary_link: 0, secondary_link: 0, tertiary_link: 0,
  service: 6, cycleway: 8, footway: 10, pedestrian: 6, path: 12, track: 12, steps: 14,
};
const DEFAULT_PENALTY_M = 10;

export interface FrontResult {
  /** +1: the side at +short, -1: the side at -short (short = rect.short). */
  sign: 1 | -1;
  /** Outward unit normal of the front side (local east/south). */
  normal: Pt;
  /** Unit vector along the front, viewer's right facing the wall from outside: (nz, -nx) in east/south. */
  tangent: Pt;
  /** Midpoint of the front side. */
  midpoint: Pt;
  score: number;
  otherScore: number;
  /** The two sides score within `AMBIGUITY_M` of each other: the pand sits between two streets or the data is thin. */
  ambiguous: boolean;
  street: string | null;
  streetDistanceM: number;
}

export const AMBIGUITY_M = 2;
const SAMPLES = 5;

function sideScore(rect: Rect, sign: 1 | -1, streets: Street[]): {score: number; street: string | null; distance: number} {
  const n: Pt = [rect.short[0] * sign, rect.short[1] * sign];
  let total = 0, best = {score: Infinity, street: null as string | null, distance: Infinity};
  for (let i = 0; i < SAMPLES; i++) {
    const along = -rect.length / 2 + rect.length * (i + 0.5) / SAMPLES;
    const s: Pt = [rect.center[0] + rect.long[0] * along + n[0] * (rect.width / 2 + 0.5), rect.center[1] + rect.long[1] * along + n[1] * (rect.width / 2 + 0.5)];
    let sampleBest = Infinity;
    for (const st of streets) {
      const pen = HIGHWAY_PENALTY_M[st.highway] ?? DEFAULT_PENALTY_M;
      for (let k = 0; k + 1 < st.path.length; k++) {
        const {d, q} = nearestOnSegment(s, st.path[k], st.path[k + 1]);
        if ((q[0] - s[0]) * n[0] + (q[1] - s[1]) * n[1] < -0.25) continue; // street behind the side: that is the other front
        const eff = d + pen;
        if (eff < sampleBest) sampleBest = eff;
        if (eff < best.score) best = {score: eff, street: st.name || null, distance: d};
      }
    }
    total += Number.isFinite(sampleBest) ? sampleBest : 200;
  }
  return {score: total / SAMPLES, street: best.street, distance: best.distance};
}

export function frontSide(rect: Rect, streets: Street[]): FrontResult {
  const plus = sideScore(rect, 1, streets), minus = sideScore(rect, -1, streets);
  const sign: 1 | -1 = plus.score <= minus.score ? 1 : -1, win = sign === 1 ? plus : minus, lose = sign === 1 ? minus : plus;
  const normal: Pt = [rect.short[0] * sign, rect.short[1] * sign];
  return {
    sign, normal, tangent: [normal[1], -normal[0]],
    midpoint: [rect.center[0] + normal[0] * rect.width / 2, rect.center[1] + normal[1] * rect.width / 2],
    score: win.score, otherScore: lose.score, ambiguous: Math.abs(plus.score - minus.score) < AMBIGUITY_M,
    street: win.street, streetDistanceM: win.distance,
  };
}

/**
 * Yaw (radians, rotation about +y) that takes the generator's local frame (front at +z, tangent +x, long axis x)
 * onto the world east/south frame. Local x -> tangent, local z -> normal.
 */
export function frontYaw(front: Pick<FrontResult, 'normal' | 'tangent'>): number {
  // three.js rotation.y = a maps local (1,0,0) to (cos a, 0, -sin a) and (0,0,1) to (sin a, 0, cos a).
  // We need local x -> (tx, tz): cos a = tx, -sin a = tz.
  return Math.atan2(-front.tangent[1], front.tangent[0]);
}
