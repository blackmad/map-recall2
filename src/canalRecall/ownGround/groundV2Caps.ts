// Ground v2 floor caps (lane G2a #372 round 2): under a reviewed deck of the crossing register (crossings.ts, lane G3)
// the baked relief is the measured street level, not the 2 m DTM. AHN has no ground under a deck; its interpolation
// across the gap drew a saddle under every ring deck (Piet Kranenbergpad under the A10, the judgement session's
// "Radarweg south abutment": relief 1.44 scene m against the record's street 0.62 NAP = −0.75 scene, a 2.2 m wedge
// rising into the soffit). The bake reads this capped relief; its relief refinement then puts the edge of the cap
// within the refinement tolerance of the ring (the step to the embankment beside the abutment is drawn as a slope
// no wider than one refinement triangle).
//
// Pure: no DOM, no THREE. Records come from crossings.ts floorCaps (reviewed, with heights.streetUnder and decks).

import { floorCaps, insideRing, type CrossingRecord, type LngLat } from './crossings.js';
import type { Rect } from './groundStore.js';
import type { Vec2 } from './surface.js';

export interface FloorCap { id: string; ring: Vec2[]; box: Rect; z: number }

/** Caps whose deck ring's box meets `rect` grown by `padM` (scene z = street NAP − datumNAP). */
export function floorCapsNear(records: readonly CrossingRecord[], project: (p: LngLat) => Vec2, datumNAP: number, rect: Rect, padM = 0): FloorCap[] {
  const out: FloorCap[] = [];
  for (const c of floorCaps(records, project)) for (const ring of c.rings) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < rect[0] - padM || x0 > rect[2] + padM || y1 < rect[1] - padM || y0 > rect[3] + padM) continue;
    out.push({ id: c.id, ring, box: [x0, y0, x1, y1], z: c.streetNAP - datumNAP });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.box[0] - b.box[0] || a.box[1] - b.box[1]));
}

/**
 * The relief with every cap applied: inside a cap's ring the relief, never above the cap (the first cap containing the
 * point wins; byte-identical where none lies). A cap only lowers: under the Radarweg / Orlyplein deck the record's
 * street level (0.80 NAP, the track bed under it) lies above the relief's p50, and lifting the ground there would leave
 * the rails and building bases (which read the worker's relief) under it.
 */
export function cappedRelief(relief: (x: number, y: number) => number, caps: readonly FloorCap[]): (x: number, y: number) => number {
  if (!caps.length) return relief;
  return (x, y) => {
    for (const c of caps) if (x >= c.box[0] && x <= c.box[2] && y >= c.box[1] && y <= c.box[3] && insideRing(c.ring, x, y)) return Math.min(c.z, relief(x, y));
    return relief(x, y);
  };
}
