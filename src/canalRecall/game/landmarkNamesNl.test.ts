import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANDMARK_NAMES_NL, LANDMARK_NAMES_NL_WIKIDATA, landmarkDisplayName, placeName } from './landmarkNamesNl.ts';
import { resetLanguageForTests, setLanguage } from '../../i18n/index.ts';

const landmarks = JSON.parse(readFileSync(new URL('../../../public/data/extracts/amsterdam/landmarks.json', import.meta.url), 'utf8')) as Array<{ name: string; wikipedia?: string; wikidata?: string }>;

test('every Dutch name is the linked nl Wikipedia title of a catalogue landmark', () => {
  for (const [en, nl] of Object.entries(LANDMARK_NAMES_NL)) {
    const landmark = landmarks.find(item => item.name === en);
    assert.ok(landmark, `${en} is in landmarks.json`);
    assert.match(landmark.wikipedia ?? '', /^nl:/, `${en} links a Dutch article`);
    const words = (s: string) => s.toLowerCase().replace(/ \([^)]*\)$/, '').replace(/[^a-zà-ü]+/g, ' ').split(' ').filter(w => w.length > 3);
    const title = new Set(words(landmark.wikipedia!.slice(3)));
    assert.ok(words(nl).some(w => title.has(w)), `${nl} shares a word with ${landmark.wikipedia}`);
  }
});

test('display name follows the UI language', () => {
  assert.equal(landmarkDisplayName('Anne Frank House', 'nl'), 'Anne Frank Huis');
  assert.equal(landmarkDisplayName('Anne Frank House', 'en'), 'Anne Frank House');
  assert.equal(landmarkDisplayName('Portugese Synagoge', 'nl'), 'Portugese Synagoge');
});

test('Wikidata-sourced Dutch names belong to the landmark they name', () => {
  for (const [en, { nl, wikidata }] of Object.entries(LANDMARK_NAMES_NL_WIKIDATA)) {
    const landmark = landmarks.find(item => item.name === en);
    assert.ok(landmark, `${en} is in landmarks.json`);
    assert.equal(landmark.wikidata, wikidata, `${en} is ${wikidata}`);
    assert.ok(!(en in LANDMARK_NAMES_NL), `${en} has one Dutch name`);
    assert.notEqual(nl, en);
  }
});

test('the game spelling of a renamed landmark finds its Dutch name (R2-3)', () => {
  // placeNames.ts shows "The National Maritime Museum" as "National Maritime Museum".
  assert.equal(landmarkDisplayName('National Maritime Museum', 'nl'), 'Het Scheepvaartmuseum');
  assert.equal(landmarkDisplayName('National Maritime Museum', 'en'), 'National Maritime Museum');
});

test('ride C names read Dutch in the Dutch game (R2-3, #303)', () => {
  resetLanguageForTests();
  setLanguage('nl', { persist: false });
  assert.equal(placeName('Mint Tower'), 'Munttoren');
  assert.equal(placeName('New Church'), 'Nieuwe Kerk');
  assert.equal(placeName('Pathé Tuschinski Cinema'), 'Koninklijk Theater Tuschinski');
  assert.equal(placeName('Houseboat Museum'), 'Woonbootmuseum');
  assert.equal(placeName('Singel'), 'Singel');
  assert.equal(placeName(''), '');
  setLanguage('en', { persist: false });
  assert.equal(placeName('Mint Tower'), 'Mint Tower');
  resetLanguageForTests();
});
