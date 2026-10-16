// The ARRIVED card tells the destination's published trivia (finishBlurb.ts).
//   node --import tsx --test src/canalRecall/game/finishBlurb.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFactIndex} from '../facts/factStore.ts';
import type {FactsFile} from '../facts/factTypes.ts';
import {emptyRotationState, recordShown} from '../facts/factRotation.ts';
import {finishBlurb} from './finishBlurb.ts';

const facts = buildFactIndex(JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/facts.json', 'utf8')) as FactsFile);
const BARTOLOTTI = {id: 'extract_landmarks_1450151185', detail: 'Huis Bartolotti is a canal house.', longDetail: 'Huis Bartolotti is a canal house at Herengracht 170-172.'};

test('named regression: Huis Bartolotti arrives with a published fact, not the bare lede (user report 2026-10-16)', () => {
  const blurb = finishBlurb(BARTOLOTTI, facts, emptyRotationState(), 'fallback');
  assert.ok(blurb.choice, 'a fact was chosen from the rotation');
  assert.notEqual(blurb.text, BARTOLOTTI.longDetail);
  assert.ok(blurb.text.includes(blurb.choice!.fact.text), blurb.text);
});

test('the rotation moves on: a committed fact is not told again on the next arrival', () => {
  const first = finishBlurb(BARTOLOTTI, facts, emptyRotationState(), 'fallback');
  const next = finishBlurb(BARTOLOTTI, facts, recordShown(emptyRotationState(), first.choice!), 'fallback');
  assert.notEqual(next.choice?.fact.text, first.choice?.fact.text);
});

test('no facts: the lede, then the fallback, and nothing to commit', () => {
  assert.deepEqual(finishBlurb({id: 'nowhere', longDetail: 'A lede.'}, facts, emptyRotationState(), 'fallback'), {text: 'A lede.', choice: null});
  assert.deepEqual(finishBlurb({id: 'nowhere'}, new Map(), emptyRotationState(), 'fallback'), {text: 'fallback', choice: null});
});
