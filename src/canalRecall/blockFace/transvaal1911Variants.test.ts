/**
 * Transvaalbuurt 1908-1914 kit variants (#156), named regressions on the 2023-01-02 strips:
 *  - Retiefstraat 71D-73A (129491, 067013): a low SHOULDERED gable (plumb sides 1.4 m over the eaves, 1.05 m rake rise)
 *    over the two axes away from the door, the mirrored pair meeting in a valley on the party wall;
 *  - Transvaalstraat 42-44 (140529, 071217): ONE gable centred on the party wall, drawn as a pair crown (`crownHalf`);
 *  - Transvaalstraat 39-45A (093192 ... 140329): white timber dormers whose window sits in their own front wall, clear
 *    of the roof plane and the facade top (round 3: GLB audit opening-outside, 2.5 m2 over 3 parts);
 *  - pair-crown reviewer pins set the halves and their sides; a half without its partner is held.
 * Absent fields stay byte-identical (roof-golden, the installed-face recompiles: see the lane report).
 *   node --import tsx --test src/canalRecall/blockFace/transvaal1911Variants.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {fitIntent, halfCrown, shoulderedProfile} from '../buildingRecipe/fit.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {openingsWithinWalls} from '../landmarks/geometryAudit.ts';
import {loadMaterialSoup} from '../../../scripts/landmarks/material-soup.ts';
import {mirrorFront, resolvePlacement, type HousePlacement} from './houseType.ts';
import {defaultTypeLoader, fileTypeLoader} from './typeLibrary.ts';
import {validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {compileBlockFace} from './compile.ts';
import {applyCrownPins, crownPinProblems, holdBrokenPairs, type CrownPin} from './reviewCrowns.ts';
import type {Decision} from './autoPlace.ts';

const LOW = 'transvaal-1911-five-storey', TALL = 'transvaal-1911-five-storey-tall';
const factsOf = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(typeId: string, pand: string, place: Partial<HousePlacement> = {}, street = 'Retiefstraat'): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id, ...place}, street).design;
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `t-${pand}`, pandId: `0363100012${pand}`, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2023-01-02'}], ...design, notes: []} as CanalHouseIntent);
}
const crownOf = (h: CanalHouseIntent, f: BuildingFacts) => {
  const fit = fitIntent(h, f), el = fit.recipe.elevations[0];
  return {profile: el.crown!.value.profile, eaves: fit.report.fronts[0].eavesM, width: fit.report.fronts[0].widthM, el};
};
/** A run face of `pands` (last 6 digits) of a committed face, each with `place`, compiled in memory. */
function runFace(src: string, id: string, typeId: string, pands: string[], place: (p: string) => Partial<HousePlacement>, street: string): {face: BlockFaceIntent; facts: Map<string, BuildingFacts>} {
  const dir = `scripts/block-face/faces/${src}`, members: string[] = JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members;
  const ids = pands.map(p => members.find(m => m.endsWith(p))!);
  const raw = {schemaVersion: 1, kind: 'block-face', id, street, sources: [{id: 'strip-2023-01-02', kind: 'street-panorama', capturedAt: '2023-01-02', image: `staging/block-face/${src}/strip.jpg`}], types: [typeId],
    houses: ids.map(pid => ({pandId: pid, slug: `t-${pid.slice(-6)}`, address: pid, type: {type: typeId, ...place(pid.slice(-6))}, groundFloor: {use: 'residential', photoDate: '2023-01-02', agreement: 'bag-only'}, rhythm: {citation: 'test'}})),
    continuity: {streetLevel: 'shared', corniceGroups: [], identical: [], partyClip: true, roof: {source: 'recipe', pitchDeg: 30, evidence: 'test'}}};
  const face = validateBlockFace(raw, ids, fileTypeLoader());
  return {face, facts: new Map(ids.map(pid => [pid, JSON.parse(fs.readFileSync(`${dir}/pands/${pid}/facts.json`, 'utf8'))]))};
}
async function withinWalls(glb: Uint8Array) {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tv1911-')), 'chunk.glb');
  fs.writeFileSync(tmp, glb);
  return openingsWithinWalls(await loadMaterialSoup(tmp));
}

test('outlines: a shouldered gable rises plumb, then rakes to a point; the halves of a crown meet at its apex', () => {
  assert.deepEqual(shoulderedProfile(4, 13, {shoulder: 1.4, rise: 1}), [[0, 13], [0, 14.4], [2, 15.4], [4, 14.4], [4, 13]]);
  assert.deepEqual(shoulderedProfile(4, 13, {shoulder: 1, rise: 1, flatTop: 1}), [[0, 13], [0, 14], [1.5, 15], [2.5, 15], [4, 14], [4, 13]]);
  const full = shoulderedProfile(8, 13, {shoulder: 1.2, rise: 2.9});
  const r3 = (ps: number[][]) => ps.map(p => p.map(v => Math.round(v * 1000) / 1000));
  const left = halfCrown(full, 'left'), right = halfCrown(full, 'right');
  assert.deepEqual(r3(left), [[0, 13], [0, 14.2], [4, 17.1]]);
  assert.deepEqual(r3(right), [[0, 17.1], [4, 14.2], [4, 13]]);
  // A flat top is cut on its centre line.
  assert.deepEqual(halfCrown(shoulderedProfile(4, 13, {shoulder: 1, rise: 1, flatTop: 1}), 'left').at(-1), [2, 15]);
});

