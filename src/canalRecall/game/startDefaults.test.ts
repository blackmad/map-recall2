import assert from 'node:assert/strict';
import test from 'node:test';
import { coercePreferences, defaultPreferences, parsePreferences } from './preferences';

const zoom = { min: 0.1, max: 1.3, defaultZoom: 0.6 };

test('a fresh player starts on the boat, north up', () => {
  const prefs = defaultPreferences(zoom);
  assert.equal(prefs.travelMode, 'boat');
  assert.equal(prefs.viewMode, 'north');
});

test('a view chosen in the ride settings is kept on load', () => {
  const prefs = parsePreferences({ viewMode: 'chase', travelMode: 'car' }, zoom);
  assert.equal(prefs.viewMode, 'chase');
  assert.equal(prefs.travelMode, 'car');
});

test('an in-ride view change applies', () => {
  assert.equal(coercePreferences({ viewMode: 'cockpit' }, zoom).viewMode, 'cockpit');
});
