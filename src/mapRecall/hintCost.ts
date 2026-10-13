// Hints are not free: each revealed hint lowers the most a round can score, so
// asking for help carries a visible cost and a hinted bullseye is not treated
// as mastery by the spaced-repetition scheduler.

export const MAX_ROUND_SCORE = 5000;

/** Highest score a round can still earn after `hintsUsed` hints were revealed. */
export function scoreCeiling(hintsUsed: number): number {
  const hints = Math.max(0, Math.floor(Number.isFinite(hintsUsed) ? hintsUsed : 0));
  return Math.max(2000, MAX_ROUND_SCORE - 1000 * Math.min(hints, 3));
}

export function applyHintCeiling(score: number, hintsUsed: number): number {
  return Math.min(score, scoreCeiling(hintsUsed));
}

/** Same cap expressed on the 0-100 accuracy scale. */
export function applyHintCeilingToAccuracy(accuracyPercentage: number, hintsUsed: number): number {
  return Math.min(accuracyPercentage, Math.round((scoreCeiling(hintsUsed) / MAX_ROUND_SCORE) * 100));
}

export function describeHintCap(hintsUsed: number): string {
  return `Capped at ${scoreCeiling(hintsUsed).toLocaleString('en-US')} (${hintsUsed} ${hintsUsed === 1 ? 'hint' : 'hints'})`;
}
