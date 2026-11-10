/**
 * Frederik Hendrikbuurt kit (2026-11-10): `windowSurround: 'dentil-lintel'` (stone teeth on the lintel), `doorPairs` + `pairTransom`
 * (one transom light over both doors) and `wideGround` (one wide ground casement over axes from..to). Each is byte-identical when
 * absent: the roof golden (roofGolden.test.ts) compiles every other buurt's faces.
 *   node --import tsx --test src/canalRecall/blockFace/frederikHendrikKit.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const FACE = 'houweningen-1-31', PAND = '158949';
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/pands/0363100012${PAND}/facts.json`, 'utf8'));
function house(edit?: (f: Record<string, unknown>) => void, placement: Record<string, unknown> = {}): CanalHouseIntent {
  const design = resolvePlacement(defaultTypeLoader('fh-1887-dentil-pediment')!, {type: 'fh-1887-dentil-pediment', ...placement} as never, 'Van Houweningenstraat').design;
  if (edit) design.fronts.forEach(edit as never);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `fh-${PAND}`, pandId: `0363100012${PAND}`, address: 'Van Houweningenstraat', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2021-02-22'}], ...design} as never);
}
const fitRecipe = (intent: CanalHouseIntent) => fitIntent(intent, facts()).recipe.elevations[0];
const fit = (edit?: (f: Record<string, unknown>) => void, placement?: Record<string, unknown>) => ({openings: fitRecipe(house(edit, placement)).openings.value});
const ids = (os: {id: string}[]) => os.map(o => o.id);

test('validation: pairTransom needs doorPairs; wideGround needs a doorBay outside its span', () => {
  const base = house();
  const front = (patch: Record<string, unknown>) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.doesNotThrow(front({}));
  assert.throws(front({doorPairs: undefined}), /pairTransom/);
  assert.throws(front({pairTransom: 'yes'}), /pairTransom/);
  assert.throws(front({wideGround: {from: 0, to: 1}}), /wideGround/);
  assert.throws(front({wideGround: {from: 2, to: 1}}), /wideGround/);
  assert.throws(front({doorBay: null}), /wideGround/);
  assert.doesNotThrow(front({wideGround: undefined}));
});

test('door pair: two leaves under ONE transom; without pairTransom each leaf has its own', () => {
  const shared = fit();
  const names = ids(shared.openings).filter(i => /^door/.test(i)).sort();
  assert.deepEqual(names, ['door', 'door-2', 'door-transom']);
  const own = ids(fit(f => { delete f.pairTransom; }).openings).filter(i => /^door/.test(i)).sort();
  assert.deepEqual(own, ['door', 'door-2', 'door-2-transom', 'door-transom']);
  const t = shared.openings.find(o => o.id === 'door-transom')!, a = shared.openings.find(o => o.id === 'door')!, b = shared.openings.find(o => o.id === 'door-2')!;
  assert.ok(Math.abs(t.leftM - a.leftM) < 0.011 && Math.abs(t.leftM + t.widthM - (b.leftM + b.widthM)) < 0.011, 'the transom spans both doors');
});

test('wide ground casement: one window over axes 1..2, none of the single ones; mirrored with the door', () => {
  const g = fit().openings.filter(o => /^s0-/.test(o.id));
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].verticalBars, [0.5]);
  const single = fit(f => { delete f.wideGround; }).openings.filter(o => /^s0-/.test(o.id));
  assert.equal(single.length, 2);
  assert.ok(g[0].widthM > single[0].widthM * 2, `${g[0].widthM} vs ${single[0].widthM}`);
  const m = fit(undefined, {mirror: true}), door = m.openings.find(o => o.id === 'door')!, wide = m.openings.find(o => /^s0-/.test(o.id))!;
  assert.ok(wide.leftM < door.leftM, 'mirrored: the casement is left of the doors');
});

test('dentil lintel: teeth stand on every window lintel; the plain stone-lintel front draws none (byte-identical when absent)', () => {
  const count = (surround: string) => {
    const intent = house(f => { f.windowSurround = surround; });
    return fitRecipe(intent).dressings?.value ?? [];
  };
  const withD = JSON.stringify(count('dentil-lintel')), without = JSON.stringify(count('stone-lintel'));
  assert.ok((withD.match(/dentil-/g) ?? []).length >= 9 * 2, 'teeth on every window');
  assert.equal((without.match(/dentil-/g) ?? []).length, 0);
});
