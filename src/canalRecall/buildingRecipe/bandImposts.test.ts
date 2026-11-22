/**
 * Extra impost bands on single storeys (`bandImposts`, with `bands: painted`), Van Baerlestraat 34-42 (1891, 2024-12-11
 * strip): the first floor under round white tympana carries a white band at the springing line and a second at half the
 * window, the floor above only the springing band; both run the full front, cut around the openings. Also: painted bands on
 * a painted storey (`paintedStoreys`, Van Baerlestraat 32's black upper floors) stand proud of the paint, not coplanar.
 *   node --import tsx --test src/canalRecall/buildingRecipe/bandImposts.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {PAINTED, PAINTED_STOREY_DEPTH_M} from './fit.ts';

const FACE = 'baerle-32-50';
const facts = (pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/pands/${pand}/facts.json`, 'utf8'));
function house(pand: string, edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const h = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/intent.json`, 'utf8')).houses.find((x: {pandId: string}) => x.pandId === pand);
  const design = structuredClone(h.design);
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'band-imposts-test', pandId: pand, address: h.address, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-12-11'}], ...design, notes: []} as CanalHouseIntent);
}
const P42 = '0363100012156740', P32 = '0363100012162838';
const bands = (i: CanalHouseIntent, pand: string) => compileBuilding(i, facts(pand)).recipe.elevations[0].bands!.value as {id: string; bottomM: number; heightM: number; depthM: number; widthM: number}[];

test('bandImposts validation: painted bands only, a band storey, at and height in range', () => {
  assert.throws(() => house(P42, f => { f.bands = 'storey'; delete f.bandLines; delete f.bandHeights; delete f.bandTransomAt; }), /bandImposts: only with bands "painted"/);
  assert.throws(() => house(P42, f => { f.bandImposts = [{storey: 0, at: 0.5}]; }), /bandImposts\[0\]\.storey: not a band storey/);
  assert.throws(() => house(P42, f => { f.bandImposts = [{storey: 9, at: 0.5}]; }), /bandImposts\[0\]\.storey/);
  assert.throws(() => house(P42, f => { f.bandImposts = [{storey: 1, at: 0.99}]; }), /bandImposts\[0\]\.at/);
  assert.throws(() => house(P42, f => { f.bandImposts = [{storey: 1, at: 0.5, height: 0.9}]; }), /bandImposts\[0\]\.height/);
  assert.throws(() => house(P42, f => { f.bandImposts = []; }), /non-empty/);
});

test('Van Baerlestraat 42: one extra full-width band on the first floor at half its window, none on the second', () => {
  const b = bands(house(P42), P42);
  const imposts = b.filter(x => x.id.startsWith('painted-impost-'));
  assert.deepEqual(imposts.map(x => x.id), ['painted-impost-s1-0']);
  const s1 = b.filter(x => x.id.endsWith('-s1')), sill = s1.find(x => x.id === 'painted-sill-s1')!, transom = s1.find(x => x.id === 'painted-transom-s1')!;
  const im = imposts[0], mid = im.bottomM + im.heightM / 2;
  assert.ok(mid > sill.bottomM + sill.heightM && mid < transom.bottomM, `impost ${mid} between the sill band and the springing band`);
  assert.equal(im.widthM, transom.widthM, 'runs the width of the front like the other bands');
  assert.equal(im.heightM, 0.16, 'default height: the transom band height');
});

test('bandImposts absent = the same bands', () => {
  const a = bands(house(P42, f => { delete f.bandImposts; }), P42), b = bands(house(P42), P42).filter(x => !x.id.startsWith('painted-impost-'));
  assert.deepEqual(a, b);
});

test('Van Baerlestraat 32: bands on the black-painted storeys stand proud of the paint; on brick storeys at the usual depth', () => {
  const b = bands(house(P32), P32), painted = new Set(house(P32).fronts[0].paintedStoreys!.storeys);
  const lines = b.filter(x => /^painted-(sill|transom|impost)-s\d/.test(x.id));
  assert.ok(lines.length >= 6);
  for (const x of lines) {
    const s = Number(/-s(\d)/.exec(x.id)![1]);
    assert.equal(x.depthM, painted.has(s) ? PAINTED.bandDepthM + PAINTED_STOREY_DEPTH_M : PAINTED.bandDepthM, x.id);
  }
});
