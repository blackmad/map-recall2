import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateIntent} from './intent.ts';
import {compileBuilding, resolveIntent, canonicalIntentKey} from './compile.ts';
import {roofFidelity} from './roofChecks.ts';
import type {BuildingFacts} from './facts.ts';
import * as T from 'three';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const intent = (id: string) => resolveIntent(raw(id), raw);

test('intent schema rejects coordinates, unknown components and the unbuilt large tier', () => {
  const base = raw('bloemgracht-80');
  assert.equal(validateIntent(base).id, 'bloemgracht-80');
  assert.throws(() => validateIntent({...base, fronts: [{...base.fronts[0], widthM: 5.7}]}), /coordinate\/metric field/);
  assert.throws(() => validateIntent({...base, fronts: [{...base.fronts[0], gable: 'baroque'}]}), /gable/);
  assert.throws(() => validateIntent({...base, fronts: [{...base.fronts[0], doorBay: 7}]}), /doorBay/);
  assert.throws(() => validateIntent({...base, kind: 'large'}), /planned but not implemented/);
});

test('sameAs recipes inherit the neighbour and keep their own identity; equal designs share a key', () => {
  const twin = intent('bloemgracht-84');
  assert.equal(twin.pandId, '0363100012169914');
  assert.equal(twin.fronts[0].gable, 'cornice');
  assert.equal(canonicalIntentKey(twin), canonicalIntentKey(intent('bloemgracht-80')));
  assert.notEqual(canonicalIntentKey(intent('bloemgracht-86')), canonicalIntentKey(intent('bloemgracht-80')));
  const variant = resolveIntent({sameAs: 'bloemgracht-80', id: 'x-1', pandId: '0363100012169914', address: 'x', sources: twin.sources, overrides: {fronts: [{storeys: 4}], palette: {door: 'dark-red'}}}, raw);
  assert.equal(variant.fronts[0].storeys, 4);
  assert.equal(variant.fronts[0].bays, 3);
  assert.equal(variant.palette.door, 'dark-red');
});

// Named regression: Bloemgracht 78–90, the seven-owner row held on the
// canalhouse branch for "uniform taupe masses and tall rear ridges dominate crowns".
const ROW = ['bloemgracht-78', 'bloemgracht-80', 'bloemgracht-82', 'bloemgracht-84', 'bloemgracht-86', 'bloemgracht-88', 'bloemgracht-90'];
for (const id of ROW) test(`Bloemgracht 78–90 roof fidelity: ${id}`, () => {
  const f = facts(id), built = compileBuilding(intent(id), f);
  const front = built.fit.fronts[0], gabled = !['cornice', 'flat'].includes(intent(id).fronts[0].gable);
  const r = roofFidelity(built.group, f, built.anchorRD, gabled ? front.crownTopM : front.eavesM);
  // Roof volume is the 3DBAG LoD2.2 planes themselves: no generated masses.
  assert(r.maxPlaneErrorM < 0.1, `roof deviates ${r.maxPlaneErrorM.toFixed(3)} m from 3DBAG planes`);
  assert(Math.abs(r.coverage - 1) < 0.01, `roof covers ${r.coverage.toFixed(3)} of the footprint`);
  // Not one uniform mass: steep / low / flat classes are coloured apart when present.
  const classes = Object.values(built.roofClasses).filter(n => n > 0).length;
  assert(r.roofColours >= classes, `${r.roofColours} colours for ${classes} slope classes`);
  let wall = '';
  built.group.traverse(o => { if (o instanceof T.Mesh && o.name === 'shell/0') wall = (o.material as T.MeshStandardMaterial).color.getHexString(); });
  built.group.traverse(o => { if (o instanceof T.Mesh && o.name.startsWith('roof/') && !o.name.startsWith('roof/step-wall')) assert.notEqual((o.material as T.MeshStandardMaterial).color.getHexString(), wall); });
  // Gabled crowns are not overtopped by roof within 2.5 m behind the front.
  if (gabled) assert(r.nearRoofOverCrownM <= 0, `${id}: roof rises ${r.nearRoofOverCrownM.toFixed(2)} m above the crown near the front`);
});

test('Bloemgracht 86 neck gable: front roof closure above the crown becomes roof verge, not masonry', () => {
  const built = compileBuilding(intent('bloemgracht-86'), facts('bloemgracht-86'));
  assert(built.vergeTriangles > 0, 'neck gable needs a verge where the 3DBAG roof triangle passes the shoulders');
});
