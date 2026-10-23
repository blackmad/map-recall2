/**
 * Finish-card story lines: celebrate first-ever knowledge, not arcade XP.
 */

import type { ExplorationGain } from './progressStore';
import type { PlaceStreak } from './placeStreak';
import { placeStreakLabel } from './placeStreak';
import { t } from '../../i18n/index.ts';

export interface FinishStoryInput {
  gain: ExplorationGain;
  destinationName: string;
  cityName: string;
  /** Neighborhoods newly visited this route that are now in the passport. */
  newPassportStamps: string[];
  placeStreak: PlaceStreak;
  signedIn: boolean;
  recallAvailable: boolean;
}

export interface FinishStory {
  headline: string;
  detail: string | null;
  passport: string | null;
  streak: string | null;
  guestTease: string | null;
}

export function finishStory(input: FinishStoryInput): FinishStory {
  const { gain, destinationName, cityName, newPassportStamps, placeStreak } = input;
  const dest = destinationName || t('finish.destination');
  const bits: string[] = [];
  const count = (one: 'finish.newNames.one' | 'finish.newNeighborhoods.one' | 'finish.newLandmarks.one',
    other: 'finish.newNames.other' | 'finish.newNeighborhoods.other' | 'finish.newLandmarks.other',
    value: number) => bits.push(t(value === 1 ? one : other, { count: value }));
  if (gain.newNames > 0) count('finish.newNames.one', 'finish.newNames.other', gain.newNames);
  if (gain.newNeighborhoods > 0) count('finish.newNeighborhoods.one', 'finish.newNeighborhoods.other', gain.newNeighborhoods);
  if (gain.newLandmarks > 0) count('finish.newLandmarks.one', 'finish.newLandmarks.other', gain.newLandmarks);

  const headline = bits.length
    ? t('finish.arrivedWith', { destination: dest, bits: bits.join(', ') })
    : t('finish.arrived', { destination: dest });

  const detail = bits.length
    ? t('finish.sticks', { city: cityName })
    : t('finish.cleanRide');

  const passport = newPassportStamps.length
    ? t('finish.passport', { stamps: `${newPassportStamps.slice(0, 3).join(', ')}${newPassportStamps.length > 3 ? '…' : ''}` })
    : null;

  const streak = placeStreakLabel(placeStreak);

  const guestTease = !input.signedIn && input.recallAvailable
    ? t('account.guestNote')
    : null;

  return { headline, detail, passport, streak, guestTease };
}

/** Quiet HUD wink when re-entering a mastered stretch (name already known). */
export function knowThisCornerFeedback(name: string): string {
  const short = name.length > 28 ? `${name.slice(0, 26)}…` : name;
  return t('finish.youKnow', { name: short });
}
