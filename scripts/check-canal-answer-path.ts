import assert from 'node:assert/strict';
import { scheduleReview, type ReviewState } from '../src/spacedRepetition.ts';
import { submitAnswer, type AnswerRecallStore } from '../src/canalRecall/answerPath.ts';
import type { RecallFeature } from '../src/canalRecall/recallStore.ts';

const feature: RecallFeature = {
  name: 'Prinsengracht',
  type: 'canal',
  cityId: 'amsterdam',
  center: [52.37, 4.89],
};
let rating = '';
let recordedCorrect: boolean | undefined;
const recall: AnswerRecallStore = {
  record(answeredFeature, correct): ReviewState {
    recordedCorrect = correct;
    const scheduled = scheduleReview({
      roundNumber: 0,
      feature: answeredFeature as never,
      gameMode: 'guess_name',
      userSelectedName: correct ? answeredFeature.name : '_wrong_',
      isCorrect: correct,
      pointsEarned: correct ? 1 : 0,
      timeSpentMs: 6000,
    }, undefined, 1_000_000);
    rating = scheduled.event.rating;
    return scheduled.state;
  },
};
const revealed: string[] = [];

const result = submitAnswer({
  correctName: feature.name,
  answer: '',
  noIdea: true,
  score: { attempts: 3, correct: 2, points: 250, streak: 2, bestStreak: 4 },
  difficultyMultiplier: 0.75,
  gameyFeatures: true,
  recallFeature: feature,
  recallStore: recall,
  revealName: name => revealed.push(name),
});

assert.equal(result.attempts, 3, 'no idea is not recorded as an attempt');
assert.equal(result.correct, 2, 'no idea is not recorded as correct');
assert.equal(result.streak, 0, 'no idea resets the streak');
assert.equal(result.feedback, 'This is Prinsengracht');
assert.deepEqual(revealed, ['Prinsengracht'], 'no idea reveals the answer');
assert.equal(recordedCorrect, false, 'no idea records a miss in the recall store');
assert.equal(rating, 'again', 'the injected recall store schedules no idea as again');

process.stdout.write('Canal answer-path checks passed.\n');
