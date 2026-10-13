// Which bridge names are worth a question below hard difficulty.
//
// Amsterdam has a named bridge every hundred metres and most names are a
// number ("Brug 117") or a councillor nobody outside the register knows.
// Asking them on easy and medium was noise beside the street names the ride
// is meant to teach (user 2026-10-13: "bridge names should not be in medium
// difficulty unless they are somehow incredibly notable"). Hard and expert
// ask every bridge, as before.

import type { RouteDifficulty } from './modes';

/** Bridges a visitor can be expected to know by name. Names match
 *  `bridges.json`; keep the list short. */
export const NOTABLE_BRIDGES: ReadonlySet<string> = new Set([
  'Magere Brug',
  'Blauwbrug',
  'Torensluis',
  'Hoge Sluis',
  'Berlagebrug',
  'Nesciobrug',
  'Jan Schaeferbrug',
  'Enneüs Heermabrug',
  'Schellingwouderbrug',
  'Halvemaansbrug',
  'Haarlemmersluis',
]);

function normalise(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const NOTABLE_KEYS = new Set([...NOTABLE_BRIDGES].map(normalise));

export function isNotableBridge(name: string): boolean {
  return NOTABLE_KEYS.has(normalise(name));
}

/** Whether a bridge name may be asked at this difficulty. `custom` follows
 *  the answer mode: typed answers are the hard tier. */
export function bridgeNameAskable(
  difficulty: RouteDifficulty | undefined,
  name: string,
  answerMode?: string,
): boolean {
  const hardTier = difficulty === 'hard' || difficulty === 'expert'
    || (difficulty === 'custom' && answerMode === 'typing');
  return hardTier || isNotableBridge(name);
}
