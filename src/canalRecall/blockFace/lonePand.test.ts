/**
 * The lone-pand opt-in (autoPlace.ts `TypeMatchRule.lonePand`, `lonePandReason`, `placedRuns`; #156): a placed pand
 * that is a run of one stands as a one-house face when its type opts in and its BAG frontage is 5 m or more. Replayed
 * on the round-3 auto-place records (fixtures/lone-pand-round3-records.json) of two Bellamy faces (no type opts in: the same runs and holds as before) and two
 * Transvaalbuurt faces (Transvaalstraat 3-47: 37 at 5.11 m released, 29 at 4.98 m still held; Retiefstraat 45-75: 57
 * and 61 at 5.95 m released, the 69C-73A run unchanged).
 *   node --import tsx --test src/canalRecall/blockFace/lonePand.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lonePandReason, placedRuns, runIntent, type Decision, type MatchableType} from './autoPlace.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import {validateBlockFace} from './intent.ts';

interface Rec { pandId: string; address: string; widthM: number; status: string; stage?: string; type?: string; placementType?: string; bestType?: string }
// The round-3 records (before the opt-in): the live auto-place.json files now carry its placements.
const FIXTURE = JSON.parse(fs.readFileSync(new URL('./fixtures/lone-pand-round3-records.json', import.meta.url), 'utf8'));
const records = (face: string): Rec[] => FIXTURE.faces[face];
const load = (id: string) => defaultTypeLoader(id) as MatchableType;

/** The face's decisions before the run rule: placed pands and pands the run rule held are placed (with `typeId`), the rest held. */
function decisions(face: string, fallbackType: string): {ds: Decision[]; width: Map<string, number>} {
  const width = new Map<string, number>();
  const ds = records(face).map((r): Decision => {
    width.set(r.pandId, r.widthM);
    if (r.status === 'placed' || r.stage === 'run') {
      const typeId = r.type ?? r.placementType ?? r.bestType ?? fallbackType;
      return {kind: 'placed', pandId: r.pandId, typeId, score: 1, notes: [], house: {pandId: r.pandId, slug: `x-${r.pandId.slice(-6)}`, address: r.address, type: {type: typeId}, groundFloor: {use: 'residential', photoDate: '2023-01-02', agreement: 'bag-only'}, rhythm: {} as never}};
    }
    return {kind: 'held', pandId: r.pandId, address: r.address, stage: (r.stage ?? 'match') as 'match', reason: 'x'};
  });
  return {ds, width};
}
const runsOf = (face: string, fallbackType: string, withRule: boolean) => {
  const {ds, width} = decisions(face, fallbackType);
  const r = placedRuns(ds, withRule ? p => lonePandReason(load(p.typeId), width.get(p.pandId)) : undefined);
  return {runs: r.runs.map(run => run.map(p => p.house.address)), orphans: r.orphans.map(o => o.address)};
};

test('the four Transvaalbuurt stair-block types opt in at 5 m; no Bellamy type does', () => {
  for (const id of ['transvaal-1911-five-storey', 'transvaal-1911-five-storey-tall', 'transvaal-1923-portiek', 'transvaal-1923-portiek-tower']) assert.deepEqual(load(id).match?.lonePand, {minWidthM: 5}, id);
  for (const id of ['bellamy-1904-balcony-axis', 'bellamy-1915-green-tile', 'bellamy-1915-tile-bay', 'bellamy-1916-two-axis', 'bellamy-1895-plain-three-axis', 'bellamy-1937-flat-row']) assert.equal(load(id).match?.lonePand, undefined, id);
  const t = load('transvaal-1911-five-storey');
  assert.equal(lonePandReason(t, 4.98), null, 'under 5 m keeps the rule');
  assert.match(lonePandReason(t, 5.11)!, /stair block on its own/);
  assert.equal(lonePandReason(load('bellamy-1904-balcony-axis'), 6.86), null);
  assert.equal(lonePandReason(undefined, 6), null);
});

test('Bellamy records: the rule changes nothing (Hasebroekstraat 1-41, Bellamystraat 113-121)', () => {
  for (const [face, type] of [['hasebroek-1-41', 'bellamy-1904-balcony-axis'], ['bellamy-113-121', 'bellamy-1904-balcony-axis']] as const) {
    const before = runsOf(face, type, false), after = runsOf(face, type, true);
    assert.deepEqual(after, before, face);
    assert.ok(before.orphans.length >= 1, `${face}: has a lone pand to keep held`);
  }
  // Hasebroekstraat 27 and 33 (5.39, 5.47 m) are lone placed pands of the 1904 type: still held.
  assert.ok(runsOf('hasebroek-1-41', 'bellamy-1904-balcony-axis', true).orphans.includes('Hasebroekstraat 27'));
});

test('Transvaalbuurt records: stair blocks of 5 m or more stand alone, narrower ones stay held', () => {
  const tv = runsOf('transvaal-3-47', 'transvaal-1911-five-storey-tall', true);
  assert.deepEqual(runsOf('transvaal-3-47', 'transvaal-1911-five-storey-tall', false).orphans, ['Transvaalstraat 29', 'Transvaalstraat 37']);
  assert.deepEqual(tv.orphans, ['Transvaalstraat 29'], '29 is 4.98 m');
  assert.deepEqual(tv.runs, [['Transvaalstraat 37']]);
  const rt = runsOf('retief-45-75', 'transvaal-1911-five-storey', true);
  assert.deepEqual(runsOf('retief-45-75', 'transvaal-1911-five-storey', false).orphans, ['Retiefstraat 57', 'Retiefstraat 61']);
  assert.deepEqual(rt.orphans, []);
  assert.deepEqual(rt.runs, [['Retiefstraat 57'], ['Retiefstraat 61'], ['Retiefstraat 69C', 'Retiefstraat 71D', 'Retiefstraat 73A']], 'the installed run is unchanged');
});

test('a lone run is a valid one-house face with its reason; a one-house face without it is not', () => {
  const {ds, width} = decisions('retief-45-75', 'transvaal-1911-five-storey');
  const {runs} = placedRuns(ds, p => lonePandReason(load(p.typeId), width.get(p.pandId)));
  const lone = runs[0];
  assert.equal(lone.length, 1);
  assert.match(lone[0].notes.join(), /lone pand: a stair block on its own/);
  const type = load('transvaal-1911-five-storey');
  lone[0].house.rhythm = {citation: 'test'} as never;
  const intent = runIntent({id: 'retief-lone', street: 'Retiefstraat', stripDate: '2023-01-02', stripImage: 'x.jpg', types: [type.id], run: lone, note: 'test'});
  assert.match(intent.continuity.lonePand!.evidence, /opts in to one-house faces from 5 m/);
  validateBlockFace(JSON.parse(JSON.stringify(intent)), lone.map(p => p.pandId));
  const two = runIntent({id: 'retief-run', street: 'Retiefstraat', stripDate: '2023-01-02', stripImage: 'x.jpg', types: [type.id], run: runs[2], note: 'test'});
  assert.equal(two.continuity.lonePand, undefined, 'a run of two or more carries no lonePand (byte-identical)');
  const bad = JSON.parse(JSON.stringify(intent)); delete bad.continuity.lonePand;
  assert.throws(() => validateBlockFace(bad), /at least two houses/);
});
