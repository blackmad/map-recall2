/**
 * Chains: order a session so each question tends to sit next to the last
 * answer (wave-2 review, 2026-10-13). Learning a street is easier when the
 * map you just looked at is still in your head.
 *
 * This only re-orders what `selectReviewFeatures` chose, so its guarantees on
 * *which* features play are untouched, and it keeps its ordering guarantees:
 *   - due reviews still come before anything else;
 *   - unseen waters keep their syllabus order relative to each other.
 * Inside those constraints it is greedy: the next question is the nearest
 * remaining one, and no more than `maxSameNeighborhood` questions in a row
 * share a neighbourhood, so a chain drifts through the city instead of
 * circling one buurt.
 */
import type { GameMode, StreetFeature } from '../types';
import type { ReviewState } from '../spacedRepetition';
import { calculateHaversineDistanceMeters, calculateShortestDistanceToFeature } from '../utils/geo';
import { getFeatureKey } from '../utils/featureIdentity';
import { isWater } from './waterImportance';

/** Two places count as adjacent when one is within this distance of the other's geometry. */
export const ADJACENT_METRES = 700;
export const MAX_SAME_NEIGHBORHOOD = 3;

type LatLon = [number, number];

function inRing([lat, lon]: LatLon, ring: LatLon[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLat, currentLon] = ring[index];
    const [previousLat, previousLon] = ring[previous];
    if ((currentLat > lat) !== (previousLat > lat)
      && lon < ((previousLon - currentLon) * (lat - currentLat)) / (previousLat - currentLat) + currentLon) inside = !inside;
  }
  return inside;
}

/** Whether `point` is inside a multipolygon (outer ring minus holes). */
export function pointInArea(point: LatLon, geometry?: LatLon[][][]): boolean {
  return geometry?.some((polygon) => polygon[0] && inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole))) ?? false;
}

/** Metres from `point` to a feature: 0 inside an area, else to its lines or centre. */
export function distanceToFeature(point: LatLon, feature: StreetFeature): number {
  if (feature.areaGeometry?.length && pointInArea(point, feature.areaGeometry)) return 0;
  return calculateShortestDistanceToFeature(point, feature.center, feature.path, feature.paths);
}

/** Separation of two features: the nearer of each centre to the other's geometry. */
export function featureSeparation(a: StreetFeature, b: StreetFeature): number {
  return Math.min(distanceToFeature(a.center, b), distanceToFeature(b.center, a));
}

const neighbourhoodOf = (feature: StreetFeature): string | undefined =>
  (feature.type === 'neighborhood' ? undefined : feature.neighborhood?.trim().toLowerCase()) || undefined;

/**
 * Adjacent: the same neighbourhood, one area containing the other's centre,
 * or within `ADJACENT_METRES`. This is what "Next · nearby" promises.
 */
export function isAdjacent(a: StreetFeature, b: StreetFeature, metres = ADJACENT_METRES): boolean {
  const na = neighbourhoodOf(a);
  if (na && na === neighbourhoodOf(b)) return true;
  if (pointInArea(b.center, a.areaGeometry) || pointInArea(a.center, b.areaGeometry)) return true;
  // A non-area feature names the neighbourhood it is in.
  if (a.type === 'neighborhood' && neighbourhoodOf(b) === a.name.trim().toLowerCase()) return true;
  if (b.type === 'neighborhood' && neighbourhoodOf(a) === b.name.trim().toLowerCase()) return true;
  return featureSeparation(a, b) <= metres;
}

export interface ChainOptions {
  states?: readonly ReviewState[];
  mode?: GameMode;
  now?: number;
  maxSameNeighborhood?: number;
}

/**
 * Re-orders `selected` into a nearby chain. The first question stays first
 * (it is the most overdue review, or the top-priority new place).
 */
export function planChain(selected: readonly StreetFeature[], options: ChainOptions = {}): StreetFeature[] {
  if (selected.length <= 2) return [...selected];
  const { states = [], mode, now = Date.now(), maxSameNeighborhood = MAX_SAME_NEIGHBORHOOD } = options;
  const stateByKey = new Map(states.filter((state) => !mode || state.mode === mode).map((state) => [state.featureKey, state]));
  const keyOf = selected.map(getFeatureKey);
  const due = selected.map((_, index) => (stateByKey.get(keyOf[index])?.dueAt ?? Infinity) <= now);
  const syllabusWater = selected.map((feature, index) => isWater(feature) && !stateByKey.has(keyOf[index]));

  const remaining = new Set(selected.map((_, index) => index));
  const order: number[] = [0];
  remaining.delete(0);

  const eligible = (index: number) => {
    // Due reviews first: nothing else while one is waiting.
    if (!due[index] && [...remaining].some((other) => due[other])) return false;
    // Unseen waters follow the syllabus: only the earliest remaining one may go next.
    if (syllabusWater[index]) {
      for (const other of remaining) if (other < index && syllabusWater[other]) return false;
    }
    return true;
  };

  while (remaining.size) {
    const last = selected[order[order.length - 1]];
    const run = (() => {
      const hood = neighbourhoodOf(last);
      if (!hood) return 0;
      let count = 0;
      for (let position = order.length - 1; position >= 0 && neighbourhoodOf(selected[order[position]]) === hood; position--) count++;
      return count;
    })();
    const capped = (index: number) => run >= maxSameNeighborhood && !!neighbourhoodOf(last) && neighbourhoodOf(selected[index]) === neighbourhoodOf(last);
    const candidates = [...remaining].filter(eligible);
    const open = candidates.filter((index) => !capped(index));
    const pool = open.length ? open : candidates;
    let best = pool[0];
    let bestScore = Infinity;
    for (const index of pool) {
      const candidate = selected[index];
      // Adjacent places always beat far ones; then nearest, then the original priority.
      const score = (isAdjacent(last, candidate) ? 0 : 1e9)
        + calculateHaversineDistanceMeters(last.center, candidate.center)
        + index * 1e-6;
      if (score < bestScore) { bestScore = score; best = index; }
    }
    order.push(best);
    remaining.delete(best);
  }
  return order.map((index) => selected[index]);
}
