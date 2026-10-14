/**
 * Amsterdam School component set (plan "Commercial streets", step 6), on the synthetic face `_demo-school`
 * (De Clercqstraat pands with invented intents, not installed). Named regressions:
 *  - rigid canopy: one slab per `continuity.canopy` group, cut per pand at the party plane (153066..236681 and 156454+156960);
 *  - ladder windows: 236681 pairs per bay, 0.55-0.75 m lights with 4-6 bars;
 *  - multi-bay erker: 236681 (bays 1-2, flat cap) and 236262 module m1 (bays 0-1, hip cap);
 *  - brick course banding: 157618 (`courseStoreys` [0, 3], no shop) and the raised courses on every upper storey;
 *  - corner tower: 153066 (De Clercqstraat x Bilderdijkkade, shared corner vertex, stepped cap) and
 *    116526 (De Clercqstraat x Nassaukade, ~2 m chamfer, pyramid cap).
 *   node --import tsx --test src/canalRecall/blockFace/amsterdamSchool.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {ladderBars, LADDER} from '../buildingRecipe/fit.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {houseIntents, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {compileBlockFace, type StripScale} from './compile.ts';

const DIR = 'scripts/block-face/faces/_demo-school';
const raw = JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8'));
const members: string[] = JSON.parse(fs.readFileSync(`${DIR}/discovery.json`, 'utf8')).members;
const face: BlockFaceIntent = validateBlockFace(raw, members);
const facts = new Map<string, BuildingFacts>(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(`${DIR}/pands/${h.pandId}/facts.json`, 'utf8'))]));
const s = JSON.parse(fs.readFileSync(`${DIR}/strip.json`, 'utf8')), strip: StripScale = {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP};
const intents = houseIntents(face);
const intentOf = (pand: string) => intents.find(i => i.pandId.endsWith(pand))!;
let compiled: Promise<Awaited<ReturnType<typeof compileBlockFace>>> | undefined;
const result = () => (compiled ??= compileBlockFace(face, facts, 'face-demo-school-test', {strip, inferRears: false}));
/** One house as the face builds it: the face's ground plan (shared street level, canopy group heights) in its facts. */
const house = async (pand: string) => {
  const r = await result(), i = face.houses.findIndex(h => h.pandId.endsWith(pand));
  const b = compileBuilding(intentOf(pand), r.ground.facts[i]);
  b.group.updateMatrixWorld(true);
  return b;
};
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };
const bbox = (m: T.Mesh) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox!; };
const patched = (pand: string, front: number, patch: Record<string, unknown>, house: Record<string, unknown> = {}) => {
  const i = structuredClone(intentOf(pand)) as unknown as Record<string, any>;
  Object.assign(i.fronts[front], patch); Object.assign(i, house);
  return i;
};

