// The ARRIVED card tells the destination's published trivia (finishBlurb.ts).
//   node --import tsx --test src/canalRecall/game/finishBlurb.test.ts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFactIndex} from '../facts/factStore.ts';
import type {FactsFile} from '../facts/factTypes.ts';
import {emptyRotationState, recordShown} from '../facts/factRotation.ts';
import {buurtFinishBlurb, finishBlurb} from './finishBlurb.ts';
import {DAILY_POOL_CUTOVER, dailyPoolPair} from './dailyRide.ts';

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

test('a daily-ride buurt finish tells the neighbourhood postcard text, never a nearby landmark (#279)', () => {
  const hoods = [
    { name: 'Jordaan', wikipediaExtract: ' The Jordaan is a neighbourhood of Amsterdam. ' },
    { name: 'Rijnbuurt', wikipediaExtract: '' },
  ];
  assert.deepEqual(buurtFinishBlurb({ name: 'Jordaan', buurtPlace: true }, hoods), { name: 'Jordaan', text: 'The Jordaan is a neighbourhood of Amsterdam.' });
  // No postcard text: an empty blurb, not the nearest landmark.
  assert.deepEqual(buurtFinishBlurb({ name: 'Rijnbuurt', buurtPlace: true }, hoods), { name: 'Rijnbuurt', text: '' });
  // A landmark finish keeps the landmark blurb.
  assert.equal(buurtFinishBlurb({ name: 'Jordaan' }, hoods), null);
  assert.equal(buurtFinishBlurb(null, hoods), null);
});

test('every daily pool place is marked a buurt place', () => {
  const pair = dailyPoolPair(DAILY_POOL_CUTOVER)!;
  assert.equal((pair.to as { buurtPlace?: boolean }).buurtPlace, true);
});

test('Dutch game: the arrival tells the Dutch lede where the article kept one, never an English fact over it (#307)', async () => {
  const { resetLanguageForTests, setLanguage } = await import('../../i18n/index.ts');
  const { buildLandmarks, landmarkLede } = await import('./landmarkData.ts');
  const features = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8')) as Array<Parameters<typeof landmarkLede>[0] & { id: string; name: string; center?: [number, number] }>;
  // Named: Uilenburger Synagoge, Dutch original lede and Dutch facts; Portugese Synagoge (ride C), no Dutch text at all.
  const uilenburg = features.find(f => f.id === 'extract_landmarks_452804039')!;
  const portuguese = features.find(f => f.id === 'extract_landmarks_1311905515')!;
  assert.equal(landmarkLede(uilenburg, 'en').lang, 'en');
  assert.deepEqual(landmarkLede(uilenburg, 'nl'), { text: uilenburg.wikipediaExtractOriginal!.trim(), lang: 'nl' });
  assert.equal(landmarkLede(portuguese, 'nl').lang, 'en', 'no Dutch original: the English lede stands, untranslated');
  resetLanguageForTests();
  setLanguage('nl', { persist: false });
  try {
    const [lm] = buildLandmarks([uilenburg as never], () => ({ x: 0, y: 0 }));
    assert.equal(lm.extractLang, 'nl');
    assert.match(lm.longDetail, /^De Uilenburger Synagoge/);
    // A landmark with only English facts keeps its Dutch lede on arrival.
    const englishOnly = new Map([[lm.id, { id: lm.id, opening: 'An opening.', facts: [{ text: 'An English fact.', kind: 'history' }] }]]) as never;
    assert.deepEqual(finishBlurb(lm, englishOnly, emptyRotationState(), 'fallback'), { text: lm.longDetail, choice: null });
    // A Dutch fact still wins over the lede.
    const dutch = finishBlurb(lm, facts, emptyRotationState(), 'fallback');
    assert.ok(dutch.choice?.fact.textNl && dutch.text.includes(dutch.choice.fact.textNl), dutch.text);
  } finally {
    setLanguage('en', { persist: false });
    resetLanguageForTests();
  }
  const [english] = buildLandmarks([uilenburg as never], () => ({ x: 0, y: 0 }));
  assert.equal(english.extractLang, 'en');
  assert.match(english.longDetail, /^The Uilenburger Synagoge/);
});
