import type { ReviewState } from '../spacedRepetition';
import type { RecallFeature } from './recallStore';

export interface AnswerScore {
  attempts: number;
  correct: number;
  points: number;
  streak: number;
  bestStreak: number;
}

export interface AnswerRecallStore {
  record(feature: RecallFeature, correct: boolean): ReviewState;
  /**
   * The rider rode past a question without answering (riding prompt timed out
   * or the street was left). A name that was only seen is exposure: it must
   * not schedule a miss. Optional so a store that does not track exposure
   * keeps working; the name simply stays unlearned and is asked again later.
   */
  expose?(feature: RecallFeature): void;
}

export interface SubmitAnswerInput {
  correctName: string;
  /** How the name is shown in feedback, when it differs from `correctName`
   *  (a bridge's official spelling; `correctName` stays the matched OSM name). */
  displayName?: string;
  /** Other spellings a typed answer may use ("Katten brug" and "Kattenbrug").
   *  `correctName` and `displayName` are always accepted. */
  acceptedAnswers?: readonly string[];
  answer: string;
  noIdea?: boolean;
  /**
   * The grade `passed`: a non-blocking riding question ended unanswered. It
   * is exposure, never a miss: no attempt, no points, the streak is kept, the
   * name is revealed (the caller only passes once the rider has left the
   * street, so the answer was never shown early) and it is not marked learned.
   */
  passed?: boolean;
  score: AnswerScore;
  difficultyMultiplier: number;
  /** Bounded bonus for correctly recalling a street that was new to this route. */
  noveltyMultiplier?: number;
  /**
   * Bounded bonus for naming a street with a separated cycle track. Street
   * (cycling) mode only; never used as a routing weight.
   */
  cycleTrackMultiplier?: number;
  gameyFeatures: boolean;
  recallFeature?: RecallFeature | null;
  recallStore?: AnswerRecallStore | null;
  revealName(name: string): void;
  markLearned?(name: string): void;
  rememberKnownPlace?(name: string, center: RecallFeature['center']): void;
}

export interface AnswerResult extends AnswerScore {
  wasCorrect: boolean;
  /** True for the `passed` grade. */
  passed: boolean;
  feedback: string;
  feedbackColor: string;
}

export function normaliseAnswer(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Resolve one name answer. DOM and crossing behavior deliberately stay with
 * the game; scoring, revealing, and review scheduling live together here so
 * their contract can be tested without constructing the canvas application.
 */
export function submitAnswer(input: SubmitAnswerInput): AnswerResult {
  const shown = input.displayName || input.correctName;
  if (input.passed) {
    input.revealName(input.correctName);
    if (input.recallStore && input.recallFeature) input.recallStore.expose?.(input.recallFeature);
    return {
      ...input.score, wasCorrect: false, passed: true,
      feedback: `Passed — that was ${shown}`,
      feedbackColor: '#3a5a86',
    };
  }
  const noIdea = input.noIdea === true;
  const given = normaliseAnswer(input.answer);
  const wasCorrect = !noIdea && [input.correctName, input.displayName, ...(input.acceptedAnswers ?? [])]
    .some((name) => !!name && normaliseAnswer(name) === given);
  let { attempts, correct, points, streak, bestStreak } = input.score;
  let feedback: string;

  if (!noIdea) attempts++;
  if (noIdea) {
    streak = 0;
    feedback = `This is ${shown}`;
    input.revealName(input.correctName);
  } else if (wasCorrect) {
    correct++;
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    const base = Math.round(100 * input.difficultyMultiplier);
    const streakMultiplier = input.gameyFeatures ? 1 + 0.1 * Math.min(streak - 1, 9) : 1;
    const noveltyMultiplier = input.gameyFeatures
      ? Math.max(1, Math.min(1.25, input.noveltyMultiplier ?? 1)) : 1;
    const cycleTrackMultiplier = input.gameyFeatures
      ? Math.max(1, Math.min(1.15, input.cycleTrackMultiplier ?? 1)) : 1;
    const earned = Math.round(base * streakMultiplier * noveltyMultiplier * cycleTrackMultiplier);
    points += earned;
    input.markLearned?.(input.correctName);
    input.revealName(input.correctName);
    if (!input.gameyFeatures) {
      feedback = `Correct — ${shown}`;
    } else if (noveltyMultiplier > 1 && cycleTrackMultiplier > 1) {
      feedback = `Correct — ${shown}  (+${earned} pts · new name + cycle track bonus)`;
    } else if (noveltyMultiplier > 1) {
      feedback = `Correct — ${shown}  (+${earned} pts · new name bonus)`;
    } else if (cycleTrackMultiplier > 1) {
      feedback = `Correct — ${shown}  (+${earned} pts · cycle track bonus)`;
    } else if (streak >= 2) {
      feedback = `Correct — ${shown}  (+${earned} pts · ${streak} in a row)`;
    } else {
      feedback = `Correct — ${shown}  (+${earned} pts)`;
    }
  } else {
    streak = 0;
    feedback = `Not quite — this is ${shown}`;
    input.revealName(input.correctName);
  }

  if (input.recallStore && input.recallFeature) {
    input.recallStore.record(input.recallFeature, wasCorrect);
    if (wasCorrect) input.rememberKnownPlace?.(input.correctName, input.recallFeature.center);
  }

  return {
    attempts, correct, points, streak, bestStreak, wasCorrect, passed: false, feedback,
    // Ink tones for the daylight paper card (all ≥ 5:1 on #fbf8f2). The old
    // neon green/amber/sky were built for a navy plate and fell under 2:1.
    feedbackColor: wasCorrect ? '#2f6f47' : noIdea ? '#3a5a86' : '#8a4a18',
  };
}
