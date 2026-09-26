/**
 * Finish-card story lines: celebrate first-ever knowledge, not arcade XP.
 */

import type { ExplorationGain } from './progressStore';
import type { PlaceStreak } from './placeStreak';
import { placeStreakLabel } from './placeStreak';

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
  const dest = destinationName || 'your destination';
  const bits: string[] = [];
  if (gain.newNames > 0) bits.push(`${gain.newNames} new name${gain.newNames === 1 ? '' : 's'}`);
  if (gain.newNeighborhoods > 0) {
    bits.push(`${gain.newNeighborhoods} new neighborhood${gain.newNeighborhoods === 1 ? '' : 's'}`);
  }
  if (gain.newLandmarks > 0) {
    bits.push(`${gain.newLandmarks} landmark${gain.newLandmarks === 1 ? '' : 's'}`);
  }

  let headline: string;
  if (bits.length) {
    headline = `You made it to ${dest} · ${bits.join(', ')}`;
  } else {
    headline = `Arrived at ${dest}`;
  }

  const detail = bits.length
    ? `That knowledge sticks on your ${cityName} map.`
    : 'A clean ride — review something overdue next time.';

  const passport = newPassportStamps.length
    ? `Passport: ${newPassportStamps.slice(0, 3).join(', ')}${newPassportStamps.length > 3 ? '…' : ''}`
    : null;

  const streak = placeStreakLabel(placeStreak);

  const guestTease = !input.signedIn && input.recallAvailable
    ? 'Sign in to sync your fog map across devices'
    : null;

  return { headline, detail, passport, streak, guestTease };
}

/** Quiet HUD wink when re-entering a mastered stretch (name already known). */
export function knowThisCornerFeedback(name: string): string {
  const short = name.length > 28 ? `${name.slice(0, 26)}…` : name;
  return `You know ${short}`;
}
