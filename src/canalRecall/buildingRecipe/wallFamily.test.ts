/**
 * Painted and metal-clad walls (issue #146): schema, the fit (absent = no key and no slot), the compiled house draws
 * the group in the city look's flat `paint` slot (ribs proud of the wall for metal, gates pass), and the measurement
 * proposal on synthetic flat, ribbed and brick-like crops.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates} from './largeGates.ts';
import {largeMaterialSlot, type CompiledLargeBuilding} from './largeCompile.ts';
import type {BuildingFacts} from './facts.ts';
import {drawnRibPitch, proposeWallFamily, ribPeriod, wallFamilyEvidence, WALL_FAMILY, type WallFamilyEvidence} from './wallFamily.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses', PLAIN = 'politie-van-leijenberghlaan';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
/** walls[0] without the fields a wall family excludes */
const plainWall = () => { const {wallSplit: _s, cladding: _c, wallMaterial: _m, houses: _h, ...w} = raw(PLAIN).walls[0]; return w; };
const withF = (f: unknown, wall: object = plainWall()) => { const b = raw(PLAIN); return {...b, walls: [{...wall, wallFamily: f}, ...b.walls.slice(1)]}; };

test('wallFamily schema: kind, measured colour, rib pitch for metal only, exclusive with other wall finishes', () => {
  assert.ok(validateLargeIntent(withF({kind: 'paint', colour: '#4a4c4e'})).walls[0].wallFamily);
  assert.ok(validateLargeIntent(withF({kind: 'metal', colour: '#7d8285', ribPitch: 0.4, lines: '#5d6265', from: 0.1})));
  assert.throws(() => validateLargeIntent(withF({kind: 'brick', colour: '#4a4c4e'})), /wallFamily\.kind/);
  assert.throws(() => validateLargeIntent(withF({kind: 'paint'})), /wallFamily\.colour/);
  assert.throws(() => validateLargeIntent(withF({kind: 'paint', colour: '#4a4c4e', ribPitch: 0.4})), /ribPitch/);
  assert.throws(() => validateLargeIntent(withF({kind: 'metal', colour: '#4a4c4e', ribPitch: 3})), /ribPitch/);
  assert.throws(() => validateLargeIntent(withF({kind: 'paint', colour: '#4a4c4e', lines: '#000000'})), /lines/);
  assert.throws(() => validateLargeIntent(withF({kind: 'paint', colour: '#4a4c4e', tone: 1})), /unknown/);
  assert.throws(() => validateLargeIntent(withF({kind: 'paint', colour: '#4a4c4e'}, {...plainWall(), cladding: {kind: 'ribs'}})), /not with cladding/);
  assert.throws(() => validateLargeIntent(withF({kind: 'paint', colour: '#4a4c4e'}, {...plainWall(), wallMaterial: 'stone'})), /not with wallMaterial/);
});

test('fit: absent = no wall-family slot anywhere; present = the group clad in its own paint slots, drawn as `paint`', () => {
  const plain = fitLarge(validateLargeIntent(raw(PLAIN)), facts(PLAIN)).recipe;
  assert.ok(!Object.keys(plain.spec.palette).some(k => /^(paintwall|paintline|metalwall|metalrib)@/.test(k)));
  const p = fitLarge(validateLargeIntent(withF({kind: 'paint', colour: '#4a4c4e'})), facts(PLAIN)).recipe.groups[0];
  assert.equal(p.cladding!.kind, 'paint'); assert.match(p.cladding!.slot, /^paintwall@g0$/); assert.equal(p.cladding!.pitchM, 0);
  const r = fitLarge(validateLargeIntent(withF({kind: 'metal', colour: '#7d8285', ribPitch: 0.6})), facts(PLAIN)).recipe, m = r.groups[0];
  assert.equal(m.cladding!.kind, 'ribs'); assert.equal(m.cladding!.pitchM, 1.2, 'every second 0.6 m rib'); assert.match(m.cladding!.lineSlot, /^metalrib@g0$/);
  assert.equal(r.spec.palette[m.cladding!.slot], '#7d8285');
  for (const s of ['paintwall@g0', 'paintline@g0', 'metalwall@g3', 'metalrib@g1']) assert.equal(largeMaterialSlot(s, {wallMaterial: 'brick'}).materialSlot, 'paint');
  // existing cladding keeps its slots (byte-identical for the clad houses)
  assert.equal(largeMaterialSlot('painted@g0', {wallMaterial: 'brick'}).materialSlot, 'brick');
  assert.equal(largeMaterialSlot('clad@g0', {wallMaterial: 'brick'}).materialSlot, 'stone');
});

const compiled = async (f: unknown) => {
  const intent = validateLargeIntent(withF(f)), built = compileBuilding(intent, facts(PLAIN)) as CompiledLargeBuilding;
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  return {built, glb, gates: evaluateLargeGates(await decodeTriangles(glb.bytes), built, {budget: intent.budgetTriangles}).gates};
};
test('compiled: a painted group exports a measured `paint` material; a metal group adds ribs; gates pass', async () => {
  const p = await compiled({kind: 'paint', colour: '#4a4c4e'});
  const slots = new Set<string>(); p.built.group.traverse((o: any) => { if (o.userData?.materialSlot) slots.add(o.userData.materialSlot); });
  assert.ok(slots.has('paint'), `a paint material is exported (${[...slots].join(', ')})`);
  assert.deepEqual(p.gates.filter(g => !g.pass && !g.advisory).map(g => g.id), []);
  const m = await compiled({kind: 'metal', colour: '#7d8285', ribPitch: 0.5, from: 0.3});
  assert.ok((m.built.components.claddingLines ?? 0) > 0, 'ribs drawn');
  assert.ok(m.glb.triangles > p.glb.triangles);
  assert.deepEqual(m.gates.filter(g => !g.pass && !g.advisory).map(g => g.id), []);
});

