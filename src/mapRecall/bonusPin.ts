/**
 * Bonus pin after the reveal (wave-2 review, 2026-10-13): "and where is the
 * Concertgebouw from here?". The answer is already on the map, so a second,
 * nearby landmark can be asked without spoiling anything, and placing it ties
 * the new place to one the player knows. One per round, worth up to 500, and
 * never a review record (it is practice, not the question).
 */
import type { StreetFeature } from '../types';
import type { HintReference } from './locateHints';
import { referenceLabel, revealsAnswer } from './locateHints';
import { distanceToFeature } from './questionPlan';

export const BONUS_RADIUS_METRES = 600;
export const BONUS_MAX_POINTS = 500;
/** Full points within this distance of the landmark... */
export const BONUS_FULL_METRES = 40;
/** ...falling linearly to nothing here. */
export const BONUS_ZERO_METRES = 800;

export interface BonusTarget {
  name: string;
  /** "the Concertgebouw", "Museumplein": how the prompt says it. */
  label: string;
  center: [number, number];
  source: 'notable' | 'reference';
}

// Parks are left out: the reveal's CARTO label layer prints park names ("REMBRANDTPARK") on
// the map right after the answer, which would give the bonus away.
const POINT_KINDS = new Set<HintReference['kind']>(['landmark', 'square']);
const flat = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface BonusInput {
  feature: StreetFeature;
  references: readonly HintReference[];
  /** Names the locate hints (and the answer card's "Where it is") already use. */
  hintNames?: readonly string[];
  /** Notable places already shown as labelled clues before the answer; not worth asking. */
  shownBeforeAnswer?: readonly string[];
}

/**
 * The place to ask about: an area's best-known place inside it, else the most
 * famous landmark or square within 600 m that the hints did not name.
 */
export function pickBonusTarget({ feature, references, hintNames = [], shownBeforeAnswer = [] }: BonusInput): BonusTarget | null {
  const excluded = new Set([...hintNames, ...shownBeforeAnswer, feature.name].map(flat));
  const allowed = (name: string) => !excluded.has(flat(name)) && !revealsAnswer(name, feature.name);
  const notable = (feature.notablePlaces ?? []).find((place) => allowed(place.name) && place.kind !== 'park');
  if (notable) return { name: notable.name, label: referenceLabel({ name: notable.name, kind: notable.kind === 'square' || notable.kind === 'park' ? notable.kind : 'landmark' }), center: notable.center, source: 'notable' };
  const near = references
    .filter((reference) => POINT_KINDS.has(reference.kind) && allowed(reference.name))
    .filter((reference) => distanceToFeature(reference.center, feature) <= BONUS_RADIUS_METRES)
    .sort((a, b) => b.fame - a.fame || a.name.localeCompare(b.name));
  const best = near[0];
  return best ? { name: best.name, label: referenceLabel(best), center: best.center, source: 'reference' } : null;
}

/** 500 within 40 m, falling linearly to 0 at 800 m. */
export function bonusPoints(distanceMetres: number): number {
  if (!Number.isFinite(distanceMetres)) return 0;
  if (distanceMetres <= BONUS_FULL_METRES) return BONUS_MAX_POINTS;
  const share = 1 - (distanceMetres - BONUS_FULL_METRES) / (BONUS_ZERO_METRES - BONUS_FULL_METRES);
  return Math.max(0, Math.round(BONUS_MAX_POINTS * share));
}
