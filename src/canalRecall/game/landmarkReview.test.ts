import assert from 'node:assert/strict';
import test from 'node:test';
import {
  capReviews,
  dueCount,
  isDue,
  LANDMARK_MISSED_INTERVAL_MS,
  LANDMARK_REVIEW_DAYS,
  LANDMARK_REVIEW_MAX_ENTRIES,
  LANDMARK_REVIEW_STORAGE_KEY,
  nextDue,
  pickAskable,
  readLandmarkReviews,
  recordLandmarkOutcome,
  reviewKind,
  seedFromSightings,
  type LandmarkReviews,
} from './landmarkReview.ts';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 9, 9);

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

test('named right climbs 1, 3, 7, 21 days, then stays at 21', () => {
  let state = undefined as ReturnType<typeof nextDue> | undefined;
  let now = T0;
  const gaps: number[] = [];
  for (let i = 0; i < 6; i++) {
    state = nextDue(state, 'right', now);
    gaps.push((state.dueAt - now) / DAY);
    now = state.dueAt;
  }
  assert.deepEqual(gaps, [1, 3, 7, 21, 21, 21]);
  assert.deepEqual([...LANDMARK_REVIEW_DAYS], [1, 3, 7, 21]);
  assert.equal(state!.rights, 6);
});

test('a miss (wrong or no idea) drops to the bottom and parks it past this ride', () => {
  const climbed = nextDue(nextDue(undefined, 'right', T0), 'right', T0 + DAY);
  for (const outcome of ['wrong', 'no-idea'] as const) {
    const missed = nextDue(climbed, outcome, T0 + 5 * DAY);
    assert.equal(missed.step, 0);
    assert.equal(missed.dueAt, T0 + 5 * DAY + LANDMARK_MISSED_INTERVAL_MS);
    assert.equal(missed.misses, 1);
    assert.equal(missed.rights, 2);
    // Named right after the miss: back on the first rung.
    assert.equal(nextDue(missed, 'right', T0 + 6 * DAY).dueAt, T0 + 7 * DAY);
  }
  assert.equal(LANDMARK_MISSED_INTERVAL_MS, 30 * 60 * 1000);
});

test('due, new and waiting', () => {
  const named = nextDue(undefined, 'right', T0);
  assert.equal(isDue(undefined, T0), false);
  assert.equal(reviewKind(undefined, T0), 'new-unlearned');
  assert.equal(reviewKind(named, T0 + DAY - 1), 'known');
  assert.equal(reviewKind(named, T0 + DAY), 'due-review');
  assert.equal(dueCount({ a: named, b: nextDue(undefined, 'wrong', T0) }, T0 + 2 * DAY), 2);
  assert.equal(dueCount({ a: named }, T0 + 1), 0);
});

test('pickAskable: due before new, nearest within each, waiting never', () => {
  const states: LandmarkReviews = {
    waiting: nextDue(undefined, 'right', T0),
    due: nextDue(undefined, 'right', T0 - 2 * DAY),
  };
  const now = T0 + 1000;
  const candidates = [
    { id: 'waiting', distance: 10 },
    { id: 'new-near', distance: 20 },
    { id: 'new-far', distance: 90 },
    { id: 'due', distance: 120 },
  ];
  assert.deepEqual(pickAskable(candidates, states, now), { candidate: candidates[3], kind: 'due-review' });
  assert.deepEqual(pickAskable(candidates.slice(0, 3), states, now), { candidate: candidates[1], kind: 'new-unlearned' });
  assert.equal(pickAskable(candidates.slice(0, 1), states, now), null);
  // Equal distance: the rng decides.
  const tie = [{ id: 'x', distance: 5 }, { id: 'y', distance: 5 }];
  const seq = (values: number[]) => () => values.shift()!;
  assert.equal(pickAskable(tie, {}, now, seq([0.9, 0.1]))!.candidate.id, 'y');
  assert.equal(pickAskable(tie, {}, now, seq([0.1, 0.9]))!.candidate.id, 'x');
});

test('a landmark named before the schedule comes back a day after it was named', () => {
  const seeded = seedFromSightings({}, {
    a: { hood: 'Jordaan', how: 'named', at: T0 },
    b: { hood: 'Jordaan', how: 'noticed', at: T0 },
  });
  assert.deepEqual(Object.keys(seeded), ['a']);
  assert.equal(seeded.a!.dueAt, T0 + DAY);
  // An existing state wins over the sighting.
  const existing = { a: nextDue(undefined, 'wrong', T0 + 3 * DAY) };
  assert.equal(seedFromSightings(existing, { a: { hood: '', how: 'named', at: T0 } }), existing);
});

test('persistence: round trip, corrupt JSON, cap of 200 evicting the least recently asked', () => {
  const store = new MemoryStorage();
  let states: LandmarkReviews = {};
  for (let i = 0; i < LANDMARK_REVIEW_MAX_ENTRIES + 25; i++) {
    states = recordLandmarkOutcome(store, states, `lm${i}`, i % 2 ? 'right' : 'wrong', T0 + i * 1000);
  }
  const read = readLandmarkReviews(store);
  assert.equal(Object.keys(read).length, LANDMARK_REVIEW_MAX_ENTRIES);
  assert.equal(read.lm0, undefined, 'the oldest is evicted first');
  assert.equal(read.lm24, undefined);
  assert.ok(read.lm25 && read[`lm${LANDMARK_REVIEW_MAX_ENTRIES + 24}`]);
  assert.deepEqual(read, states);
  // Re-answering an old one refreshes it, so it survives the next eviction.
  states = recordLandmarkOutcome(store, states, 'lm25', 'right', T0 + DAY);
  states = recordLandmarkOutcome(store, states, 'new', 'right', T0 + DAY + 1);
  assert.ok(states.lm25);
  assert.equal(states.lm26, undefined);

  store.setItem(LANDMARK_REVIEW_STORAGE_KEY, '{not json');
  assert.deepEqual(readLandmarkReviews(store), {});
  store.setItem(LANDMARK_REVIEW_STORAGE_KEY, JSON.stringify({ ok: { dueAt: 5, step: 2 }, bad: { step: 1 }, nil: null }));
  assert.deepEqual(readLandmarkReviews(store), { ok: { step: 2, dueAt: 5, lastAskedAt: 0, rights: 0, misses: 0 } });
  assert.deepEqual(readLandmarkReviews(null), {});
  assert.equal(Object.keys(capReviews({ a: nextDue(undefined, 'right', T0) }, 5)).length, 1);
});
