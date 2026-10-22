import assert from 'node:assert/strict';
import test from 'node:test';
import { coercePreferences, defaultPreferences, parsePreferences } from './preferences';

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
