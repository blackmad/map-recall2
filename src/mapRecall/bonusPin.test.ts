import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StreetFeature } from '../types';
import type { HintReference } from './locateHints';
import { bonusPoints, pickBonusTarget } from './bonusPin';

const street = { id: 's', name: 'Van Baerlestraat', type: 'street', cityId: 'amsterdam', center: [52.357, 4.879], path: [[52.354, 4.877], [52.360, 4.881]], difficulty: 'medium', clues: [], distractors: [], funFact: '' } as StreetFeature;
const ref = (name: string, kind: HintReference['kind'], fame: number, center: [number, number]): HintReference => ({ name, kind, fame, center });

test('the most famous nearby landmark the hints did not name', () => {
  const references = [
    ref('Concertgebouw', 'landmark', 40, [52.3563, 4.8790]),
    ref('Rijksmuseum', 'landmark', 90, [52.3600, 4.8852]), // ~280 m from the line
    ref('Amstel', 'water', 99, [52.357, 4.879]),
    ref('Far Museum', 'landmark', 200, [52.38, 4.90]),
  ];
  assert.equal(pickBonusTarget({ feature: street, references })?.name, 'Rijksmuseum');
  const target = pickBonusTarget({ feature: street, references, hintNames: ['Rijksmuseum'] })!;
  assert.equal(target.name, 'Concertgebouw');
  assert.equal(target.label, 'the Concertgebouw');
});

test("an area asks about its own best-known place, skipping those shown as clues", () => {
  const area = { ...street, type: 'neighborhood', name: 'Museumkwartier', notablePlaces: [
    { name: 'Vondelpark', center: [52.358, 4.868], kind: 'park' },
    { name: 'Concertgebouw', center: [52.356, 4.879], kind: 'music venue' },
  ] } as StreetFeature;
  // Parks are named by the reveal's label tiles, so the first non-park place.
  assert.equal(pickBonusTarget({ feature: area, references: [] })?.label, 'the Concertgebouw');
  assert.equal(pickBonusTarget({ feature: area, references: [], shownBeforeAnswer: ['Concertgebouw'] }), null);
  assert.equal(pickBonusTarget({ feature: street, references: [ref('Rembrandtpark', 'park', 99, [52.357, 4.879])] }), null);
});

test('never a place that names the answer, and nothing when nothing is near', () => {
  assert.equal(pickBonusTarget({ feature: street, references: [ref('Van Baerle Huis', 'landmark', 50, [52.357, 4.879])] }), null);
  assert.equal(pickBonusTarget({ feature: street, references: [] }), null);
});

test('bonus points: 500 close, linear to 0 at 800 m', () => {
  assert.equal(bonusPoints(10), 500);
  assert.equal(bonusPoints(420), 250);
  assert.equal(bonusPoints(800), 0);
  assert.equal(bonusPoints(5000), 0);
  assert.equal(bonusPoints(Number.NaN), 0);
});
