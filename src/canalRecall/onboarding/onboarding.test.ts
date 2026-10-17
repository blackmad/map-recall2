// node --import tsx --test src/canalRecall/onboarding/onboarding.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONBOARDING_STORAGE_KEY,
  markOnboardingSeen,
  onboardingSteps,
  shouldShowOnboarding,
} from './steps.ts';
import { scoreTally, zoomBadgeShouldFlash, zoomBadgeText } from '../hudCopy.ts';
import { difficultyGloss } from '../game/setupCopy.ts';

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map };
}

test('the intro shows on a first visit and not after it is seen', () => {
  const storage = memoryStorage();
  assert.equal(shouldShowOnboarding(storage), true);
  markOnboardingSeen(storage);
  assert.equal(storage.map.get(ONBOARDING_STORAGE_KEY), 'done');
  assert.equal(shouldShowOnboarding(storage), false);
});

test('storage that throws never loops the intro and never throws', () => {
  const broken = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
  };
  assert.equal(shouldShowOnboarding(broken), false);
  assert.doesNotThrow(() => markOnboardingSeen(broken));
  assert.equal(shouldShowOnboarding(null), false);
});

test('three steps: ride, name it, score; hints follow the device', () => {
  const keys = onboardingSteps('keyboard');
  const touch = onboardingSteps('touch');
  assert.deepEqual(keys.map(s => s.id), ['ride', 'name-it', 'score']);
  assert.equal(keys[0]!.specimen.kind, 'keys');
  assert.equal(touch[0]!.specimen.kind, 'ring');
  assert.match(keys[1]!.specimen.caption, /1–4/);
  assert.doesNotMatch(touch[1]!.specimen.caption, /1–4|press/i, 'a phone has no number keys');
  assert.match(keys[2]!.body, /new to you/);
});

test('the intro names no real street or canal', () => {
  for (const step of [...onboardingSteps('keyboard'), ...onboardingSteps('touch')]) {
    const text = `${step.title} ${step.body} ${step.specimen.caption}`;
    assert.doesNotMatch(text, /gracht|straat|kade|weg\b|plein/i, step.id);
  }
});

test('the plaque tally says what it counts', () => {
  assert.equal(scoreTally({ correct: 3, attempts: 4, points: 290, gamey: true }), '3 / 4 named  ·  290 pts');
  assert.equal(scoreTally({ correct: 3, attempts: 4, points: 290, gamey: true, compact: true }), '3/4 named · 290 pts');
  assert.equal(scoreTally({ correct: 0, attempts: 0, points: 0, gamey: false, compact: true }), '0/0 named');
  assert.equal(zoomBadgeText(0.654), 'Zoom 65%');
});

test('the zoom badge flashes only on a player zoom', () => {
  // The camera settling after the start flight is not the player's zoom.
  assert.equal(zoomBadgeShouldFlash(0.6, 0.65, false), false);
  assert.equal(zoomBadgeShouldFlash(null, 0.65, true), false);
  assert.equal(zoomBadgeShouldFlash(0.65, 0.65, true), false);
  assert.equal(zoomBadgeShouldFlash(0.6, 0.65, true), true);
});

test('each difficulty says what it changes', () => {
  assert.equal(difficultyGloss('easy'), 'Pick the name from a list. Route line shown.');
  assert.equal(difficultyGloss('medium'), 'Pick the name from a list. No route line.');
  assert.equal(difficultyGloss('hard'), 'Type each name. No route line or minimap.');
  assert.equal(difficultyGloss('expert'), 'Type each name. No route line, arrow or minimap.');
  assert.match(difficultyGloss('custom'), /More options/);
});
