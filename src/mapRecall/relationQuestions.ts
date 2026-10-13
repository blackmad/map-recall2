/**
 * Relation questions: the Guess Name form for obscure places (wave-2 review,
 * 2026-10-13). Four names for a back street nobody has heard of is a coin
 * toss; "which is further west: Jan Vethstraat or Chris Lebeaustraat?" asks
 * for something a player can reason about, with both lines on the map.
 *
 * The answer can be either name. Both candidates are drawn the same way and
 * unnamed until the answer, so the map shows *where* two places are but not
 * *which* is which; that is the question.
 */
import type { StreetFeature } from '../types';
import { calculateHaversineDistanceMeters } from '../utils/geo';

/** Below this prominence a place is obscure enough to ask relationally. */
export const OBSCURE_PROMINENCE = 20;
/** Or shorter than this along its longest axis. */
export const SHORT_AXIS_METRES = 400;
/** The two centres must be at least this far apart on the asked axis. */
export const MIN_AXIS_SEPARATION_METRES = 250;
export const RELATION_POINTS = 5000;

const METRES_PER_DEGREE = 111_320;

type LatLon = [number, number];
export type Direction = 'north' | 'south' | 'east' | 'west';

export type RelationQuestion =
  | { kind: 'axis'; direction: Direction; prompt: string; target: StreetFeature; other: StreetFeature; choices: [string, string]; answer: string }
  | { kind: 'neighbourhood'; neighbourhood: string; prompt: string; target: StreetFeature; other: StreetFeature; choices: [string, string]; answer: string };

const pointsOf = (feature: StreetFeature): LatLon[] => {
  const lines = feature.paths?.length ? feature.paths : feature.path?.length ? [feature.path] : [];
  const points = lines.flat();
  if (feature.areaGeometry?.length) points.push(...feature.areaGeometry.flatMap((polygon) => polygon[0] ?? []));
  return points;
};

/** Diagonal of the feature's bounding box in metres, or its diameter for a point. */
export function longestAxisMetres(feature: StreetFeature): number {
  const points = pointsOf(feature);
  if (points.length < 2) return 2 * (feature.radius ?? 0);
  const lats = points.map(([lat]) => lat);
  const lons = points.map(([, lon]) => lon);
  const cos = Math.cos((feature.center[0] * Math.PI) / 180);
  const height = (Math.max(...lats) - Math.min(...lats)) * METRES_PER_DEGREE;
  const width = (Math.max(...lons) - Math.min(...lons)) * METRES_PER_DEGREE * cos;
  return Math.hypot(width, height);
}

/** Obscure: little-known or short. Neighbourhoods keep the four-name form (it already asks "which area"). */
export function isObscure(feature: StreetFeature): boolean {
  if (feature.type === 'neighborhood') return false;
  return (feature.prominenceScore ?? 0) < OBSCURE_PROMINENCE || longestAxisMetres(feature) < SHORT_AXIS_METRES;
}

/** East and north offsets of `b` from `a`, in metres. */
export function offsetMetres(a: LatLon, b: LatLon): { east: number; north: number } {
  const cos = Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return { east: (b[1] - a[1]) * METRES_PER_DEGREE * cos, north: (b[0] - a[0]) * METRES_PER_DEGREE };
}

const normalName = (name: string) => name.trim().toLowerCase();

/** The target's distractors that exist in `pool` with a location, nearest first. */
export function distractorFeatures(target: StreetFeature, pool: readonly StreetFeature[]): StreetFeature[] {
  const byName = new Map<string, StreetFeature>();
  for (const feature of pool) {
    const key = normalName(feature.name);
    if (key === normalName(target.name) || feature.type === 'neighborhood') continue;
    if (!byName.has(key)) byName.set(key, feature);
  }
  const seen = new Set<string>();
  return target.distractors
    .map((name) => byName.get(normalName(name)))
    .filter((feature): feature is StreetFeature => {
      if (!feature || seen.has(feature.id)) return false;
      seen.add(feature.id);
      return true;
    })
    .sort((a, b) => calculateHaversineDistanceMeters(target.center, a.center) - calculateHaversineDistanceMeters(target.center, b.center));
}

/**
 * The relation question for `target`, or null to keep the four-name form.
 * `seed` picks which way round the axis is asked and the order of the choices.
 */
export function buildRelationQuestion(target: StreetFeature, pool: readonly StreetFeature[], seed = 0): RelationQuestion | null {
  if (!isObscure(target)) return null;
  const candidates = distractorFeatures(target, pool);
  if (!candidates.length) return null;
  const flip = (Math.abs(Math.trunc(seed)) % 2) === 1;
  const order = (a: string, b: string): [string, string] => (flip ? [b, a] : [a, b]);

  // Most distractors are the streets crossing this one (median 85 m apart on Amsterdam streets), too
  // close to tell apart on a compass: the nearest one that clears 250 m on some axis.
  const separation = (other: StreetFeature) => {
    const { east, north } = offsetMetres(target.center, other.center);
    return Math.max(Math.abs(east), Math.abs(north));
  };
  const nearest = candidates.find((candidate) => separation(candidate) >= MIN_AXIS_SEPARATION_METRES) ?? candidates[0];
  const { east, north } = offsetMetres(target.center, nearest.center);
  const axisFits = separation(nearest) >= MIN_AXIS_SEPARATION_METRES;
  const hood = target.neighborhood?.trim();
  const elsewhere = hood ? candidates.find((candidate) => candidate.neighborhood?.trim() && normalName(candidate.neighborhood) !== normalName(hood)) : undefined;

  // Both forms possible: alternate with the seed so a session is not all compass questions.
  const preferNeighbourhood = !!elsewhere && (!axisFits || (Math.abs(Math.trunc(seed)) % 3) === 2);
  if (axisFits && !preferNeighbourhood) {
    const eastWest = Math.abs(east) >= Math.abs(north);
    const direction: Direction = eastWest ? (flip ? 'east' : 'west') : (flip ? 'north' : 'south');
    const otherIsFurther = direction === 'east' ? east > 0 : direction === 'west' ? east < 0 : direction === 'north' ? north > 0 : north < 0;
    const answer = otherIsFurther ? nearest.name : target.name;
    const choices = order(target.name, nearest.name);
    return { kind: 'axis', direction, prompt: `Which is further ${direction}: ${choices[0]} or ${choices[1]}?`, target, other: nearest, choices, answer };
  }
  if (elsewhere && hood) {
    const choices = order(target.name, elsewhere.name);
    return { kind: 'neighbourhood', neighbourhood: hood, prompt: `Which of these is in ${hood}?`, target, other: elsewhere, choices, answer: target.name };
  }
  return null;
}
