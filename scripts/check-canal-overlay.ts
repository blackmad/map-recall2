import assert from 'node:assert/strict';
import { defaultPreferences, patchLivePreferences } from '../src/canalRecall/game/preferences.ts';
import {
  belongsToKnowledgeItem,
  buildKnowledgeReview,
  knowledgeItemKey,
} from '../src/canalRecall/knowledgeReview.ts';
import { createOverlayStore } from '../src/canalRecall/overlay/store.ts';
import type { ReviewEvent, ReviewState } from '../src/spacedRepetition.ts';

const zoom = { min: 0.2, max: 1.5, defaultZoom: 0.5 };

{
  const easy = patchLivePreferences(defaultPreferences(zoom), { difficulty: 'easy' }, zoom);
  assert.equal(easy.difficulty, 'easy');
  assert.equal(easy.line, true);
  const custom = patchLivePreferences(easy, { line: false }, zoom);
  assert.equal(custom.difficulty, 'custom');
  assert.equal(custom.line, false);
}

{
  const store = createOverlayStore(defaultPreferences(zoom));
  store.patchPrefs({ travelMode: 'car', routePattern: 'home', homeAddress: 'Da Costakade' }, zoom);
  assert.equal(store.getState().prefs.travelMode, 'car');
  assert.equal(store.getState().prefs.homeAddress, 'Da Costakade');
  store.patchPrefs({ routePattern: 'here' }, zoom);
  assert.equal(store.getState().prefs.routePattern, 'here');
  store.patchPrefs({ travelMode: 'transit' }, zoom);
  assert.equal(store.getState().prefs.travelMode, 'transit');
  store.setSetupOpen(false);
  store.setSettingsOpen(true);
  assert.equal(store.getState().setupOpen, false);
  assert.equal(store.getState().settingsOpen, true);
  store.setKnowledgeOpen(true);
  assert.equal(store.getState().knowledgeOpen, true);
  store.setAccount({ visible: true, label: 'Ada', buttonLabel: 'Sign out' });
  assert.equal(store.getState().account.visible, true);
  assert.equal(store.getState().account.label, 'Ada');
}

{
  const now = Date.UTC(2026, 8, 8, 12);
  const state = (
    name: string,
    dueAt: number,
    repetitions: number,
    lapses = 0,
    center: [number, number] = [52.37, 4.89],
  ): ReviewState => ({
    featureKey: `${name}-${center.join('-')}`,
    mode: 'guess_name',
    dueAt,
    intervalDays: 2,
    ease: 2.3,
    repetitions,
    lapses,
    lastReviewedAt: now - 86_400_000,
    lastEventId: name,
    schedulerVersion: 1,
    featureSnapshot: { name, type: 'street', cityId: 'amsterdam', center },
  });
  const event = (id: string, rating: ReviewEvent['rating'], reviewedAt: number): ReviewEvent => ({
    id,
    featureKey: id,
    mode: 'guess_name',
    rating,
    reviewedAt,
    nextDueAt: now,
    result: { pointsEarned: 1, timeSpentMs: 1000, skipped: false },
  });
  const review = buildKnowledgeReview([
    state('Overtoom', now - 1000, 2),
    state('Overtoom', now + 86_400_000, 3, 0, [52.36, 4.88]),
    state('Prinsengracht', now + 4 * 86_400_000, 3),
    state('Zeedijk', now + 86_400_000, 1, 1),
  ], [
    event('1', 'good', now - 1000),
    event('2', 'again', now - 2 * 86_400_000),
  ], now);

  assert.equal(review.tracked, 3, 'place chunks collapse to a single named item');
  assert.equal(review.due, 1);
  assert.equal(review.mastered, 1);
  assert.equal(review.learning, 1);
  assert.equal(review.reviews, 2);
  assert.equal(review.accuracy, 0.5);
  assert.equal(review.items[0].name, 'Overtoom');
  assert.equal(review.items[0].places, 2);
  assert.equal(review.activity.reduce((sum, day) => sum + day.reviews, 0), 2);
  const prinsengracht = review.items.find(item => item.name === 'Prinsengracht');
  assert.ok(prinsengracht);
  assert.equal(
    belongsToKnowledgeItem(
      state('Prinsengracht', now + 1000, 3),
      knowledgeItemKey({ cityId: 'amsterdam', type: 'street', name: 'Prínsengracht' }),
    ),
    true,
    'practice controls identify all chunks using the same normalized key as the review screen',
  );
}

console.log('canal overlay store: checks passed');