// ---- measurement on synthetic crops (50 px/m)
const PPM = 50;
const crop = (wM: number, hM: number, px: (x: number, y: number) => number) => {
  const width = wM * PPM, height = hM * PPM, rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const v = Math.max(0, Math.min(255, px(x, y))); rgb.set([v, v, v + 2], (y * width + x) * 3); }
  const image = {width, height, rgb, ppm: PPM, topM: hM}, box = {u0: 0, u1: wM, v0: 0, v1: hM}, cell = 0.1;
  const cols = wM / cell, rows = hM / cell, cells = Array.from({length: cols * rows}, (_, k) => k);
  return wallFamilyEvidence(image, box, cell, cells);
};
const noise = (x: number, y: number) => ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 6;
test('evidence: flat paint reads a low cell spread and no ribs; ribbed metal reads its pitch; brick courses and speckle read neither', () => {
  const flat = crop(12, 6, (x, y) => 80 + noise(x, y) + y * 0.02);
  assert.ok(flat.cellCv <= WALL_FAMILY.flatCv, `flat cellCv ${flat.cellCv}`);
  assert.equal(proposeWallFamily({basis: 'unresolved'}, '#505052', flat).proposal?.kind, 'paint');
  const ribs = crop(12, 6, (x, y) => 110 + 25 * Math.sign(Math.sin(2 * Math.PI * x / (0.4 * PPM))) + noise(x, y));
  assert.equal(proposeWallFamily({basis: 'unresolved'}, '#3c2d2d', flat).proposal, null, 'a warm dark is blurred brick');
  assert.ok(ribs.rib && Math.abs(ribs.rib.pitchM - 0.4) < 0.03, `rib ${JSON.stringify(ribs.rib)}`);
  const pm = proposeWallFamily({basis: 'unresolved'}, '#6e6e70', ribs).proposal;
  assert.equal(pm?.kind, 'metal'); assert.ok(Math.abs(pm!.ribPitch! - 0.4) < 0.03);
  // brick: dark courses every 3 px, head joints, a speckle of brick tones per 0.2 m block
  const brick = crop(12, 6, (x, y) => 70 + (y % 3 === 0 ? -20 : 0) + (((Math.floor(x / 10) * 7 + Math.floor(y / 3) * 13) % 5) - 2) * 9 + noise(x, y));
  // its pooled course texture (measureFacade material.texture.cv) is what a real crop reports beside the spread
  assert.ok(brick.cellCv > flat.cellCv * 2);
  assert.equal(proposeWallFamily({basis: 'unresolved', texture: {cv: 0.06}}, '#463c3a', brick).proposal, null, `brick ${JSON.stringify(brick)}`);
});
test('drawn rib pitch: the measured pitch times k, at least DRAWN_RIB_MIN_M', () => {
  assert.equal(drawnRibPitch(0.3), 1.2); assert.equal(drawnRibPitch(0.5), 1); assert.equal(drawnRibPitch(1.4), 1.4); assert.equal(drawnRibPitch(undefined), 1);
});
test('proposal: only on an unresolved family, with enough wall cells', () => {
  const e: WallFamilyEvidence = {cells: 5000, cellCv: 0.01, rib: null};
  assert.equal(proposeWallFamily({basis: 'courses'}, '#505050', e).proposal, null);
  assert.equal(proposeWallFamily({basis: 'colour'}, '#505050', e).proposal, null);
  assert.equal(proposeWallFamily({basis: 'unresolved'}, '#505050', {...e, cells: 10}).proposal, null);
  assert.equal(proposeWallFamily({basis: 'unresolved', texture: {cv: 0.05}}, '#505050', e).proposal, null, 'course texture too high');
  // the review controls: brick in shade that read unresolved and passed as brick
  assert.equal(proposeWallFamily({basis: 'unresolved', texture: {cv: 0.037}}, '#242e28', {cells: 1353, cellCv: 0.1421, rib: {pitchM: 0.24, score: 0, prominence: -0.2}}).proposal, null, 'Molenwerf 066028 w04');
  assert.equal(proposeWallFamily({basis: 'unresolved', texture: {cv: 0.244}}, '#212423', {cells: 5368, cellCv: 0.4063, rib: {pitchM: 1.1, score: 0.14, prominence: 0.14}}).proposal, null, 'De Klencke 094874 w08');
  assert.equal(proposeWallFamily({basis: 'unresolved', texture: {cv: 0.018}}, '#313236', {cells: 2237, cellCv: 0.0551, rib: {pitchM: 0.3, score: 0.754, prominence: 0.996}}).proposal?.kind, 'metal', '242134 w07 ribbed metal');
  assert.equal(proposeWallFamily({basis: 'unresolved'}, '#505050', e).proposal?.colour, '#505050');
  assert.equal(ribPeriod(new Float64Array(400), new Float64Array(400).fill(50), PPM), null);
});
