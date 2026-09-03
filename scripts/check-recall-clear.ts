/**
 * RecallStore.clearKnowledge wipes local spaced-repetition memory.
 */
import assert from 'node:assert/strict';
import { ReviewState } from '../src/spacedRepetition.ts';

const STATES_KEY = 'mapRecall_reviewStates_v1';
const EVENTS_KEY = 'mapRecall_reviewEvents_v1';

const memory = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
};

// Isolate from the real browser store by stubbing before import side effects.
(globalThis as { localStorage?: typeof localStorageMock }).localStorage = localStorageMock;

const { store } = await import('../src/canalRecall/recallStore.ts');

const sample: ReviewState = {
  featureKey: 'v1_amsterdam_nes_x',
  mode: 'guess_name',
  dueAt: Date.now() + 86_400_000,
  intervalDays: 1,
  ease: 2.3,
  repetitions: 2,
  lapses: 0,
  lastReviewedAt: Date.now(),
  lastEventId: 'evt',
  schedulerVersion: 1,
  featureSnapshot: {
    name: 'Nes', type: 'street', cityId: 'amsterdam', center: [52.37, 4.89],
  },
};

memory.set(STATES_KEY, JSON.stringify({ [`${sample.featureKey}_guess_name`]: sample }));
memory.set(EVENTS_KEY, JSON.stringify({ evt: { id: 'evt' } }));

// Re-read from our stubbed storage.
await store.init();
assert.equal(store.masteredCount, 1, 'fixture loads as mastered');

const cleared = await store.clearKnowledge();
assert.equal(cleared, 1);
assert.equal(store.masteredCount, 0);
assert.deepEqual(JSON.parse(memory.get(STATES_KEY) || '{}'), {});
assert.deepEqual(JSON.parse(memory.get(EVENTS_KEY) || '{}'), {});

console.log('Recall clearKnowledge OK: 1 check.');
