import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGS, resetLanguageForTests, setLanguage, t, type MessageKey } from '../i18n/index.ts';
import { kindLabel } from './cardKindLabel.ts';

// #290: the arrival, pause, pin and card strings added to the table have both languages.
const KEYS = Object.keys(CATALOGS.en).filter(key =>
  /^(ribbon\.|kind\.|postcard\.|card\.(wikipedia|source|more)|hud\.destination|ride\.(arrival\.header|personalBest|arrival\.neighborhoodWiki|paused|resume|pauseSummary|controlsHint))/.test(key)) as MessageKey[];

test('every #290 key has an English and a Dutch rendering, and Dutch differs where the word is not shared', () => {
  assert.ok(KEYS.length >= 30);
  const shared = new Set(['kind.museum', 'card.wikipedia', 'postcard.photo']);
  for (const key of KEYS) {
    assert.ok(CATALOGS.en[key].trim(), `${key} en`);
    assert.ok(CATALOGS.nl[key].trim(), `${key} nl`);
    if (!shared.has(key)) assert.notEqual(CATALOGS.nl[key], CATALOGS.en[key], `${key} is still English in Dutch`);
  }
});

test('the ribbon tiers and axes read as the issue asks', () => {
  assert.equal(CATALOGS.nl['ribbon.axis.aids'], 'Zonder hulp');
  assert.equal(CATALOGS.nl['ride.personalBest.new'], '★  Nieuw persoonlijk record');
  assert.equal(CATALOGS.nl['ride.arrival.header'], 'AANGEKOMEN');
  assert.equal(CATALOGS.nl['hud.destination'], 'BESTEMMING');
  assert.match(CATALOGS.nl['ribbon.bronze'], /BRONZEN/);
});

test('kindLabel follows the language and keeps an unknown kind in capitals', () => {
  resetLanguageForTests();
  setLanguage('en', { persist: false });
  assert.equal(kindLabel('music venue'), 'MUSIC VENUE');
  assert.equal(kindLabel('windmill'), 'WINDMILL');
  assert.equal(kindLabel(''), '');
  setLanguage('nl', { persist: false });
  assert.equal(kindLabel('library'), 'BIBLIOTHEEK');
  assert.equal(kindLabel('music venue'), 'MUZIEKPODIUM');
  assert.equal(kindLabel('windmill'), 'WINDMILL');
  assert.equal(t('ride.paused'), 'PAUZE');
  resetLanguageForTests();
});