test('intent schema: the five components validate, and their misuse is rejected', () => {
  for (const i of intents) validateIntent(i);
  // Rigid canopy: a fascia colour only on a rigid canopy.
  const sf = intentOf('158603').fronts[0].shopfront!;
  assert.throws(() => validateIntent(patched('158603', 0, {shopfront: {...sf, awning: {...sf.awning!, style: 'fabric-straight'}}})), /fasciaColour: only a rigid canopy/);
  // Multi-bay erker: bay|bays, axes on the grid, consecutive storeys, cap.
  const bw = intentOf('236681').fronts[0].bayWindows!;
  assert.throws(() => validateIntent(patched('236681', 0, {bayWindows: {...bw, bay: 1}})), /bay and bays are alternatives/);
  assert.throws(() => validateIntent(patched('236681', 0, {bayWindows: {...bw, bays: {from: 2, to: 4}}})), /bays: \{from, to\} bay axes within 0\.\.3/);
  assert.throws(() => validateIntent(patched('236681', 0, {bayWindows: {...bw, storeys: [1, 3]}})), /consecutive storeys/);
  assert.throws(() => validateIntent(patched('236681', 0, {bayWindows: {...bw, cap: 'dome'}})), /bayWindows\.cap/);
  // Brick courses: need a band brick, ascending storeys, never the shop storey.
  assert.throws(() => validateIntent(patched('157618', 0, {}, {palette: {...intentOf('157618').palette, band: undefined}})), /give palette\.band/);
  assert.throws(() => validateIntent(patched('157618', 0, {courseStoreys: [3, 1]})), /ascending storey indices/);
  assert.throws(() => validateIntent(patched('236681', 0, {bands: 'courses', courseStoreys: [0]})), /ground storey holds a shop/);
  assert.throws(() => validateIntent(patched('158603', 0, {bands: 'storey', courseStoreys: [1]})), /only with bands "courses"/);
  // Ladder is a window type.
  validateIntent(patched('157618', 0, {windows: 'ladder'}));
  // Corner tower: corner|bays, one per pand, needs two fronts.
  const tw = intentOf('116526').fronts[0].tower!;
  assert.throws(() => validateIntent(patched('116526', 0, {tower: {...tw, bays: {from: 0, to: 0}}})), /corner and bays are alternatives/);
  assert.throws(() => validateIntent(patched('116526', 1, {tower: tw})), /one corner tower per pand/);
  const single = patched('116526', 0, {}); single.fronts = single.fronts.slice(0, 1);
  assert.throws(() => validateIntent(single), /needs a pand with two fronts/);
  assert.throws(() => validateIntent(patched('116526', 0, {tower: {...tw, cap: 'onion'}})), /tower\.cap/);
});

test('continuity.canopy: neighbours in street order, each with a rigid canopy, evidence, at most one group', () => {
  const bad = (canopy: unknown) => { const f = structuredClone(raw); f.continuity.canopy = canopy; return () => validateBlockFace(f, members); };
  const p = (x: string) => face.houses.find(h => h.pandId.endsWith(x))!.pandId;
  assert.throws(bad([{pands: [p('153066')], evidence: 'x'}]), /joins two or more pands/);
  assert.throws(bad([{pands: [p('153066'), p('158603')], evidence: 'x'}]), /neighbours in street order/);
  assert.throws(bad([{pands: [p('236681'), p('157618')], evidence: 'x'}]), /157618 has no rigid canopy/);
  assert.throws(bad([{pands: [p('156454'), p('156960')]}]), /needs evidence/);
  assert.throws(bad([{pands: [p('156454'), p('156960')], evidence: 'x'}, {pands: [p('156960'), p('116526')], evidence: 'x'}]), /in two canopy groups/);
});

