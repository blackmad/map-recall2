/**
 * Facade cladding on the large kit (issue #49: ribbed and horizontal metal halls, cassette panels round ribbon windows,
 * louvres, painted brick): schema, the fit (absent = no key and no slot, so every other house's recipe is unchanged),
 * the sheet slot move clipped at its heights, and a compiled clad house (lines proud of the wall, gates pass).
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import {evaluateLargeGates} from './largeGates.ts';
import type {BuildingFacts} from './facts.ts';
import type {CompiledLargeBuilding} from './largeCompile.ts';
import {CLADDING, CLADDING_TOP_M, applyCladdingSlots, claddingHeights, type CladdingFit} from '../blockBuilding/cladding.ts';
import {MeshBuilder} from '../blockBuilding/mesh.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles} from '../../../scripts/building-recipes/compile.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const HALL = 'pand-083604', PLAIN = 'politie-van-leijenberghlaan';

test('cladding schema: kind, colours, pitch in the kind range, fractions, side only with a wall split', () => {
  const base = raw(PLAIN), w0 = base.walls[0];
  const {wallSplit: _split, ...noSplit} = w0;
  const withC = (c: unknown, wall: object = w0) => ({...base, walls: [{...wall, cladding: c}, ...base.walls.slice(1)]});
  assert.ok(validateLargeIntent(withC({kind: 'ribs', colour: '#839192', pitch: 0.35, from: 0.1})).walls[0].cladding);
  assert.ok(validateLargeIntent(withC({kind: 'panels', rowPitch: 3.6, to: 0.8})));
  assert.ok(validateLargeIntent(withC({kind: 'paint', colour: '#f0f0ea'})));
  assert.throws(() => validateLargeIntent(withC({kind: 'tiles'})), /cladding\.kind/);
  assert.throws(() => validateLargeIntent(withC({kind: 'ribs', pitch: 5})), /cladding\.pitch/);
  assert.throws(() => validateLargeIntent(withC({kind: 'ribs', rowPitch: 2})), /rowPitch/);
  assert.throws(() => validateLargeIntent(withC({kind: 'paint', lines: '#000000'})), /lines/);
  assert.throws(() => validateLargeIntent(withC({kind: 'boards', from: 0.6, to: 0.65})), /from/);
  assert.throws(() => validateLargeIntent(withC({kind: 'boards', colour: 'grey'})), /colour/);
  assert.ok(validateLargeIntent(withC({kind: 'boards', side: 'left'})));
  assert.throws(() => validateLargeIntent(withC({kind: 'boards', side: 'left'}, noSplit)), /side/);
  assert.throws(() => validateLargeIntent(withC({kind: 'boards', size: 2})), /unknown|size/);
});

test('fit: a group without cladding has no key and no clad slot; a clad group gets its own wall, sheet and line slots', () => {
  const plain = fitLarge(validateLargeIntent(raw(PLAIN)), facts(PLAIN)).recipe;
  assert.ok(plain.groups.every(g => !('cladding' in g)));
  assert.ok(!Object.keys(plain.spec.palette).some(k => k.startsWith('clad') || k.startsWith('painted')));
  const r = fitLarge(validateLargeIntent(raw(HALL)), facts(HALL)).recipe, g = r.groups.find(x => x.cladding)!;
  assert.equal(g.cladding!.kind, 'ribs');
  assert.match(g.cladding!.slot, /^clad@g\d+$/);
  assert.equal(r.spec.palette[g.cladding!.slot], raw(HALL).walls[r.groups.indexOf(g)].cladding.colour);
  assert.ok(r.spec.palette[g.cladding!.lineSlot]);
});

test('heights: fractions of the eaves; to 1 runs to the top of every panel', () => {
  assert.deepEqual(claddingHeights(10, 0.25, 1), {fromM: 2.5, toM: CLADDING_TOP_M});
  assert.deepEqual(claddingHeights(10, 0, 0.5), {fromM: 0, toM: 5});
  for (const k of Object.values(CLADDING)) assert.ok(k.out >= 0.035 && k.pitch >= k.min && k.pitch <= k.max);
});

test('slot move: wall triangles between fromM and toM move to the sheet slot, clipped, area preserved', () => {
  const area = (pos: number[]) => { let a = 0; for (let i = 0; i < pos.length; i += 9) { const [ax, ay, , bx, by, , cx, cy] = pos.slice(i, i + 9); a += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2; } return a; };
  const m = new MeshBuilder();
  m.slots.set('wall@g0', {positions: [0, 0, 0, 4, 0, 0, 4, 10, 0, 0, 0, 0, 4, 10, 0, 0, 10, 0], parts: [0, 0]});
  const f: CladdingFit = {kind: 'ribs', fromM: 2, toM: 6, pitchM: 0.5, rowPitchM: 1, slot: 'clad@g0', lineSlot: 'cladline@g0'};
  assert.equal(applyCladdingSlots(m, [{slots: {wall: 'wall@g1'}}, {slots: {wall: 'wall@g0'}, cladding: f}]), 2);
  const wall = m.slots.get('wall@g0')!.positions, clad = m.slots.get('clad@g0')!.positions;
  assert.ok(Math.abs(area(clad) - 16) < 1e-6 && Math.abs(area(wall) - 24) < 1e-6);
  for (let i = 1; i < clad.length; i += 3) assert.ok(clad[i] >= 2 - 1e-9 && clad[i] <= 6 + 1e-9);
  // louvres: the sheet is the dark ground behind the slats (the line slot)
  const l = new MeshBuilder();
  l.slots.set('wall@g0', {positions: [0, 0, 0, 4, 0, 0, 4, 10, 0], parts: [0]});
  applyCladdingSlots(l, [{slots: {wall: 'wall@g0'}, cladding: {...f, kind: 'louvres'}}]);
  assert.ok(l.slots.get('cladline@g0') && !l.slots.get('clad@g0'));
});

test(`${HALL}: ribbed metal sheet and ribs proud of the wall, gates pass`, async () => {
  const intent = validateLargeIntent(raw(HALL)), built = compileBuilding(intent, facts(HALL)) as CompiledLargeBuilding;
  assert.ok((built.components.claddingLines ?? 0) > 50, `${built.components.claddingLines} cladding lines`);
  // clad sheets and lines are smooth stone cells in the game material set
  assert.ok(built.group.children.some(m => m.userData.materialSlot === 'stone'));
  const glb = await canalhouseGroupToGlb(HALL, built.group, {metreUvs: true, slotFor: m => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const tris = await decodeTriangles(glb.bytes);
  assert.deepEqual(evaluateLargeGates(tris, built).gates.filter(x => !x.pass && !x.advisory).map(x => x.id), []);
});
