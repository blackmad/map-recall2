// Which end of a city-tier gable roof carries the ornamental crown.
//
// User report 2026-10-16: "sometimes houses have gables on both the street and back side, which is wrong". An
// Amsterdam house carries its decorated gable (step, neck, bell, spout, clock, raised neck, the cornice front) on the
// STREET front only; the rear is a plain brick wall under the saddle roof, a straight triangle at most. The city
// tier's `gable` roof (roofMesh.ts) used to put the same shaped plate on both short ends of its fitted box.
//
// The rule, pure and deterministic (it runs in the chunk worker):
//  - an end whose wall sees a street straight ahead before another building (streetFronts.ts `streetDistance`,
//    the same test that puts front doors only on street walls) is a street front;
//  - exactly one street front: the crown goes there, the other end is a plain gable;
//  - both ends see a street (a through-lot between two streets): the crown goes on the nearer street. The city
//    tier has no address to say which street is the front (BAG nummeraanduiding is not in the runtime extracts), and
//    a crown on each end is exactly the double gable the user reported; the far end is a plain gable;
//  - neither sees one (set back, or the ridge runs along the street): the end nearest a street within the
//    fallback reach, ignoring buildings, is the front, as for the inner-block house's door;
//  - no street within the fallback reach at all, or no street data: `undefined`, the plan stays as it was.
// A corner house's second street runs along a long side of the box, where the city tier draws no crown.

import type { Rect } from './roofMesh.js';
import type { WallRay } from './streetFronts.js';

/** Distance from a wall to the street straight in front of it (Infinity when blocked or none); `fallback` ignores buildings and reaches further. */
export type StreetFacing = (wall: WallRay, fallback?: boolean) => number;

/** The two end walls of a fitted roof box (index 0 at -u, 1 at +u), outward normals along ∓u. */
export function gableEndWalls(rect: Rect): [WallRay, WallRay] {
  return [-1, 1].map(e => {
    const cx = rect.cx + rect.ux * e * rect.len / 2, cy = rect.cy + rect.uy * e * rect.len / 2;
    const vx = -rect.uy * rect.wid / 2, vy = rect.ux * rect.wid / 2;
    return { x0: cx - vx, y0: cy - vy, x1: cx + vx, y1: cy + vy, nx: rect.ux * e, ny: rect.uy * e, len: rect.wid };
  }) as [WallRay, WallRay];
}

/** Which ends of a gable box face a street (crowned), or undefined when nothing is known. */
export function streetGableEnds(rect: Rect, facing: StreetFacing): [boolean, boolean] | undefined {
  const walls = gableEndWalls(rect);
  const seen = walls.map(w => facing(w)) as [number, number];
  if (seen[0] < Infinity || seen[1] < Infinity) return seen[0] <= seen[1] ? [true, false] : [false, true];
  const far = walls.map(w => facing(w, true));
  if (!(far[0] < Infinity) && !(far[1] < Infinity)) return undefined;
  return far[0] <= far[1] ? [true, false] : [false, true];
}