test('rigid canopy: one datum per group, joined at the party plane, slab + fascia per pand, no interference', async () => {
  const r = await result();
  assert.deepEqual(r.interference.filter(x => !x.pass), [], 'no gap, z-fight or overhang between neighbours, canopy joins included');
  const at = (pand: string) => r.ground.facts[face.houses.findIndex(h => h.pandId.endsWith(pand))].canopyM;
  const run = ['153066', '236262', '158603', '159182', '236681'];
  const datums = new Set(run.flatMap(p => Object.values(at(p)!).map(c => c.bottomM)));
  assert.equal(datums.size, 1, 'one canopy height for the whole group');
  assert.deepEqual(at('153066')!.front0, {...at('153066')!.front0, joinLeft: false, joinRight: true}, 'free at the corner, joined to 236262');
  assert.ok(Object.values(at('236262')!).every(c => c.joinLeft && c.joinRight), 'the three modules of 236262 join each other and both neighbours');
  assert.equal(at('236681')!.front0.joinRight, false, 'the group ends at 236681 (157618 has no shop)');
  assert.equal(at('157618'), undefined);
  assert.equal(at('116526'), undefined, 'a rigid canopy outside every group keeps its own height and free ends');
  for (const pand of ['158603', '116526']) {
    const b = await house(pand), c = b.fit.fronts[0].canopy!;
    const [slab] = meshes(b.group, /^canopy\/front0\/slab$/), [fascia] = meshes(b.group, /^canopy\/front0\/fascia$/);
    assert.ok(slab && fascia, `${pand}: slab and fascia meshes`);
    assert.equal(slab.userData.pandId, intentOf(pand).pandId, 'each slab belongs to its own pand (pandRanges)');
    const sb = bbox(slab), fb = bbox(fascia);
    assert.ok(Math.abs(sb.max.z - (1.2 - 0.06)) < 1e-3 && Math.abs(fb.max.z - 1.2) < 1e-3, `${pand}: 1.2 m deep, fascia on the nose`);
    assert.ok(Math.abs(sb.max.y - sb.min.y - 0.16) < 1e-3 && Math.abs(fb.max.y - fb.min.y - 0.3) < 1e-3, `${pand}: 0.16 m slab, 0.3 m fascia`);
    assert.ok(Math.abs(fb.max.y - sb.max.y) < 1e-3, `${pand}: fascia flush with the slab top`);
    if (pand === '158603') assert.ok(c.partyStart && c.partyEnd && c.leftM === 0, '158603: both ends run to the party planes');
    else assert.ok(!c.partyStart && !c.partyEnd && c.leftM > 0, '116526: free ends stop short of the corners');
  }
});

test('ladder windows (236681): paired per bay, 0.55-0.75 m wide, 4-6 horizontal bars', async () => {
  for (const [h, n] of [[1.6, 4], [2.2, 4], [2.5, 5], [2.9, 6], [3.6, 6]] as const) assert.equal(ladderBars(h).length, n, `${h} m`);
  const b = await house('236681'), windows = b.recipe.elevations[0].openings.value.filter(o => /^s\d+-b\d+[ab]$/.test(o.id));
  assert.ok(windows.length >= 8);
  for (const o of windows) {
    assert.ok(o.widthM >= LADDER.minM - 1e-9 && o.widthM <= LADDER.maxM + 1e-9, `${o.id} width ${o.widthM}`);
    assert.ok(o.horizontalBars!.length >= 4 && o.horizontalBars!.length <= 6, `${o.id} bars`);
    assert.ok(o.heightM > 2.5 * o.widthM, `${o.id}: tall and narrow`);
  }
  for (const a of windows.filter(o => o.id.endsWith('a'))) {
    const pair = windows.find(o => o.id === a.id.slice(0, -1) + 'b')!;
    assert.ok(pair, `${a.id} has its pair`);
    assert.ok(Math.abs(Math.abs(pair.leftM - a.leftM) - (a.widthM + LADDER.pierM)) < 0.002, `${a.id}: 0.16 m pier between the pair`);
  }
});

test('multi-bay erker: one 0.55 m stack per span, stallriser per storey, cap on top, no windows behind it', async () => {
  for (const [pand, front, cap, surface] of [['236681', 'front0', 'flat', 'trim'], ['236262', 'm1', 'hip', 'roof']] as const) {
    const b = await house(pand), report = b.fit.fronts.find(f => f.id === front)!, e = report.erker!;
    const elevation = b.recipe.elevations.find(x => x.id === front)!;
    const stack = elevation.glazedBays!.value.filter(g => g.id.includes('erker-s'));
    assert.equal(stack.length, 2, `${pand}: a module on each of storeys 1 and 2`);
    for (const g of stack) {
      assert.equal(g.depthM, 0.55);
      assert.equal(g.lowerPanelM, 0.85, 'solid stallriser panel under each storey');
      assert.ok(Math.abs(g.leftM! - stack[0].leftM!) < 1e-9 && g.widthM === stack[0].widthM, 'one stack, one span');
    }
    assert.equal(e.cap, cap);
    const [capMesh] = meshes(b.group, new RegExp(`^erker-cap/${front}$`));
    assert.ok(capMesh, `${pand}: ${cap} cap mesh`);
    assert.equal(capMesh.userData.surface, surface);
    assert.ok(bbox(capMesh).min.y >= e.topM - 1e-3, 'the cap sits on the top of the stack');
    const behind = elevation.openings.value.filter(o => /^(m1-)?s[12]-b/.test(o.id) && o.leftM + o.widthM / 2 > e.leftM && o.leftM + o.widthM / 2 < e.leftM + e.widthM);
    assert.deepEqual(behind.map(o => o.id), [], 'no ordinary window inside the erker span');
  }
});

