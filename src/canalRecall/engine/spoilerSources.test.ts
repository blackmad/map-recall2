import test from 'node:test';
import assert from 'node:assert/strict';
import { SpoilerSources } from './spoilerSources';

test('a route start adds the track names to the extract names instead of replacing them', () => {
  const s = new SpoilerSources();
  s.set(['Keizersgracht', 'Magere Brug', 'Leidseplein'], 'extract');
  const names = s.set(['Keizersgracht', 'Keizersgracht', 'Leidsestraat', '', 'Leidsestraat'], 'track');
  assert.deepEqual(names, ['Keizersgracht', 'Magere Brug', 'Leidseplein', 'Leidsestraat']);
});

test('a new route replaces only its own source', () => {
  const s = new SpoilerSources();
  s.set(['Magere Brug'], 'extract');
  s.set(['Leidsestraat'], 'track');
  assert.deepEqual(s.set(['Overtoom'], 'track'), ['Magere Brug', 'Overtoom']);
  assert.deepEqual(s.set(['Blauwbrug']), ['Blauwbrug', 'Overtoom'], 'the default source is the extract');
  assert.deepEqual(s.names(), ['Blauwbrug', 'Overtoom']);
});
