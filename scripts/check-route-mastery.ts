import assert from 'node:assert/strict';
import type { ReviewState } from '../src/spacedRepetition.ts';
import { routeMasteryFromStates } from '../src/canalRecall/recallStore.ts';

const now = 1_000_000;
const state = (name: string, repetitions: number, dueAt: number, overrides = {}): ReviewState => ({
  featureKey: name, mode: 'guess_name', dueAt, intervalDays: 1, ease: 2.3,
  repetitions, lapses: 0, lastReviewedAt: now - 1, lastEventId: name,
  schedulerVersion: 1,
  featureSnapshot: { name, type: 'street', cityId: 'amsterdam', center: [52.37, 4.89] },
  ...overrides,
});

const mastery = routeMasteryFromStates([
  state('Weteringschans', 1, now + 1),
  state('Weteringschans', 3, now + 1, { featureKey: 'other-place' }),
  state('Nes', 3, now - 1),
  state('Utrechtseweg', 3, now + 1, {
    featureSnapshot: { name: 'Utrechtseweg', type: 'street', cityId: 'utrecht', center: [52.1, 5.1] },
  }),
  state('Rijksmuseum', 3, now + 1, {
    featureSnapshot: { name: 'Rijksmuseum', type: 'museum', cityId: 'amsterdam', center: [52.36, 4.88] },
  }),
], 'amsterdam', now);

assert.equal(mastery.weteringschans, 1, 'the best-known local chunk supplies name mastery');
assert.equal(mastery.nes, 0.5, 'overdue knowledge is weakened rather than forgotten');
assert.equal(mastery.utrechtseweg, undefined, 'another city cannot influence this route');
assert.equal(mastery.rijksmuseum, undefined, 'landmark reviews do not bias road routing');

process.stdout.write('Route mastery checks passed.\n');
