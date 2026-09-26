/**
 * RecallStore.forgetItem — the store half of the knowledge screen's "Forget"
 * control. Unlike queueForPractice (which only makes chunks due), this is a
 * hard reset: every place-local chunk of the named item is erased, so the next
 * encounter schedules it like a brand-new name. The review-event log survives,
 * because those reviews really happened and forgetting a street must not
 * rewrite recall-rate or activity history.
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

// Two mastered Nes chunks, one already-due Nes chunk (forget must take it too,
// unlike practice), another street, and a non-name mode sharing the Nes name.
const nesA = state('v1_amsterdam_nes_a', 'Nes', [52.373, 4.892], now + 3 * DAY);
const nesB = state('v1_amsterdam_nes_b', 'Nes', [52.381, 4.905], now + 10 * DAY);
const nesDue = state('v1_amsterdam_nes_c', 'Nes', [52.39, 4.92], now - 1_000);
const overtoom = state('v1_amsterdam_overtoom_a', 'Overtoom', [52.361, 4.868], now + 3 * DAY);
const nesPinpoint = state('v1_amsterdam_nes_a', 'Nes', [52.373, 4.892], now + 3 * DAY, { mode: 'pinpoint' });

const stateKey = (entry: ReviewState) => `${entry.featureKey}_${entry.mode}`;
const fixtures = [nesA, nesB, nesDue, overtoom, nesPinpoint];
memory.set(STATES_KEY, JSON.stringify(Object.fromEntries(fixtures.map(entry => [stateKey(entry), entry]))));
memory.set(EVENTS_KEY, JSON.stringify({ evt: { id: 'evt' } }));

await store.init();

const nesHereA = { name: 'Nes', type: 'street', cityId: 'amsterdam', center: [52.373, 4.892] as [number, number] };
const overtoomHere = { name: 'Overtoom', type: 'street', cityId: 'amsterdam', center: [52.361, 4.868] as [number, number] };
assert.equal(store.isKnownHere(nesHereA, now), true, 'fixture starts known');
assert.equal(store.routeMastery('amsterdam', now).nes !== undefined, true, 'fixture starts with routing mastery');

// The review screen builds item keys from the snapshot; diacritics and case
// must collapse to the same key the store matches against.
const itemKey = knowledgeItemKey({ cityId: 'amsterdam', type: 'street', name: 'NÉS' });
const forgotten = store.forgetItem(itemKey);
assert.equal(forgotten, 3, 'every name chunk goes, including the already-due one');

const persisted = JSON.parse(memory.get(STATES_KEY) || '{}') as Record<string, ReviewState>;
for (const chunk of [nesA, nesB, nesDue]) {
  assert.equal(persisted[stateKey(chunk)], undefined, `${chunk.featureKey} is erased`);
}
assert.deepEqual(persisted[stateKey(overtoom)], overtoom, 'other names are untouched');
assert.deepEqual(persisted[stateKey(nesPinpoint)], nesPinpoint, 'non-name modes are untouched');
assert.deepEqual(
  JSON.parse(memory.get(EVENTS_KEY) || '{}'),
  { evt: { id: 'evt' } },
  'the review-event log is not rewritten',
);

// The game now treats the name as never answered.
assert.equal(store.isKnownHere(nesHereA, now), false, 'a forgotten name is unknown here');
assert.equal(store.isSuppressedHere(nesHereA, now), false, 'a forgotten name is not suppressed either');
assert.equal(store.routeMastery('amsterdam', now).nes, undefined, 'routing holds no leftover familiarity');
assert.equal(store.isKnownHere(overtoomHere, now), true, 'other names stay known');

assert.equal(store.forgetItem(itemKey), 0, 'a second request finds nothing left to forget');

console.log('Recall forgetItem OK: 12 checks.');