test('Retiefstraat 71D-73A: the shouldered gable stands on the far two axes at the measured shoulder and rise, mirrored with the door', async () => {
  const f71 = factsOf('retief-45-75-r1', '129491');
  for (const [typeId, mirror] of [[LOW, false], [LOW, true], [TALL, true]] as const) {
    const h = house(typeId, '129491', {crown: 'shouldered-gable', ...(mirror ? {mirror} : {})});
    assert.equal(h.fronts[0].gable, 'shouldered');
    const {profile, eaves, width} = crownOf(h, f71);
    const top = Math.max(...profile.map(p => p[1]));
    assert.ok(Math.abs(top - (eaves + 2.45)) < 0.01, `top ${top} = eaves ${eaves} + 1.4 + 1.05`);
    // The plumb side on the door side of the gable: two vertices at one x, the foot (eaves) before the shoulder.
    const xs = profile.map(p => p[0]), sideX = mirror ? width * 0.68 : width * 0.32;
    const k = xs.findIndex(x => Math.abs(x - sideX) < 0.02);
    assert.ok(k >= 0, `a vertex at the gable side ${sideX.toFixed(2)} (${JSON.stringify(profile)})`);
    assert.ok(Math.abs(profile[k + 1][0] - profile[k][0]) < 1e-6, 'plumb side');
    assert.ok(profile[k + 1][1] > profile[k][1] === !mirror, `${mirror ? 'mirrored: the head precedes the foot on the right side' : 'the foot precedes the head on the left side'}`);
    // x never decreases along the outline (the wall top is single-valued, risers aside).
    for (let i = 1; i < profile.length; i++) assert.ok(profile[i][0] >= profile[i - 1][0] - 1e-9);
    const built = await compileBuilding(h, f71);
    assert.ok(built.group.children.length > 0);
  }
});

test('Retiefstraat 71D-73A run face: gates, party line and openings within walls pass with the pair of shouldered gables', async () => {
  const {face, facts} = runFace('retief-45-75-r1', 'retief-shoulder-test', LOW, ['129491', '067013'], p => ({crown: 'shouldered-gable', ...(p === '067013' ? {} : {mirror: true})}), 'Retiefstraat');
  const r = await compileBlockFace(face, facts, 'face-retief-shoulder-test', {});
  assert.deepEqual(r.gates.filter(g => !g.pass).map(g => `${g.pand}/${g.id}`), []);
  assert.ok(r.interference.every(i => i.pass), JSON.stringify(r.interference));
  const w = await withinWalls(r.chunk.glb);
  assert.equal(w.failing.length, 0, JSON.stringify(w.failing.map(f => [f.materials, f.outsideM2])));
});

test('Transvaalstraat 42-44: one gable over both fronts, the halves meeting at the apex on the party wall', async () => {
  const l = house(LOW, '140529', {crown: 'shared-gable', pair: 'left'}, 'Transvaalstraat'), r = house(LOW, '071217', {crown: 'shared-gable', pair: 'right', mirror: true}, 'Transvaalstraat');
  assert.equal(l.fronts[0].crownHalf, 'left'); assert.equal(r.fronts[0].crownHalf, 'right');
  assert.deepEqual(mirrorFront(r.fronts[0]).crownAt, l.fronts[0].crownAt);
  const a = crownOf(l, factsOf('transvaal-42-48', '140529')), b = crownOf(r, factsOf('transvaal-42-48', '071217'));
  const aTop = a.profile.at(-1)!, bTop = b.profile[0];
  assert.ok(Math.abs(aTop[0] - a.width) < 0.01 && Math.abs(bTop[0]) < 1e-6, `apex on the party wall (${aTop[0]} of ${a.width}, ${bTop[0]})`);
  assert.ok(Math.abs(aTop[1] - (a.eaves + 4.1)) < 0.01 && Math.abs(bTop[1] - (b.eaves + 4.1)) < 0.01, `apex ${aTop[1]} / ${bTop[1]} over eaves ${a.eaves} / ${b.eaves}`);
  const {face, facts} = runFace('transvaal-42-48', 'transvaal-pair-test', LOW, ['140529', '071217'], p => p === '140529' ? {crown: 'shared-gable', pair: 'left'} : {crown: 'shared-gable', pair: 'right', mirror: true}, 'Transvaalstraat');
  const c = await compileBlockFace(face, facts, 'face-transvaal-pair-test', {});
  assert.deepEqual(c.gates.filter(g => !g.pass).map(g => `${g.pand}/${g.id}`), []);
  assert.ok(c.interference.every(i => i.pass), JSON.stringify(c.interference));
  const w = await withinWalls(c.chunk.glb);
  assert.equal(w.failing.length, 0, JSON.stringify(w.failing.map(f => [f.materials, f.outsideM2])));
});

