import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openRidingPrompt, RIDING_PROMPT_TIMEOUT_SECONDS, RIDING_LEAVE_STREET_SECONDS } from './ridingPrompt.ts';

// The runtime module reads browser globals when it loads; give it empty ones.
Object.assign(globalThis, { window: globalThis, document: { getElementById: () => null } });
const { GameRecallRuntime } = await import('./recallRuntime.ts');

// A riding question opened just before boarding an IJ ferry. `game.js` skips
// `_updateCanalQuiz` while `player.ferryOrigin` is set, so before
// `_updateQuizOnFerry` nothing ticked the question until the crossing ended.

type Fake = Record<string, any>;
const proto = GameRecallRuntime.prototype as unknown as Fake;

function ferryGame(roadName: string): Fake {
  const events: string[] = [];
  const style = { display: 'flex' };
  const game: Fake = {
    player: { x: 0, y: 0, angle: 0, ferryOrigin: { pier: 'Centraal' } },
    track: { getRoadName: () => roadName },
    quizPromptName: 'Papaverweg',
    quizPromptKind: 'route',
    quizPromptMode: 'riding',
    quizFeedback: '',
    _ridingState: openRidingPrompt('Papaverweg'),
    _prompt: { style, classList: { remove: () => undefined } },
    quizCurrentName: '', quizCandidateName: '', quizCandidateTimer: 0, quizCandidateMetres: 0,
    quizAttempts: 0, quizCorrect: 0, quizPoints: 0, quizStreak: 0, quizBestStreak: 0,
    gameyFeatures: true,
    recall: null,
    raceTime: 0,
    events,
    _logPrompt: (entry: { event: string }) => { events.push(entry.event); },
    _positionRidingPrompt: () => undefined,
    _recallFeatureAt: () => null,
    _revealName: (name: string) => { events.push(`reveal:${name}`); },
    _tickFeedbackTimeout: () => undefined,
  };
  for (const name of ['_updateQuizOnFerry', '_updateRidingPrompt', '_finishRidingPass']) game[name] = proto[name];
  return game;
}

(globalThis as Fake).CanalRecallAnswerPath = {
  submitAnswer: (input: { correctName: string; revealName(name: string): void }) => {
    input.revealName(input.correctName);
    return { feedback: `Passed — that was ${input.correctName}` };
  },
};

test('a question left open at boarding times out on the ferry, name still hidden', () => {
  const game = ferryGame('Papaverweg');
  const frames = Math.ceil(RIDING_PROMPT_TIMEOUT_SECONDS / 0.5) + 1;
  for (let i = 0; i < frames; i++) game._updateQuizOnFerry(0.5);
  assert.deepEqual(game.events, ['expired'], 'the 12 s count while aboard');
  assert.equal(game._prompt.style.display, 'none', 'the card is gone');
  assert.ok(!game.events.some((event: string) => event.startsWith('reveal:')), 'a name is not shown while the street is still under the vehicle');
});

test('boarding takes the rider off the street, so the pass reveals it after the usual grace', () => {
  const game = ferryGame('');
  const frames = Math.ceil(RIDING_LEAVE_STREET_SECONDS / 0.25) + 1;
  for (let i = 0; i < frames; i++) game._updateQuizOnFerry(0.25);
  assert.deepEqual(game.events, ['reveal:Papaverweg', 'passed']);
  assert.equal(game.quizPromptName, '', 'the question is closed');
  assert.equal(game.quizFeedback, 'Passed — that was Papaverweg');
});

test('nothing new is asked on a ferry frame', () => {
  const game = ferryGame('Papaverweg');
  game.quizPromptName = '';
  game._ridingState = null;
  game._updateQuizOnFerry(1);
  assert.deepEqual(game.events, []);
});
