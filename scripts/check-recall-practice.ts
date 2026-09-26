/**
 * RecallStore.queueForPractice — the store half of the knowledge screen's
 * "Practice again" control. It re-queues every place-local chunk of one named
 * item as a self-reported practice request, not a quiz result: the chunks
 * become due (so the game asks the name again instead of treating it as
 * known), while repetitions, lapses, ease, interval, and the event log stay
 * exactly as they were.
 */
import assert from 'node:assert/strict';
import { ReviewState } from '../src/spacedRepetition.ts';
import { knowledgeItemKey } from '../src/canalRecall/knowledgeReview.ts';

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

const now = Date.UTC(2026, 8, 8, 12, 0, 0);
const DAY = 86_400_000;

const state = (
  featureKey: string,
  name: string,
  center: [number, number],
  dueAt: number,
  overrides: Partial<ReviewState> = {},
): ReviewState => ({
  featureKey,
  mode: 'guess_name',
  dueAt,
  intervalDays: 6,
  ease: 2.5,
  repetitions: 3,
  lapses: 1,
  lastReviewedAt: now - DAY,
  lastEventId: 'evt',
  schedulerVersion: 1,
  featureSnapshot: { name, type: 'street', cityId: 'amsterdam', center },
  ...overrides,
});

// Two well-known Nes chunks ~1 km apart, one Nes chunk already due, one other
// street, and a non-name mode that shares the Nes name but must not be touched.
const nesA = state('v1_amsterdam_nes_a', 'Nes', [52.373, 4.892], now + 3 * DAY);
const nesB = state('v1_amsterdam_nes_b', 'Nes', [52.381, 4.905], now + 10 * DAY);
const nesAlreadyDue = state('v1_amsterdam_nes_c', 'Nes', [52.39, 4.92], now - 1_000);
const overtoom = state('v1_amsterdam_overtoom_a', 'Overtoom', [52.361, 4.868], now + 3 * DAY);
const nesPinpoint = state('v1_amsterdam_nes_a', 'Nes', [52.373, 4.892], now + 3 * DAY, { mode: 'pinpoint' });

const stateKey = (entry: ReviewState) => `${entry.featureKey}_${entry.mode}`;
const fixtures = [nesA, nesB, nesAlreadyDue, overtoom, nesPinpoint];
memory.set(STATES_KEY, JSON.stringify(Object.fromEntries(fixtures.map(entry => [stateKey(entry), entry]))));
memory.set(EVENTS_KEY, JSON.stringify({ evt: { id: 'evt' } }));

await store.init();

const nesHereA = { name: 'Nes', type: 'street', cityId: 'amsterdam', center: [52.373, 4.892] as [number, number] };
const overtoomHere = { name: 'Overtoom', type: 'street', cityId: 'amsterdam', center: [52.361, 4.868] as [number, number] };
assert.equal(store.isKnownHere(nesHereA, now), true, 'fixture starts known');

// The review screen builds item keys from the snapshot; diacritics and case
// must collapse to the same key the store matches against.
const itemKey = knowledgeItemKey({ cityId: 'amsterdam', type: 'street', name: 'NÉS' });
const queued = store.queueForPractice(itemKey, now);
assert.equal(queued, 2, 'only the chunks not already due are re-queued');

const persisted = JSON.parse(memory.get(STATES_KEY) || '{}') as Record<string, ReviewState>;
for (const chunk of [nesA, nesB]) {
  const after = persisted[stateKey(chunk)];
  assert.equal(after.dueAt, now, `${chunk.featureKey} is due now`);
  assert.deepEqual(
    { ...after, dueAt: chunk.dueAt },
    chunk,
    `${chunk.featureKey} keeps its repetitions, lapses, ease, interval, and history`,
  );
}
assert.deepEqual(persisted[stateKey(nesAlreadyDue)], nesAlreadyDue, 'an already-due chunk is left alone');
assert.deepEqual(persisted[stateKey(overtoom)], overtoom, 'other names are untouched');
assert.deepEqual(persisted[stateKey(nesPinpoint)], nesPinpoint, 'non-name modes are untouched');
assert.deepEqual(
  JSON.parse(memory.get(EVENTS_KEY) || '{}'),
  { evt: { id: 'evt' } },
  'practice is not a quiz result: no review event is invented',
);

// The game now behaves as if the name needs review again.
assert.equal(store.isKnownHere(nesHereA, now), false, 'a queued name is no longer known here');
assert.equal(store.isKnownHere(overtoomHere, now), true, 'other names stay known');
assert.equal(store.routeReviewDue('amsterdam', now).nes, true, 'the overview paints the name as due');

assert.equal(store.queueForPractice(itemKey, now), 0, 'a second request finds nothing left to queue');

console.log('Recall queueForPractice OK: 10 checks.');
