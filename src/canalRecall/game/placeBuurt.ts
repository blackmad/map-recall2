// One buurt rule for a place, shared by the Free Ride checklist and the plaque
// (#284). The rule is the passport's and the knowledge map's: the finest buurt
// containing the point. Two things made the checklist and the plaque disagree
// before:
//
//  - The checklist took a landmark's *game* point, which bike and boat rides
//    snap onto the nearest mapped way. Snapping pulled 20 of 228 places over a
//    boundary (Koningin Emma from Willemspark into the Zuid suburb list,
//    Bellevue from Centrum into West). A place now goes to the buurt of its
//    own centre, as the knowledge map counts it.
//  - The plaque takes the rider's point, and the rider stands on the road
//    beside a place, often across the line (Anne Frank House is in the
//    Grachtengordel; the Prinsengracht kerb in front of it is in the Jordaan).
//    While the rider stands at a place the plaque names that place's buurt,
//    so the checklist that holds the place is the one on the plaque.

import { neighborhoodAt } from './landmarkData';
import type { Neighborhood } from './worldTypes';

/** How far from a place the rider still "stands at" it, beyond the place's
 *  own distance from the road (metres). */
export const PLACE_AT_SLACK_M = 30;
/** The furthest a place reaches out to the road, however far back it stands (metres). */
export const PLACE_AT_MAX_M = 120;

type Hoods = readonly Pick<Neighborhood, 'name' | 'rings'>[];

/** The finest buurt containing the point: the plaque's, the passport's and
 *  the knowledge map's rule, and the checklist's for a place's centre. */
export function buurtAt(hoods: Hoods, x: number, y: number): string | null {
  return neighborhoodAt(hoods as readonly Neighborhood[], x, y)?.name ?? null;
}

/** A checklist place as the plaque sees it: where it is drawn (the game
 *  point), its list's buurt, and how far from that point it reaches. */
export interface PlaceAnchor {
  x: number;
  y: number;
  hood: string;
  /** World px: the rider within this of the point stands at the place. */
  reach: number;
}

/** How far a place reaches, in world px, given how far its point stands from
 *  the nearest road's centreline (world px). Null means no road close by (a
 *  museum set back in its grounds): the place reaches the furthest. */
export function placeReach(roadDistance: number | null, pxPerMeter: number): number {
  const max = PLACE_AT_MAX_M * pxPerMeter;
  if (roadDistance == null || !Number.isFinite(roadDistance)) return max;
  return Math.min(max, roadDistance + PLACE_AT_SLACK_M * pxPerMeter);
}

/** The anchor the rider stands at: the nearest whose reach covers the point. */
export function anchorAt(anchors: Iterable<PlaceAnchor>, x: number, y: number): PlaceAnchor | null {
  let best: PlaceAnchor | null = null;
  let bestDistance = Infinity;
  for (const anchor of anchors) {
    const distance = Math.hypot(anchor.x - x, anchor.y - y);
    if (distance <= anchor.reach && distance < bestDistance) {
      best = anchor;
      bestDistance = distance;
    }
  }
  return best;
}

/** The plaque's buurt for a rider point: the buurt of the place the rider
 *  stands at, else the finest buurt containing the point. With no anchors
 *  (the quiz modes, `?collection=0`) this is `buurtAt`. */
export function plaqueBuurtAt(hoods: Hoods, x: number, y: number, anchors: Iterable<PlaceAnchor> = []): string | null {
  return anchorAt(anchors, x, y)?.hood ?? buurtAt(hoods, x, y);
}
