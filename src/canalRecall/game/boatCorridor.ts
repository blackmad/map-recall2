// Whether the boat's hull is on navigable water.
//
// MapLibre is the primary authority: if the rendered basemap says a hull point
// is water, it is. But bridge decks and lock structures are drawn *above* the
// water fill, so the basemap reports dry land at exactly the places a boat must
// pass through. The fallback below is what lets it through, and it has to be
// wide enough to actually admit the boat — the previous flat
// `min(width * 0.28, 13)` px left a perfectly centred, perfectly aligned boat
// 0.80 px of margin against its own 8.16 px half-beam, so any yaw at all pinned
// it in place. That is what stuck boats in the Stadionsluis.

import type { WorldPoint } from './worldTypes';

export interface BoatHull extends WorldPoint {
  /** Radians. */
  angle: number;
  length: number;
  width: number;
}

/** The nearest mapped navigable centreline to a point. */
export interface NearestCentreline {
  dist: number;
  /** Full mapped width of the way, in world pixels. */
  width: number;
}

/** Fraction of the hull's half-extents the sample points sit at. Slightly
 *  inside the hull, so clipping a corner is not instantly a collision. */
const HULL_SAMPLE_FRACTION = 0.34;

/**
 * How far a hull point may sit from a navigable centreline and still count as
 * being on the water.
 *
 * Anchored to the way's own mapped half-width, because that is what the water
 * actually is, with a floor that guarantees the boat's beam fits. Without the
 * floor a narrow way can be mapped narrower than the vessel the game asks you
 * to steer through it, which is unnavigable by construction rather than by
 * anything the player did.
 */
export function corridorTolerance(wayWidth: number, halfBeam: number): number {
  // 0.45 rather than 0.5: stay just inside the mapped edge, so this can never
  // authorize roaming onto an adjacent quay or block.
  return Math.max(wayWidth * 0.45, halfBeam + BEAM_CLEARANCE);
}

/** px of slack beyond the hull's own half-beam, for steering error. */
export const BEAM_CLEARANCE = 5;

export function hullHalfBeam(boat: Pick<BoatHull, 'width'>): number {
  return boat.width * HULL_SAMPLE_FRACTION;
}

/** Centre, bow, stern and both beams — the points that must all be afloat. */
export function hullSamples(boat: BoatHull): WorldPoint[] {
  const forwardX = Math.cos(boat.angle), forwardY = Math.sin(boat.angle);
  const rightX = -forwardY, rightY = forwardX;
  const halfLength = boat.length * HULL_SAMPLE_FRACTION;
  const halfBeam = hullHalfBeam(boat);
  return [
    { x: boat.x, y: boat.y },
    { x: boat.x + forwardX * halfLength, y: boat.y + forwardY * halfLength },
    { x: boat.x - forwardX * halfLength, y: boat.y - forwardY * halfLength },
    { x: boat.x + rightX * halfBeam, y: boat.y + rightY * halfBeam },
    { x: boat.x - rightX * halfBeam, y: boat.y - rightY * halfBeam },
  ];
}

export interface CorridorProbes {
  /** What the rendered basemap says about a point. */
  isWater(x: number, y: number): boolean;
  /** The nearest mapped navigable centreline, or `null` where none is loaded. */
  nearestCentreline(x: number, y: number): NearestCentreline | null;
}

/** Why the hull is not afloat — so a stuck boat can be diagnosed rather than
 *  merely observed. */
export interface CorridorFailure {
  /** The first hull point the basemap called dry. */
  point: WorldPoint;
  sampleIndex: number;
  /** How far the boat's centre is from the nearest mapped centreline, and how
   *  far it was allowed to be. `null` when no centreline is loaded at all. */
  centreDistance: number | null;
  tolerance: number | null;
}

/**
 * `null` when the boat is afloat; otherwise why not.
 *
 * Two ways to be afloat, in order of authority:
 *
 *  1. The rendered basemap says every hull point is water. This is the normal
 *     case and the one that decides open canals.
 *  2. The basemap says otherwise, but the boat's *centre* sits on a mapped
 *     navigable centreline. Bridge decks and lock structures are drawn above
 *     the water fill, so the basemap reports dry land exactly where a boat has
 *     to pass, and this is what lets it through.
 *
 * The fallback deliberately tests the centre alone. Requiring every hull point
 * to be near a centreline sounds stricter but is simply wrong: many locks are
 * shorter than the boat, so bow and stern overhang the ends of the lock's own
 * geometry, land beyond the last vertex, and measure a full half-length away
 * from it. That pinned boats in fifteen of Amsterdam's locks. The centre being
 * demonstrably on the mapped channel is the real evidence of navigability, and
 * it still cannot authorize roaming: a boat over a quay has its centre well off
 * every centreline.
 */
export function findCorridorFailure(
  boat: BoatHull,
  probes: CorridorProbes,
): CorridorFailure | null {
  const samples = hullSamples(boat);
  const dryIndex = samples.findIndex(point => !probes.isWater(point.x, point.y));
  if (dryIndex === -1) return null;

  const centre = probes.nearestCentreline(boat.x, boat.y);
  if (!centre) {
    return { point: samples[dryIndex], sampleIndex: dryIndex, centreDistance: null, tolerance: null };
  }
  const tolerance = corridorTolerance(centre.width, hullHalfBeam(boat));
  if (centre.dist <= tolerance) return null;
  return {
    point: samples[dryIndex],
    sampleIndex: dryIndex,
    centreDistance: centre.dist,
    tolerance,
  };
}

export function boatFitsWater(boat: BoatHull, probes: CorridorProbes): boolean {
  return findCorridorFailure(boat, probes) === null;
}
