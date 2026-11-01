/**
 * Museumkwartier, Cornelis Schuytbuurt (#159): the Van Breestraat 119-137 gable-balcony row resolves, compiles on two
 * of the pands it was measured on, and the kit pieces it brought behave:
 * - a step gable on part of the front keeps each riser plumb when its two x differ by an ulp (Van Breestraat 129 drew a
 *   V-notched top before);
 * - `crownShoulderRise` sets where a bell/neck flank meets the neck; absent, the stock share (byte-identical);
 * - a flat cap on a bell gable is a level coping (it threw before).
 *   node --import tsx --test src/canalRecall/blockFace/museumkwartier.test.ts
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

const TYPE = 'museum-cs-1900-gable-balcony';
const facts = (pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/bree-107-149/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(pand: string, crown?: string, extra: Record<string, unknown> = {}): CanalHouseIntent {
  const t = defaultTypeLoader(TYPE)!;
  const design = resolvePlacement(t, {type: t.id, ...(crown ? {crown} : {})}, 'Van Breestraat').design;
  design.fronts[0] = {...design.fronts[0], ...extra};
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `mk-${pand}`, pandId: `0363100012${pand}`, address: 'Van Breestraat', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-11-12'}], ...design, notes: []} as CanalHouseIntent);
}
type Built = Awaited<ReturnType<typeof compileBuilding>>;
const profile = (b: Built) => (b.recipe.elevations[0] as any).crown.value.profile as [number, number][];

test('type: three storeys, centre balconettes on storeys 1-2, the arched door left, one gable light', () => {
  const f = house('163068').fronts[0];
  assert.equal(f.storeys, 3);
  assert.deepEqual(f.storeyHeights, [4.2, 3.1, 3.1]);
  assert.deepEqual(f.balconies, {storeys: [1, 2], bays: [1], projecting: true});
  assert.equal(f.doorBay, 0);
  assert.deepEqual(f.doorArch, {span: 1.0, apex: 3.3});
  assert.equal(f.gable, 'step');
  assert.equal(f.atticWindows, 1);
  assert.equal(house('160169', 'bell-gable').fronts[0].crownShoulderRise, 0.85);
});

test('match: 1900-1901 pands only, one house per pand (5.5-6.6 m), front cornice at 10.4 m with the gable tops at 14.4 m', () => {
  const t = defaultTypeLoader(TYPE)! as unknown as MatchableType;
  const ev = (o: Partial<PandEvidence>) => ({pandId: 'x', builtYear: 1900, widthM: 6, eavesM: 14.3, roofMaxM: 14.6, storeys3dbag: 4, strip: null, ...o}) as PandEvidence;
  assert.deepEqual(scoreType(t, ev({})).veto, []);
  assert.match(scoreType(t, ev({builtYear: 1905})).veto.join(), /built 1905/);
  assert.match(scoreType(t, ev({widthM: 2.9})).veto.join(), /frontage 2.9/);
  assert.equal(t.match!.frontEavesM, 10.4);
  assert.equal(t.match!.frontSkylineM, 14.4);
  assert.equal(t.match!.measuredWall, false);
});

test('compile: Van Breestraat 129 (step) and 125 (bell) as measured; the step gable is symmetric with plumb risers', async () => {
  const step = await compileBuilding(house('163068'), facts('163068'));
  const p = profile(step);
  for (let i = 1; i < p.length; i++) assert.ok(p[i][0] >= p[i - 1][0], `x never decreases (${p[i - 1]} -> ${p[i]})`);
  const ys = p.map(q => q[1]), top = Math.max(...ys), tops = p.filter(q => q[1] === top);
  assert.equal(tops.length, 2, 'one flat top, two corners');
  const w = p.at(-1)![0], c = (tops[0][0] + tops[1][0]) / 2;
  // The crown stands over 0.18-0.82 of the front: its top centred on the front.
  assert.ok(Math.abs(c - w / 2) < 0.05, `top centred at ${c} of ${w}`);
  // Mirror symmetry: every left vertex has a right twin at the same height.
  for (const [x, y] of p) assert.ok(p.some(([x2, y2]) => Math.abs(x2 - (w - x)) < 1e-6 && Math.abs(y2 - y) < 1e-6), `vertex ${x},${y} has a mirror`);
  const bell = await compileBuilding(house('160169', 'bell-gable'), facts('160169'));
  const b = profile(bell), btop = Math.max(...b.map(q => q[1]));
  const flat = b.filter(q => Math.abs(q[1] - btop) < 1e-9);
  assert.equal(flat.length, 2, 'a flat coping (two corners at the top, no cap rise)');
});

test('crownShoulderRise: the flank meets the neck at the given share of the rise; absent keeps the stock 0.55 of a bell', async () => {
  const neckFoot = (b: Built) => { const p = profile(b), top = Math.max(...p.map(q => q[1])), xs = p.filter(q => Math.abs(q[1] - top) < 1e-9).map(q => q[0]), x0 = Math.min(...xs);
    return Math.max(...p.filter(q => Math.abs(q[0] - x0) < 1e-9 && q[1] < top).map(q => q[1])); };
  const f = facts('160169');
  const at = await compileBuilding(house('160169', 'bell-gable'), f);
  const stock = await compileBuilding(house('160169', 'bell-gable', {crownShoulderRise: undefined}), f);
  const eaves = at.fit.fronts[0].eavesM, top = Math.max(...profile(at).map(q => q[1])), rise = top - eaves;
  assert.ok(Math.abs((neckFoot(at) - eaves) / rise - 0.85) < 0.01, `flank meets the neck at ${((neckFoot(at) - eaves) / rise).toFixed(3)} of the rise`);
  assert.ok(Math.abs((neckFoot(stock) - eaves) / rise - 0.55) < 0.01, `stock bell flank at ${((neckFoot(stock) - eaves) / rise).toFixed(3)}`);
});

test('crownShoulderRise validation: neck/bell only, 0.2..0.95', () => {
  const base = house('160169', 'bell-gable');
  const bad = (front: Record<string, unknown>) => { try { validateIntent({...base, fronts: [{...base.fronts[0], ...front}]}); return ''; } catch (e) { return (e as Error).message; } };
  assert.match(bad({crownShoulderRise: 1.2}), /crownShoulderRise/);
  assert.match(bad({gable: 'step', crownCap: undefined, crownShoulder: undefined, crownNeckWidth: undefined, crownShoulderRise: 0.5, crownSteps: 3}), /crownShoulderRise/);
  assert.equal(bad({}), '');
});
