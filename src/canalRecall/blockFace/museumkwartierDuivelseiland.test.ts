/**
 * Museumkwartier, Duivelseiland 1899-1900 corbel-cornice rows (#160): the four variants resolve and compile on the pands
 * they were measured on (Cornelis Anthoniszstraat 64 and 62, Balthasar Floriszstraat 22), the kit's corbel table hangs
 * from the entablature cap, and a front without it is unchanged.
 *   node --import tsx --test src/canalRecall/blockFace/museumkwartierDuivelseiland.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {corbelTableBlocks, corbelTableHeight, corbelTableProblems} from '../buildingRecipe/corbelTable.ts';
import {resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import {scoreType, type MatchableType, type PandEvidence} from './autoPlace.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(typeId: string, pand: string, street: string, strip = (f: any) => f): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id}, street).design;
  return validateIntent(strip({schemaVersion: 1, kind: 'canal-house', id: `mk-${pand}`, pandId: `0363100012${pand}`, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-12-11'}], ...design, notes: []}) as CanalHouseIntent);
}
type Built = Awaited<ReturnType<typeof compileBuilding>>;
const elevation = (b: Built) => b.recipe.elevations[0];
const VARIANTS = ['museum-de-1899-corbel-cornice', 'museum-de-1899-corbel-flat', 'museum-de-1899-corbel-flat-plain'];

test('the variants share the storey lines, entablature, corbel table and crown; they differ only in heads and balconettes', () => {
  const [arched, flat, plain] = VARIANTS.map(id => house(id, '159040', 'Cornelis Anthoniszstraat').fronts[0]);
  for (const f of [arched, flat, plain]) {
    assert.equal(f.storeys, 4);
    assert.deepEqual(f.storeyHeights, [3.3, 3.0, 2.95, 2.85]);
    assert.deepEqual(f.corbelTable, {courses: 2, rows: 2, pitch: 0.3, blockCourses: 3});
    assert.equal(f.entablature?.rise, 1.3);
    assert.equal(f.dormerStyle, 'pediment');
  }
  assert.equal(arched.windowHead?.kind, 'segmental');
  assert.equal(flat.windowHead, undefined);
  assert.deepEqual(flat.balconies, arched.balconies);
  assert.equal(plain.balconies, undefined);
});

test('match: years 1898-1901 with no slack, the cornice line 13.4 m and the roof-face skyline 14.7 m', () => {
  const t = defaultTypeLoader('museum-de-1899-corbel-cornice')! as unknown as MatchableType;
  const ev = (year: number, sky: number | null): PandEvidence => ({pandId: 'x', address: 'x', builtYear: year, widthM: 5.4, eavesM: 15.7, roofMaxM: 16.3, storeys3dbag: 5, groundUses: [], osm: [],
    ...(sky === null ? {} : {strip: {skyline: {eavesM: sky, confidence: 0.9, crown: null}, voidShare: 0, foliageShare: 0, columns: 3, palette: {stucco: false, bandRunsM: [], shares: {}}} as any})});
  assert.deepEqual(scoreType(t, ev(1905, null)).veto, ['built 1905, type 1898-1901']);
  const eaves = (s: number) => scoreType(t, ev(1899, s)).criteria.find(c => c.key === 'eaves')!.score;
  assert.equal(eaves(14.7), 1);
  assert.equal(eaves(13.4), 1);
  assert.equal(eaves(17.7), 0);
});

test('compile: Cornelis Anthoniszstraat 64 (arched) and 62 (flat), Balthasar Floriszstraat 22 (plain); the corbel table sits under the cap', async () => {
  for (const [id, face, pand, street] of [[VARIANTS[0], 'anthonisz-40-72', '159040', 'Cornelis Anthoniszstraat'], [VARIANTS[1], 'anthonisz-40-72', '160204', 'Cornelis Anthoniszstraat'], [VARIANTS[2], 'florisz-12-38', '164388', 'Balthasar Floriszstraat']]) {
    const b = await compileBuilding(house(id, pand, street), facts(face, pand));
    const e = elevation(b), bands = e.bands!.value, corbels = bands.filter(x => x.id.startsWith('corbel-'));
    assert.ok(corbels.length > 10, `${pand}: ${corbels.length} corbel blocks`);
    const course = corbels.find(x => x.id === 'corbel-course')!, cornice = e.cornice!.value;
    assert.ok(Math.abs(course.bottomM + course.heightM - (cornice.bottomM + cornice.heightM - 0.5)) < 0.002, `${pand}: course top on the cap foot`);
    assert.ok(corbels.every(x => x.surface === 'accent' && x.leftM >= 0 && x.leftM + x.widthM <= b.fit.fronts[0].widthM + 1e-9));
    const heads = e.openings.value.filter(o => /^s1-b\d$/.test(o.id));
    assert.equal(heads.length, 3);
  }
});

test('corbel table: absent is byte-identical, blocks stay on the front, rows stagger, problems name missing parts', async () => {
  const with_ = house(VARIANTS[1], '160204', 'Cornelis Anthoniszstraat');
  const without = house(VARIANTS[1], '160204', 'Cornelis Anthoniszstraat', f => ({...f, fronts: f.fronts.map((x: any) => { const {corbelTable, ...rest} = x; return rest; })}));
  const a = await compileBuilding(with_, facts('anthonisz-40-72', '160204')), b = await compileBuilding(without, facts('anthonisz-40-72', '160204'));
  const strip = (r: Built) => JSON.stringify({...r.recipe, elevations: r.recipe.elevations.map(e => ({...e, bands: e.bands && {...e.bands, value: e.bands.value.filter(x => !x.id.startsWith('corbel-'))}}))});
  assert.equal(strip(a), strip(b));
  assert.equal(elevation(b).bands!.value.filter(x => x.id.startsWith('corbel-')).length, 0);
  const c = {courses: 2, rows: 2, pitch: 0.3, blockCourses: 3};
  assert.equal(corbelTableHeight(c), 0.44);
  const blocks = corbelTableBlocks(c, 5.4371, 12.9);
  assert.ok(blocks.every(x => x.leftM + x.widthM <= 5.437 + 1e-9), 'no block past the right end');
  const r0 = blocks.filter(x => x.id.startsWith('corbel-r0-')), r1 = blocks.filter(x => x.id.startsWith('corbel-r1-'));
  assert.ok(r1[0].leftM > r0[0].leftM + 0.1, 'odd rows shifted half a pitch');
  assert.ok(Math.abs(r0[0].bottomM - (12.9 - 0.11 - 0.165)) < 0.002);
  assert.deepEqual(corbelTableProblems({cornice: 'none', corbelTable: c} as any, 'f', undefined), ['f.corbelTable: needs a cornice (it hangs from the cornice foot)', 'f.corbelTable: needs palette.band (the frieze brick)']);
  assert.match(corbelTableProblems({cornice: 'simple', corbelTable: {...c, pitch: 2}} as any, 'f', '#8a5a42')[0], /pitch/);
});
