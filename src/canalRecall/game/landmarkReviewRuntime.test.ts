// Landmark spaced review, end to end through the runtime mixin (#300).
//
// Each "session" is a fresh host object over one shared fake localStorage: the
// game object is rebuilt on reload, so anything kept on `this` (the ride's
// `_landmarkAsked` set) is gone and only localStorage carries over. Run with
// `node --import tsx --test src/canalRecall/game/landmarkReviewRuntime.test.ts`.

import assert from 'node:assert/strict';
import test from 'node:test';

const PPM = 3;
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = globalThis;
globals.PIXELS_PER_METER = PPM;
globals.ANSWER_HOLD_CORRECT = 1;
globals.ANSWER_HOLD_WRONG = 1;
globals.DIFFICULTY_SCORE_MULTIPLIERS = {};
globals.document = { getElementById: () => null };
globals.CanalRecallAnswerPath = {
  submitAnswer(input: { correctName: string; answer: string; noIdea: boolean; score: Record<string, number> }) {
    const wasCorrect = !input.noIdea && input.answer === input.correctName;
    return { ...input.score, wasCorrect, feedback: wasCorrect ? 'Correct' : 'No', feedbackColor: '' };
  },
};

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
}
const storage = new MemoryStorage();
globals.localStorage = storage;

const { GameLandmarkQuestionRuntime } = await import('./landmarkQuestionRuntime.ts');
const { MANUAL_LANDMARKS } = await import('../landmarks/manualModels.ts');

const modelledId = (MANUAL_LANDMARKS as unknown as ReadonlyArray<{ landmarkId?: string }>).find(spec => spec.landmarkId)!.landmarkId!;

/** The asked landmark 100 m ahead; three card-worthy neighbours behind the rider for distractors. */
function landmarks() {
  const at = (id: string, name: string, xM: number, yM: number) => ({
    id, name, type: 'landmark', x: xM * PPM, y: yM * PPM, detail: `${name} is a building.`, imageUrl: '', wikipediaUrl: '',
  });
  return [
    at(modelledId, 'Asked Hall', 100, 0),
    at('d1', 'Distractor One', -300, 0),
    at('d2', 'Distractor Two', -300, 200),
    at('d3', 'Distractor Three', -300, -200),
  ];
}

/** A freshly loaded game: nothing on `this` survives from the last session. */
function newSession() {
  const host = Object.create(GameLandmarkQuestionRuntime.prototype) as Record<string, any>;
  Object.assign(host, {
    player: { x: 0, y: 0, angle: 0, speed: 5 },
    landmarks: landmarks(),
    _seenLandmarks: new Set(),
    _seenLandmarkNames: new Set(),
    routeTo: { id: 'lm-elsewhere', name: 'Elsewhere' },
    raceTime: 0,
    _questionBudget: { asks: [] },
    freeRide: false,
    _overlay: { store: { getState: () => ({ prefs: {} }) } },
    quizPromptName: '', quizCandidateName: '', quizFeedback: '', quizPromptKind: 'route',
    quizAttempts: 0, quizCorrect: 0, quizPoints: 0, quizStreak: 0, quizBestStreak: 0,
    _promptKind: { dataset: {}, firstElementChild: null },
    _promptFeedback: { style: {} },
    _prompt: { style: {} },
    canvas: { focus() {} },
    _teachingGate: () => ({ promptVisible: false, utilityOpen: false }),
    _neighborhoodAt: () => ({ name: 'Testbuurt' }),
    _askBudgetPerMinute: () => undefined,
    _openQuizPrompt(options: { name: string }) { host.quizPromptName = options.name; host.quizPromptKind = 'landmark'; },
    _markAnsweredChoices() {},
    _revealName() {},
    _showLandmarkNotice() {},
  });
  return host;
}

/** One approach: drive up to the landmark; returns whether its question opened. */
function approach(host: Record<string, any>): boolean {
  host.raceTime += 120; // a fresh budget window each approach
  host._tryLandmarkQuestion(); // step 1: the approach candidate
  host._tryLandmarkQuestion(); // step 2: the question (same frame geometry)
  return host.quizPromptKind === 'landmark' && host.quizPromptName === 'Asked Hall';
}

function answer(host: Record<string, any>, outcome: 'right' | 'wrong' | 'no-idea') {
  host._submitLandmarkAnswer(outcome === 'right' ? 'Asked Hall' : 'Distractor One', outcome === 'no-idea');
  host._seenLandmarks = new Set(); // a later pass in the same ride, past the card
}

const realNow = Date.now;
let clock = Date.UTC(2026, 10, 9, 9, 0, 0);
Date.now = () => clock;
const MIN = 60_000;
const DAY = 86_400_000;

/** Asked / not asked through a sequence of sessions. */
function run(outcome: 'right' | 'wrong'): string[] {
  storage.data.clear();
  clock = Date.UTC(2026, 10, 9, 9, 0, 0);
  const log: string[] = [];
  const s1 = newSession();
  const first = approach(s1);
  log.push(`s1:${first ? 'asked' : 'not'}`);
  if (first) answer(s1, outcome);
  log.push(`s1-again:${approach(s1) ? 'asked' : 'not'}`);
  clock += 5 * MIN;
  log.push(`reload+5min:${approach(newSession()) ? 'asked' : 'not'}`);
  clock += 40 * MIN;
  const late = newSession();
  const lateAsked = approach(late);
  log.push(`reload+45min:${lateAsked ? 'asked' : 'not'}`);
  if (lateAsked) answer(late, outcome);
  clock += 2 * DAY;
  log.push(`reload+2days:${approach(newSession()) ? 'asked' : 'not'}`);
  return log;
}

test('a named landmark: once this ride, not after a reload today, back after a day', () => {
  const log = run('right');
  console.log('right:', log.join(' '));
  assert.deepEqual(log, ['s1:asked', 's1-again:not', 'reload+5min:not', 'reload+45min:not', 'reload+2days:asked']);
});

test('a missed landmark: once this ride, parked past the ride, back on the next ride', () => {
  const log = run('wrong');
  console.log('wrong:', log.join(' '));
  assert.deepEqual(log, ['s1:asked', 's1-again:not', 'reload+5min:not', 'reload+45min:asked', 'reload+2days:asked']);
});

test('the ride set does not survive a reload: only localStorage does', () => {
  storage.data.clear();
  const s1 = newSession();
  approach(s1);
  assert.equal(s1._landmarkAsked.size, 1);
  assert.equal(newSession()._landmarkAsked, undefined);
  Date.now = realNow;
});
