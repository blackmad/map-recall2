/**
 * Transvaalbuurt 1920-1922 rows (issue #154): the low oriel rows (transvaal-1920-three-storey, De la Reijstraat 25-42)
 * and the plain flat rows (transvaal-1921-five-storey-flat, Retiefstraat 194-268), each on two real pands; the oriel
 * stack's `topGap` (brick between the bay head and the eaves board); the match rules on those pands' evidence.
 *   node --import tsx --test src/canalRecall/blockFace/transvaal1920.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import {scoreType, type MatchableType, type PandEvidence} from './autoPlace.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(typeId: string, pand: string, street: string, o: {mirror?: boolean; topGap?: number | null} = {}): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id, ...(o.mirror ? {mirror: true} : {})}, street).design;
  if (o.topGap !== undefined) for (const f of design.fronts) if (f.bayWindows?.oriel) { if (o.topGap === null) delete f.bayWindows.oriel.topGap; else f.bayWindows.oriel.topGap = o.topGap; }
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `t-${pand}`, pandId: `0363100012${pand}`, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2020-04-29'}], ...design, notes: []} as CanalHouseIntent);
}

test('three-storey oriel row: De la Reijstraat 31A and 33A (mirrored) compile with a two-storey painted oriel', async () => {
  for (const [pand, mirror] of [['140132', false], ['098320', true]] as const) {
    const built = await compileBuilding(house('transvaal-1920-three-storey', pand, 'De la Reijstraat', {mirror}), facts('reij-25-39', pand));
    const fr = built.fit.fronts[0], e = fr.erker!;
    assert.ok(e?.oriel, `${pand}: oriel`);
    assert.deepEqual(e.oriel!.storeys, [0, 1]);
    assert.deepEqual(e.oriel!.paintedStoreys, [0, 1]);
    assert.equal(e.widthM, 2.6);
    // The stack stops 0.9 m under the eaves (topGap): brick between the bay head and the eaves board.
    const eaves = fr.storeyHeightsM!.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(eaves - 0.9 - e.topM) < 0.02, `${pand}: oriel top ${e.topM} vs eaves ${eaves}`);
    // Door pair on the narrow axis: left as drawn, right when mirrored.
    assert.equal(e.leftM + e.widthM / 2 > fr.widthM / 2, !mirror, `${pand}: bay on the ${mirror ? 'left' : 'right'}`);
  }
});

test('oriel topGap: absent runs the stack to the storey top; validation', async () => {
  const pand = '140132', f = facts('reij-25-39', pand);
  const without = await compileBuilding(house('transvaal-1920-three-storey', pand, 'De la Reijstraat', {topGap: null}), f);
  const fr = without.fit.fronts[0];
  assert.ok(Math.abs(fr.storeyHeightsM!.reduce((a, b) => a + b, 0) - fr.erker!.topM) < 0.02);
  const base = house('transvaal-1920-three-storey', pand, 'De la Reijstraat');
  const bw = base.fronts[0].bayWindows!;
  assert.throws(() => validateIntent({...base, fronts: base.fronts.map(x => ({...x, bayWindows: {...bw, oriel: {...bw.oriel!, topGap: 3}}}))} as CanalHouseIntent), /oriel.topGap/);
});

test('flat row: Retiefstraat 204 and 246 (mirrored) compile flat-roofed with the gutter overhang', async () => {
  for (const [pand, mirror] of [['066390', false], ['096769', true]] as const) {
    const i = house('transvaal-1921-five-storey-flat', pand, 'Retiefstraat', {mirror});
    assert.equal(i.fronts[0].eavesOverhang?.projection, 0.45);
    assert.equal(i.roof.form, 'flat');
    const built = await compileBuilding(i, facts('retief-194-268', pand));
    assert.equal(built.fit.fronts[0].storeyHeightsM!.length, 4);
  }
});

const ev = (o: Partial<PandEvidence>): PandEvidence => ({pandId: 'p', address: 'a', builtYear: 1921, widthM: 6, eavesM: 10.5, roofMaxM: 12, storeys3dbag: 3, groundUses: ['woonfunctie'], osm: [], ...o});
const strip = (wall: string, columns: number | null) => ({date: '2020-04-29', px: [0, 1] as [number, number], palette: {stucco: false, shares: {accent: 0.1}, bandRunsM: []} as any, wall, skyline: null, voidShare: 0, foliageShare: 0, columns, doorSide: null});

test('match: the oriel rows place on their dak70p eaves and wall; the flat type scores them under the bar (eaves, bouwlagen)', () => {
  const low = defaultTypeLoader('transvaal-1920-three-storey') as MatchableType, flat = defaultTypeLoader('transvaal-1921-five-storey-flat') as MatchableType;
  // De la Reijstraat 31A: 3DBAG front eaves under 6 m, so the evidence eaves is dak70p 10.64 m; strip wall #8b6b63, 3 columns.
  const a = scoreType(low, ev({builtYear: 1921, widthM: 5.71, eavesM: 10.64, storeys3dbag: 3, strip: strip('#8b6b63', 3)}));
  assert.ok(a.score >= 0.7, `31A ${a.score} ${JSON.stringify(a.criteria)}`);
  assert.ok(scoreType(flat, ev({builtYear: 1921, widthM: 5.71, eavesM: 10.64, storeys3dbag: 3, strip: strip('#8b6b63', 3)})).score < 0.7);
  // Retiefstraat 204: 13.0 m eaves, 5 bouwlagen.
  const b = scoreType(flat, ev({builtYear: 1921, widthM: 6.15, eavesM: 13.03, storeys3dbag: 5, strip: strip('#765b4d', null)}));
  assert.ok(b.score >= 0.7, `204 ${b.score}`);
  assert.equal(scoreType(low, ev({builtYear: 1921, widthM: 6.15, eavesM: 13.03, storeys3dbag: 5, strip: strip('#765b4d', null)})).criteria.find(c => c.key === 'storeys')?.score, 0);
  // A 1911 pand is no 1920 row.
  assert.ok(scoreType(low, ev({builtYear: 1911})).veto.length);
});

test('oriel stair block: Retiefstraat 10-14 (236977) has two canted bays either side of the stair axis, mirrored too', async () => {
  const f = facts('retief-2-28', '236977');
  for (const mirror of [false, true]) {
    const built = await compileBuilding(house('transvaal-1921-five-storey-oriel', '236977', 'Retiefstraat', {mirror}), f);
    const fr = built.fit.fronts[0], e = fr.erker!;
    assert.ok(e.oriel?.twinLeftM !== undefined, 'twin stack');
    const centres = [e.leftM, e.oriel!.twinLeftM!].map(l => l + e.widthM / 2).sort((a, b) => a - b);
    // Measured on the 2023 strip: bay centres at 6.2 and 12.45 m of the 18 m front; mirrored, 18 - those.
    const want = mirror ? [18.02 - 12.45, 18.02 - 6.2] : [6.2, 12.45];
    centres.forEach((c, k) => assert.ok(Math.abs(c - want[k]) < 0.35, `${mirror}: bay ${k} at ${c} (want ${want[k]})`));
    let twin = 0, consoles = 0;
    built.group.traverse(o => { if (/twin-erker-s[12]\/front\/glass\//.test(o.name)) twin++; if (/^oriel-console\//.test(o.name)) consoles++; });
    assert.ok(twin >= 2, 'twin glazing on storeys 1 and 2');
    assert.equal(consoles, 1, 'one console mesh holding both slabs');
  }
  const base = house('transvaal-1921-five-storey-oriel', '236977', 'Retiefstraat'), bw = base.fronts[0].bayWindows!;
  assert.throws(() => validateIntent({...base, fronts: base.fronts.map(x => ({...x, bayWindows: {...bw, oriel: {...bw.oriel!, twin: {from: 1, to: 1}}}}))} as CanalHouseIntent), /oriel.twin/);
});