test('Transvaalstraat 39-45A: timber dormers hold their window in their own front wall; the GLB audit finds no opening outside', async () => {
  const f39 = factsOf('transvaal-3-47', '093192');
  const d = crownOf(house(TALL, '093192', {crown: 'flat-dormer'}, 'Transvaalstraat'), f39).el.dormers!.value[0];
  assert.equal(d.wallSurface, 'stone');
  assert.equal(d.frontWall?.apronM, 0.35);
  assert.ok(d.frontWall!.sideM >= 0.12 && d.frontWall!.sideM <= 0.35);
  // The type's pointed dormer is timber now; a stone dormer elsewhere keeps its fully glazed front.
  assert.ok(crownOf(house(TALL, '093192', {crown: 'dormer'}, 'Transvaalstraat'), f39).el.dormers!.value[0].frontWall);
  for (const crown of ['flat-dormer', 'dormer']) {
    const {face, facts} = runFace('transvaal-3-47', `transvaal-dormer-${crown}`, TALL, ['093192', '146296', '096110', '140329'], () => ({crown}), 'Transvaalstraat');
    const c = await compileBlockFace(face, facts, `face-transvaal-dormer-${crown}`, {});
    assert.deepEqual(c.gates.filter(g => !g.pass).map(g => `${g.pand}/${g.id}`), []);
    const w = await withinWalls(c.chunk.glb);
    assert.equal(w.failing.length, 0, `${crown}: ${JSON.stringify(w.failing.map(f => [f.materials, f.outsideM2, f.min, f.max]))}`);
  }
});

test('pair-crown pins: the halves and sides come from the pin; a half without its partner is held', () => {
  const types = [defaultTypeLoader(LOW)!];
  const pins: CrownPin[] = [{pandId: '0363100012140529', type: LOW, crown: 'shared-gable', pair: 'left', reason: 'test'}, {pandId: '0363100012071217', type: LOW, crown: 'shared-gable', pair: 'right', reason: 'test'}];
  assert.deepEqual(crownPinProblems(pins, types), []);
  assert.match(crownPinProblems([{...pins[0], pair: undefined}], types).join(), /give pair left or right/);
  assert.match(crownPinProblems([{...pins[0], crown: 'point-gable'}], types).join(), /not a pair crown/);
  const placed = (id: string, notes: string[] = ['door unread']): Decision => ({kind: 'placed', pandId: `0363100012${id}`, typeId: LOW, score: 1, notes, house: {pandId: `0363100012${id}`, slug: id, address: id, type: {type: LOW, mirror: true}, groundFloor: {use: 'residential', photoDate: '2023-01-02', agreement: 'bag-only'}, rhythm: {} as never}});
  const ds = [placed('140529'), placed('071217')];
  assert.deepEqual(applyCrownPins('transvaal-42-48', ds, pins, types).length, 2);
  const [a, b] = ds as Extract<Decision, {kind: 'placed'}>[];
  assert.deepEqual([a.house.type!.pair, a.house.type!.mirror, b.house.type!.pair, b.house.type!.mirror], ['left', undefined, 'right', true]);
  assert.ok(a.notes.some(n => /^door reviewer pin: left half/.test(n)) && !a.notes.includes('door unread'));
  assert.deepEqual(holdBrokenPairs(ds), []);
  const lone = [ds[0], {kind: 'held', pandId: 'x', address: 'x', stage: 'likeness', reason: 'x'} as Decision];
  assert.deepEqual(holdBrokenPairs(lone), ['0363100012140529']);
  assert.match((lone[0] as Extract<Decision, {kind: 'held'}>).reason, /left half of a pair crown/);
});

test('validation: shouldered needs its outline, crownHalf a gabled crown ending on the party wall', () => {
  const h = house(LOW, '140529', {crown: 'shared-gable', pair: 'left'}, 'Transvaalstraat');
  const bad = (edit: (f: CanalHouseIntent['fronts'][number]) => void) => () => { const x = structuredClone(h); edit(x.fronts[0]); validateIntent(x); };
  assert.throws(bad(f => { delete f.shouldered; }), /shouldered gable needs/);
  assert.throws(bad(f => { f.shouldered = {shoulder: 5, rise: 1}; }), /shoulder: 0.1..3/);
  assert.throws(bad(f => { f.crownAt = {from: 0.3, to: 0.9}; }), /ends on the right party wall/);
  assert.throws(bad(f => { f.gable = 'cornice'; delete f.shouldered; }), /crownHalf: only on a gabled crown/);
  assert.throws(bad(f => { f.gable = 'point'; }), /shouldered: only with gable "shouldered"/);
});
