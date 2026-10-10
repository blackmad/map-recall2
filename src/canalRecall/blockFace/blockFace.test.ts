/**
 * Block-face authoring: schema, ground/cornice planning, sign lettering on every mount, discovery helpers, and the
 * named regression Bilderdijkstraat 122-134 (the per-house recipes had 4 upper storeys on the 1902-03
 * row where the strip shows 3 + gable; 155417's cornice sits ~0.6-0.9 m below its neighbours).
 *   node --import tsx --test src/canalRecall/blockFace/blockFace.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import * as T from 'three';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent} from '../buildingRecipe/intent.ts';
import {compileBlockFace, planFaceGround, zFightArea} from './compile.ts';
import {sharedEdgeLength} from './discover.ts';
import {houseIntents, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {planStrip} from './strip.ts';

const FACE = 'scripts/block-face/faces/bilder-081118-155417';
const load = (): BlockFaceIntent => JSON.parse(fs.readFileSync(path.join(FACE, 'intent.json'), 'utf8'));
const order = (): string[] => JSON.parse(fs.readFileSync(path.join(FACE, 'discovery.json'), 'utf8')).members;
const facts = (face: BlockFaceIntent) => new Map(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(path.join(FACE, 'pands', h.pandId, 'facts.json'), 'utf8')) as BuildingFacts]));

test('Bilderdijkstraat face intent validates in street order and resolves sameAs', () => {
  const face = validateBlockFace(load(), order());
  const intents = houseIntents(face);
  assert.equal(intents.length, 7);
  const twin = intents.find(i => i.pandId.endsWith('155418'))!, master = intents.find(i => i.pandId.endsWith('156287'))!;
  assert.equal(twin.fronts[0].storeys, master.fronts[0].storeys);
  assert.equal(twin.fronts[0].doorBay, 0); assert.equal(master.fronts[0].doorBay, 2);
  assert.equal(twin.fronts[0].shopfront?.sign ?? null, null);
});

test('face validation catches use/shopfront contradictions, foreign pands, missing rhythm and wrong order', () => {
  const bad = load();
  bad.houses[0].groundFloor.use = 'residential';
  delete (bad.houses[1].rhythm as any).citation;
  bad.continuity.corniceGroups.push({pands: ['0363100012999999'], evidence: 'x'});
  assert.throws(() => validateBlockFace(bad), /residential ground floor must not have a shopfront[\s\S]*rhythm.citation[\s\S]*not on this face/);
  assert.throws(() => validateBlockFace(load(), [...order()].reverse()), /street order/);
});

test('cornice groups from the intent snap when 3DBAG agrees and are reported when it does not', () => {
  const face = load(), f = face.houses.map(h => facts(face).get(h.pandId)!);
  const plan = planFaceGround(face, f);
  const g1903 = plan.groups.find(g => g.pands.includes('0363100012156287'))!;
  assert.ok(g1903.snapped && g1903.spreadM < 0.2);
  assert.ok(!g1903.pands.includes('0363100012155417'), '155417 is its own cornice line on the photo');
  // Forcing 155417 into the 1903 group: 0.63 m spread still snaps (<= 0.8) and the eaves gate catches it (see compile test).
  const forced = {...face, continuity: {...face.continuity, corniceGroups: [{pands: face.houses.slice(3).map(h => h.pandId), evidence: 'test'}]}};
  assert.ok(planFaceGround(forced, f, 0.5).groups[0].snapped === false, 'spread above the limit is left as surveyed');
});

test('Bilderdijkstraat 122-134 compiles to one chunk: gates, interference and photo storeys', async () => {
  const face = validateBlockFace(load(), order());
  const r = await compileBlockFace(face, facts(face));
  assert.deepEqual(r.gates.filter(g => !g.pass), []);
  assert.deepEqual(r.interference.filter(i => !i.pass).map(i => i.left), []);
  // The 1902-03 row: ground + 3 storeys + gable (the per-house recipes had 4 upper storeys).
  for (const p of ['156287', '156286', '155418', '155417']) assert.equal(r.perPand.find(x => x.pand.endsWith(p))!.storeyHeightsM.length, 4, p);
  // A real 2.3 m step between the 1908 and 1903 rows, a supported ~0.6 m step before 155417.
  assert.equal(r.interference[2].corniceVerdict, 'step-supported');
  assert.equal(r.interference[5].corniceVerdict, 'step-supported');
  assert.equal(r.chunk.pands.length, 7);
  assert.ok(r.chunk.report.triangles.chunk < 7 * 3000);
});

test('sign lettering on every mount: fascia, wall above the glass, and the shop glass (one stroke-font renderer)', () => {
  const face = load(), byPand = facts(face), intents = houseIntents(face);
  const check = (suffix: string, mount: string) => {
    const intent = intents.find(i => i.pandId.endsWith(suffix))!, b = compileBuilding(intent, byPand.get(intent.pandId)!);
    const band = b.fit.fronts[0].signBand!;
    assert.equal(band.mount, mount, suffix);
    const mesh = b.group.getObjectByName('sign/lettering') as T.Mesh;
    assert.ok(mesh, `${suffix}: lettering mesh`);
    const box = new T.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as T.BufferAttribute);
    assert.ok(box.min.y >= band.bottomM - 1e-6 && box.max.y <= band.bottomM + band.heightM + 1e-6, `${suffix}: inside the band vertically`);
    assert.ok(box.min.x >= band.frontLeftM - 1e-6 && box.max.x <= band.frontLeftM + band.widthM + 1e-6, `${suffix}: inside the band horizontally`);
    assert.ok(box.min.z > band.depthM, `${suffix}: in front of its surface`);
    return {band, layout: b.recipe.elevations[0]};
  };
  check('087959', 'fascia');
  const wall = check('156286', 'wall');
  // The wall-mounted sign needs a band of wall: the glass head drops below it.
  const glassTop = Math.max(...wall.layout.openings.value.filter(o => o.id.startsWith('shop-')).map(o => o.bottomM + o.heightM));
  assert.ok(wall.band.bottomM >= glassTop, 'wall sign above the glass');
  check('155417', 'glazing');
  // Unified schema: the old block-face spellings are rejected, not silently ignored.
  const base = intents.find(i => i.pandId.endsWith('156286'))!;
  const variant = (shopfront: any) => validateIntent({...base, fronts: [{...base.fronts[0], shopfront}]});
  assert.throws(() => variant({colour: 'black', fascia: false, stallRiser: 'low'}), /stallRiser: unknown field/);
  assert.throws(() => variant({colour: 'black', fascia: true, sign: {text: 'X', colour: 'white'}}), /sign.colour: unknown field[\s\S]*textColour/);
  assert.throws(() => variant({colour: 'black', fascia: false, sign: {text: 'X', textColour: 'white'}}), /fascia-mounted sign needs fascia: true/);
  assert.throws(() => variant({colour: 'black', fascia: true, sign: {text: 'X', textColour: 'white', mount: 'glazing'}}), /glazing-mounted sign with a fascia board/);
  assert.throws(() => variant({colour: 'black', fascia: false, sign: {text: 'CAF\u00c9', textColour: 'white', mount: 'wall'}}), /sign.text/);
  assert.throws(() => variant({colour: 'black', fascia: false, displayWindows: 0}), /displayWindows/);
});

test('discovery and strip helpers', () => {
  const a: [number, number][] = [[0, 0], [5, 0], [5, 10], [0, 10]], b: [number, number][] = [[5, 2], [9, 2], [9, 8], [5, 8]];
  assert.ok(Math.abs(sharedEdgeLength(a, b) - 6) < 1e-9);
  const span = {pandId: 'p', a: [0, 0] as [number, number], b: [6, 0] as [number, number], normal: [0, -1] as [number, number]};
  const panos = [{panoId: 'x', timestamp: '2024-11-29T10:00:00', rd: [3, -12] as [number, number], record: {}}, {panoId: 'y', timestamp: '2023-07-01T10:00:00', rd: [3, -12.5] as [number, number], record: {}}];
  const plan = planStrip([span], panos);
  assert.equal(plan.date, '2024-11-29'); assert.equal(plan.spans[0].panos[0].panoId, 'x');
  const tri = (z: number) => ({p: [[0, 1, z], [1, 1, z], [0, 2, z]], n: [0, 0, 1], slot: 'brick', surface: 'wall'});
  assert.ok(Math.abs(zFightArea([tri(0)], [tri(0.005)]) - 0.5) < 1e-6);
  assert.equal(zFightArea([tri(0)], [tri(0.05)]), 0);
});

test('Utrechtsestraat 48-76: 4-front pand, photo-trusted twin gables, front slits closed', async () => {
  const dir = 'scripts/block-face/faces/utrechtse-48-76';
  const face = validateBlockFace(JSON.parse(fs.readFileSync(path.join(dir, 'intent.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(dir, 'discovery.json'), 'utf8')).members);
  const f = new Map(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(path.join(dir, 'pands', h.pandId, 'facts.json'), 'utf8')) as BuildingFacts]));
  const r = await compileBlockFace(face, f);
  assert.deepEqual(r.gates.filter(g => !g.pass), []);
  assert.deepEqual(r.interference.filter(i => !i.pass).map(i => i.left), []);
  // 3DBAG puts 169207's eaves 1.7 m under its twin's; the strip shows one line: the photo-trusted group snaps it.
  const twin = r.ground.groups.find(g => g.trust === 'photo')!;
  assert.ok(twin.snapped && twin.spreadM > 1.5);
  // LoD2.2 ground rings stop 4-10 cm apart at six joints (Utrechtsestraat 48/50: 0.10 m): closed, no front gaps left.
  assert.ok(r.slitsClosed.some(s => s.left.endsWith('178874') && s.gapM >= 0.07));
  assert.ok(r.interference.every(i => Math.abs(i.frontGapM) <= 0.05));
  assert.equal(houseIntents(face).find(i => i.pandId.endsWith('178875'))!.fronts.length, 4);
});
