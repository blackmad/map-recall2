/**
 * Indische Buurt kit components (Makassarpleinbuurt 1925-26 perimeter blocks, 2026-10-17):
 *  - `storeyWindowWidths`: a storey's windows keep their axes and take a measured width (Molukkenstraat 25, 088701: three
 *    0.66 m attic lights over three ~1.1 m windows);
 *  - `paintedStoreys.from`: the paint starts over the storey floor (Gorontalostraat 31, 094616: the white top storey from
 *    its window sills, brick below);
 * validation, geometry against the fit, and byte-identical output without the keys.
 *   node --import tsx --test src/canalRecall/buildingRecipe/indischeBuurt.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from './facts.ts';
import {fitIntent} from './fit.ts';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import {resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';

const factsOf = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/${pand}/facts.json`, 'utf8'));

function house(typeId: string, pand: string, street: string, patch: (f: Record<string, unknown>) => void = () => {}): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id}, street).design;
  for (const f of design.fronts) patch(f as unknown as Record<string, unknown>);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `test-${pand.slice(-6)}`, pandId: pand, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2023-01-02'}], ...design} as CanalHouseIntent);
}

const MOL = '0363100012088701', GOR = '0363100012094616';

test('validation: storeyWindowWidths keys, range and the storeys it may not share; paintedStoreys.from range', () => {
  const base = house('indisch-1926-attic-lights', MOL, 'Molukkenstraat');
  const front = (patch: Record<string, unknown>) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.throws(front({storeyWindowWidths: {'7': 0.6}}), /storeyWindowWidths.7: key must be a storey index/);
  assert.throws(front({storeyWindowWidths: {'4': 0.1}}), /storeyWindowWidths.4: a window width in metres/);
  assert.throws(front({storeyWindowWidths: {'4': 0.6}, storeyBayWidths: {'4': [1, 1, 1]}}), /storeyWindowWidths.4: only on the shared axes/);
  assert.doesNotThrow(front({storeyWindowWidths: {last: 0.6}}));
  const white = house('indisch-1926-white-attic', GOR, 'Gorontalostraat');
  const wf = (patch: Record<string, unknown>) => () => validateIntent({...white, fronts: white.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.throws(wf({paintedStoreys: {storeys: [3], colour: '#e8eae4', from: 3}}), /paintedStoreys.from/);
  assert.throws(wf({paintedStoreys: {storeys: [3], colour: '#e8eae4', at: 1}}), /paintedStoreys: \{storeys, colour, from\?\}/);
});

test('Molukkenstraat 25: attic lights 0.66 m wide on the body axes, the body windows unchanged', () => {
  const facts = factsOf('molukken-7-29', MOL);
  const fitted = fitIntent(house('indisch-1926-attic-lights', MOL, 'Molukkenstraat'), facts);
  const plain = fitIntent(house('indisch-1926-attic-lights', MOL, 'Molukkenstraat', f => { delete f.storeyWindowWidths; }), facts);
  const ops = fitted.recipe.elevations[0].openings.value, ref = plain.recipe.elevations[0].openings.value;
  const attic = ops.filter(o => /^s4-b\d$/.test(o.id)), atticRef = ref.filter(o => /^s4-b\d$/.test(o.id)), body = ops.filter(o => /^s3-b\d$/.test(o.id));
  assert.equal(attic.length, 3);
  for (const [k, o] of attic.entries()) {
    assert.equal(o.widthM, 0.66);
    // Same axis centre as without the key and as the window below.
    assert.ok(Math.abs(o.leftM + o.widthM / 2 - (atticRef[k].leftM + atticRef[k].widthM / 2)) < 1e-9);
    assert.ok(Math.abs(o.leftM + o.widthM / 2 - (body[k].leftM + body[k].widthM / 2)) < 1e-9);
  }
  assert.ok(body[0].widthM > 1, `body windows ${body[0].widthM}`);
  // Everything but the attic lights is as without the key.
  assert.deepEqual(ops.filter(o => !/^s4-/.test(o.id)), ref.filter(o => !/^s4-/.test(o.id)));
});

test('dormerSize: Gorontalostraat 31 dormer sill 1.0 m over the eaves, 1.4 m tall, front 1.6 m up the slope; validation; absent = style default', () => {
  const facts = factsOf('gorontalo-25-47', GOR);
  const dormers = (i: CanalHouseIntent) => fitIntent(i, facts).recipe.elevations[0].dormers!.value;
  const sized = dormers(house('indisch-1926-white-attic', GOR, 'Gorontalostraat'));
  const plain = dormers(house('indisch-1926-white-attic', GOR, 'Gorontalostraat', f => { delete f.dormerSize; }));
  assert.equal(sized.length, 1);
  assert.ok(Math.abs(sized[0].bottomM - plain[0].bottomM - 0.95) < 1e-9, `sill ${sized[0].bottomM} vs default ${plain[0].bottomM}`);
  assert.equal(sized[0].heightM, 1.4);
  assert.equal(sized[0].setbackM, 1.6);
  // The flat style's own default: 1.8 m tall, 0.35 m back.
  assert.equal(plain[0].heightM, 1.8);
  assert.equal(plain[0].setbackM, 0.35);
  const base = house('indisch-1926-white-attic', GOR, 'Gorontalostraat');
  const front = (patch: Record<string, unknown>) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.throws(front({dormerSize: {sill: 3, rise: 1.4, setback: 1.6}}), /dormerSize: \{sill 0.05..2/);
  assert.throws(front({dormerSize: {sill: 1, rise: 1.4}}), /dormerSize/);
  assert.throws(front({dormers: 0, dormerSize: {sill: 1, rise: 1.4, setback: 1}}), /dormerSize: only with dormers/);
});

test('Gorontalostraat 31: the white top storey starts 0.44 m over its floor; without `from` it starts on the floor', () => {
  const facts = factsOf('gorontalo-25-47', GOR);
  const band = (i: CanalHouseIntent) => fitIntent(i, facts).recipe.elevations[0].bands!.value.find(b => b.id === 'painted-storey-s3')!;
  const lifted = band(house('indisch-1926-white-attic', GOR, 'Gorontalostraat'));
  const floor = band(house('indisch-1926-white-attic', GOR, 'Gorontalostraat', f => { f.paintedStoreys = {storeys: [3], colour: '#e8eae4'}; }));
  assert.ok(Math.abs(lifted.bottomM - floor.bottomM - 0.44) < 0.002, `${lifted.bottomM} vs ${floor.bottomM}`);
  assert.ok(Math.abs(lifted.bottomM + lifted.heightM - (floor.bottomM + floor.heightM)) < 0.002, 'same top');
});
