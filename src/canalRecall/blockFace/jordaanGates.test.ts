/**
 * Jordaan compile gates (2026-11-10, docs/reports/jordaan-gates-20261110.md):
 *  - storey-height: the gable types' storey weights, scaled to a 3DBAG eaves of 7.5 m (the lowest the type matches), keep
 *    every upper storey at the gate's 2.3 m (the old 3.4/2.7/2.6 weights drew 2.2 m at 7.55 m: Rozengracht 38, Bloemgracht
 *    16-32 173350, Nieuwe Leliestraat 169849);
 *  - the neck gable's storey pitch is the one measured on the fronts (2.8 m), so 3DBAG eaves of 7.5-9.3 m read three
 *    storeys and 10-11.5 m four, not the 3.33 m pitch that put a 10 m front at three storeys of 3.3 m;
 *  - RoofIntent.squareSaddle takes true or nothing (the roof depth axis square to the frontage chord under a gable crown).
 *   node --import tsx --test src/canalRecall/blockFace/jordaanGates.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storeyPitch, storeysFor, type MatchableType} from './autoPlace.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import {resizePerStorey} from './houseType.ts';
import {validateIntent} from '../buildingRecipe/intent.ts';

const GATE_MIN_UPPER_M = 2.3;
const TYPES = ['jordaan-1750-neck-gable', 'jordaan-1900-gable-rebuild'];

for (const id of TYPES) {
  test(`${id}: upper storeys stay >= 2.3 m at the lowest matched eaves, for every storey count it draws`, () => {
    const t = defaultTypeLoader(id) as MatchableType & {body: {storeyHeights: number[]; storeys: number; bays: number}};
    for (const [storeys, eaves] of [[3, 7.5], [4, 9.6]] as const) {
      const heights = resizePerStorey({...t.body, bays: 3}, t.body.storeys, storeys).storeyHeights!;
      const sum = heights.reduce((a, b) => a + b, 0);
      const fitted = heights.map(h => h * eaves / sum);
      assert.ok(fitted.slice(1).every(h => h >= GATE_MIN_UPPER_M), `${storeys} storeys at ${eaves} m: ${fitted.map(h => h.toFixed(2)).join('/')}`);
    }
  });
}

test('jordaan-1750-neck-gable: the storey pitch is 2.8 m; 8 m reads three storeys, 11 m four', () => {
  const t = defaultTypeLoader('jordaan-1750-neck-gable') as MatchableType;
  assert.ok(Math.abs(storeyPitch(t) - 2.8) < 0.01, `pitch ${storeyPitch(t)}`);
  assert.equal(storeysFor(t, 8.0), 3);
  assert.equal(storeysFor(t, 11.0), 4);
});

test('roof.squareSaddle: true or nothing; the gable types set it', () => {
  const base = {schemaVersion: 1, kind: 'canal-house', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2023-01-02'}], id: 'sq-test', pandId: '0363100012174650', fronts: [{id: 'front0', street: 'Bloemstraat', basement: 'none', cornice: 'none', hoist: false, gable: 'neck', storeys: 3, bays: 3, doorBay: 0, windows: 't-window'}], palette: {brick: '#6a4a3e', frame: 'white', door: '#3a2a24', stone: 'cream'}};
  assert.doesNotThrow(() => validateIntent({...base, roof: {material: 'red-tile', squareSaddle: true}}));
  assert.throws(() => validateIntent({...base, roof: {material: 'red-tile', squareSaddle: 1}}), /squareSaddle/);
  for (const id of TYPES) assert.equal((defaultTypeLoader(id) as unknown as {roof: {squareSaddle?: boolean}}).roof.squareSaddle, true, id);
});
