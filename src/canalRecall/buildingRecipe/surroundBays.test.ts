/**
 * `surroundBays` (PC Hooftstraat 19, pand 0363100012152826, 2024-12-11 strip): the stone surround only round the
 * first-floor centre window (a white aedicule), not round every window of the storey; validation; absent = every bay.
 *   node --import tsx --test src/canalRecall/buildingRecipe/surroundBays.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from './facts.ts';
import {fitIntent} from './fit.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';

const FACE = 'hooft-13-27', PAND = '0363100012152826';
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/pands/${PAND}/facts.json`, 'utf8'));
function house(edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const h = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/intent.json`, 'utf8')).houses.find((x: {pandId: string}) => x.pandId === PAND);
  const design = structuredClone(h.design);
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'surround-test', pandId: PAND, address: h.address, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-12-11'}], ...design, notes: []} as CanalHouseIntent);
}
const dressingIds = (i: CanalHouseIntent) => (fitIntent(i, facts).recipe.elevations[0].dressings?.value ?? []).map(d => d.id);

test('surroundBays validation', () => {
  assert.throws(() => house(f => { f.surroundBays = []; }), /surroundBays/);
  assert.throws(() => house(f => { f.surroundBays = [1.5]; }), /surroundBays/);
  assert.throws(() => house(f => { f.windowSurround = undefined; }), /surroundBays: only with a windowSurround/);
});

test('surroundBays: the full frame only round the listed bay; absent = every bay of the storey, the same slabs for that bay', () => {
  const only = dressingIds(house()), all = dressingIds(house(f => { delete f.surroundBays; }));
  const ofBay = (ids: string[], b: number) => ids.filter(id => new RegExp(`-s1-b${b}$`).test(id));
  assert.ok(ofBay(only, 1).length >= 4, 'lintel, sill and two jambs on the centre window');
  assert.equal(ofBay(only, 0).length + ofBay(only, 2).length, 0);
  assert.ok(ofBay(all, 0).length >= 4 && ofBay(all, 2).length >= 4);
  assert.deepEqual(ofBay(only, 1), ofBay(all, 1));
  assert.deepEqual(only.filter(id => !/-s1-b\d$/.test(id)), all.filter(id => !/-s1-b\d$/.test(id)));
});