test('brick course banding (157618): whole storeys in band brick, 2-3 raised courses over every upper storey', async () => {
  const b = await house('157618'), bands = b.recipe.elevations[0].bands!.value;
  const whole = bands.filter(x => x.id.startsWith('course-band-s'));
  assert.deepEqual(whole.map(x => x.id), ['course-band-s0', 'course-band-s3']);
  assert.ok(whole.every(x => x.depthM === 0.04 && x.surface === 'accent'));
  const raised = bands.filter(x => /^course-s\d+-\d$/.test(x.id));
  const storeys = new Set(raised.map(x => x.id.split('-')[1]));
  assert.deepEqual([...storeys].sort(), ['s1', 's2', 's3']);
  for (const st of storeys) { const n = raised.filter(x => x.id.split('-')[1] === st).length; assert.ok(n >= 2 && n <= 3, `${st}: ${n} courses`); }
  assert.ok(raised.every(x => x.heightM === 0.05 && x.depthM === 0.07));
});

test('corner tower: square plan from the two fronts, body over both fronts\' ends, one top, capped', async () => {
  for (const [pand, points, cap] of [['153066', 4, 'stepped'], ['116526', 5, 'pyramid']] as const) {
    const b = await house(pand), towers = b.fit.fronts.flatMap(f => (f.towers ?? []).map(t => ({front: f.id, ...t})));
    const owner = towers.find(t => t.corner?.role === 'owner')!, partner = towers.find(t => t.corner?.role === 'partner')!;
    assert.ok(owner && partner && owner.front !== partner.front, `${pand}: the tower spans both fronts`);
    assert.equal(owner.topM, partner.topM, 'one shared top');
    assert.equal(owner.cap, cap);
    assert.equal(owner.corner!.plan!.length, points, points === 4 ? 'shared corner vertex: four sides' : 'chamfered corner: square with the chamfer cut');
    const plan = owner.corner!.plan!, side = (k: number) => Math.hypot(plan[(k + 1) % plan.length][0] - plan[k][0], plan[(k + 1) % plan.length][1] - plan[k][1]);
    for (const k of owner.corner!.walls!) assert.ok(side(k) >= 2.39 || points === 5, `${pand}: inner wall ${k} is a full tower side`);
    if (points === 4) assert.ok(Math.abs(side(0) - side(1)) < 0.01 && Math.abs(side(1) - side(2)) < 0.01, 'equal sides along both fronts (a rhombus where the corner is oblique)');
    assert.ok(meshes(b.group, /^tower\/.*-corner\/body$/).length === 1, 'one tower body');
    assert.ok(meshes(b.group, /^tower\/.*-corner\//).length >= 2, 'body + cap');
    assert.ok(owner.topM > b.fit.fronts[0].eavesM + 0.9, 'the tower rises over the eaves');
  }
});

test('absent components touch nothing: a face house without them builds no Amsterdam School mesh', async () => {
  const plain = structuredClone(intentOf('157618')) as CanalHouseIntent;
  plain.fronts[0].bands = 'storey'; delete plain.fronts[0].courseStoreys;
  const b = compileBuilding(validateIntent(plain), facts.get(intentOf('157618').pandId)!);
  assert.equal(meshes(b.group, /^(canopy|erker-cap|tower\/.*-corner)/).length, 0);
});
