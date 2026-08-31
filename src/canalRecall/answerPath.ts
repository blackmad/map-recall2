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
}

export interface SubmitAnswerInput {
  correctName: string;
  answer: string;
  noIdea?: boolean;
  score: AnswerScore;
  difficultyMultiplier: number;
  /** Bounded bonus for correctly recalling a street that was new to this route. */
  noveltyMultiplier?: number;
  gameyFeatures: boolean;
  recallFeature?: RecallFeature | null;
  recallStore?: AnswerRecallStore | null;
  revealName(name: string): void;
  markLearned?(name: string): void;
  rememberKnownPlace?(name: string, center: RecallFeature['center']): void;
}

export interface AnswerResult extends AnswerScore {
  wasCorrect: boolean;
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
  const noIdea = input.noIdea === true;
  const wasCorrect = !noIdea
    && normaliseAnswer(input.answer) === normaliseAnswer(input.correctName);
  let { attempts, correct, points, streak, bestStreak } = input.score;
  let feedback: string;

  if (!noIdea) attempts++;
  if (noIdea) {
    streak = 0;
    feedback = `This is ${input.correctName}`;
    input.revealName(input.correctName);
  } else if (wasCorrect) {
    correct++;
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    const base = Math.round(100 * input.difficultyMultiplier);
    const streakMultiplier = input.gameyFeatures ? 1 + 0.1 * Math.min(streak - 1, 9) : 1;
    const noveltyMultiplier = input.gameyFeatures
      ? Math.max(1, Math.min(1.25, input.noveltyMultiplier ?? 1)) : 1;
    const earned = Math.round(base * streakMultiplier * noveltyMultiplier);
    points += earned;
    input.markLearned?.(input.correctName);
    input.revealName(input.correctName);
    if (!input.gameyFeatures) {
      feedback = `Correct — ${input.correctName}`;
    } else if (noveltyMultiplier > 1) {
      feedback = `Correct — ${input.correctName}  (+${earned} pts, ${noveltyMultiplier.toFixed(2)}× new street)`;
    } else if (streak >= 2) {
      feedback = `Correct — ${input.correctName}  (+${earned} pts, ${streak}× streak)`;
    } else {
      feedback = `Correct — ${input.correctName}  (+${earned} pts)`;
    }
  } else {
    streak = 0;
    feedback = `Not quite — this is ${input.correctName}`;
    input.revealName(input.correctName);
  }

  if (input.recallStore && input.recallFeature) {
    input.recallStore.record(input.recallFeature, wasCorrect);
    if (wasCorrect) input.rememberKnownPlace?.(input.correctName, input.recallFeature.center);
  }

  return {
    attempts, correct, points, streak, bestStreak, wasCorrect, feedback,
    feedbackColor: wasCorrect ? '#4ade80' : noIdea ? '#7DD3FC' : '#fbbf24',
  };
}
