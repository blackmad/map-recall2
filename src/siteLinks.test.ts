import test from 'node:test';
import assert from 'node:assert/strict';
import { canalPageLinks, markReturningPlayer, RETURNING_PLAYER_KEY, siteLinks } from './siteLinks.ts';

test('public site links are same-origin and root-relative', () => {
  assert.deepEqual(siteLinks('canal-site'), {
    home: '/?home', ride: '/ride', quiz: '/quiz/', canal: '/', data: '/data/',
  });
});

test('dev layout keeps Map Quest at the root and Canal Recall under canal-drive/', () => {
  assert.deepEqual(siteLinks('dev', '/'), {
    home: '/canal-drive/landing.html', ride: '/canal-drive/', quiz: '/', canal: '/canal-drive/', data: '/data/',
  });
  assert.equal(siteLinks('dev', '/map-recall2').quiz, '/map-recall2/');
  assert.equal(siteLinks('dev', '/map-recall2/').ride, '/map-recall2/canal-drive/');
});

test('canal pages detect their layout from their own path', () => {
  assert.equal(canalPageLinks('/canal-drive/').ride, '/canal-drive/');
  assert.equal(canalPageLinks('/canal-drive/index.html').quiz, '/');
  assert.equal(canalPageLinks('/map-recall2/canal-drive/landmark-gallery.html').quiz, '/map-recall2/');
  assert.equal(canalPageLinks('/ride').quiz, '/quiz/');
  assert.equal(canalPageLinks('/ride.html').home, '/?home');
  assert.equal(canalPageLinks('/').ride, '/ride');
});

test('returning-player flag survives storage that throws', () => {
  const store = new Map<string, string>();
  markReturningPlayer({ setItem: (key, value) => { store.set(key, value); } });
  assert.equal(store.get(RETURNING_PLAYER_KEY), '1');
  assert.doesNotThrow(() => markReturningPlayer({ setItem: () => { throw new Error('blocked'); } }));
  assert.doesNotThrow(() => markReturningPlayer(undefined));
});
