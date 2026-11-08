import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANDMARK_NAMES_NL, landmarkDisplayName } from './landmarkNamesNl.ts';

const landmarks = JSON.parse(readFileSync(new URL('../../../public/data/extracts/amsterdam/landmarks.json', import.meta.url), 'utf8')) as Array<{ name: string; wikipedia?: string }>;

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
