import assert from 'node:assert/strict';
import test from 'node:test';
import { coercePreferences, defaultPreferences, parsePreferences } from './preferences';

const zoom = { min: 0.1, max: 1.3, defaultZoom: 0.6 };

test('a fresh player starts on the bike in Chase', () => {
  const prefs = defaultPreferences(zoom);
  assert.equal(prefs.travelMode, 'car');
  assert.equal(prefs.viewMode, 'chase');
});

test('a stored view is dropped on load; the stored vehicle is kept', () => {
  const prefs = parsePreferences({ viewMode: 'north', travelMode: 'boat' }, zoom);
  assert.equal(prefs.viewMode, 'chase');
  assert.equal(prefs.travelMode, 'boat');
});

test('an in-ride view change still applies', () => {
  assert.equal(coercePreferences({ viewMode: 'cockpit' }, zoom).viewMode, 'cockpit');
});
