import assert from 'node:assert/strict';
import test from 'node:test';
import { coercePreferences, defaultControlMode, defaultPreferences, parsePreferences } from './preferences';

const zoom = { min: 0.1, max: 1.3, defaultZoom: 0.6 };

test('a fresh player starts on the boat, in chase', () => {
  const prefs = defaultPreferences(zoom);
  assert.equal(prefs.travelMode, 'boat');
  assert.equal(prefs.viewMode, 'chase');
});

test('a view chosen in the ride settings is kept on load', () => {
  const prefs = parsePreferences({ viewMode: 'heading', travelMode: 'car' }, zoom);
  assert.equal(prefs.viewMode, 'heading');
  assert.equal(prefs.travelMode, 'car');
});

test('a stored cockpit reads as chase, the retired view', () => {
  assert.equal(coercePreferences({ viewMode: 'cockpit' }, zoom).viewMode, 'chase');
});

test('a phone follows the street; a keyboard keeps car steering', () => {
  assert.equal(defaultControlMode({ maxTouchPoints: 5, coarsePointer: true }), 'street');
  assert.equal(defaultControlMode({ maxTouchPoints: 0 }), 'relative');
  assert.equal(defaultControlMode({ maxTouchPoints: 10, coarsePointer: false }), 'relative', 'a touch laptop is a keyboard');
});

test('on a phone an old default stick migrates once; choices are kept', () => {
  const scope = globalThis as unknown as { navigator?: unknown; matchMedia?: unknown };
  const saved = { navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'), matchMedia: scope.matchMedia };
  Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 5 }, configurable: true });
  scope.matchMedia = () => ({ matches: true });
  try {
    assert.equal(defaultPreferences(zoom).controlMode, 'street');
    assert.equal(parsePreferences({ controlMode: 'relative' }, zoom).controlMode, 'street', 'unflagged relative was the old default');
    assert.equal(parsePreferences({ controlMode: 'absolute' }, zoom).controlMode, 'absolute', 'a chosen point mode is kept');
    assert.equal(parsePreferences({ controlMode: 'relative', controlDefaultVersion: 2 }, zoom).controlMode, 'relative', 'a chosen stick is kept');
    assert.equal(coercePreferences({ controlMode: 'relative' }, zoom).controlMode, 'relative', 'a live choice is not migrated');
  } finally {
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator);
    else delete (globalThis as { navigator?: unknown }).navigator;
    scope.matchMedia = saved.matchMedia;
  }
  assert.equal(parsePreferences({ controlMode: 'relative' }, zoom).controlMode, 'relative', 'on a keyboard nothing migrates');
});
