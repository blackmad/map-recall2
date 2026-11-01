/**
 * Inset doorways (#181, doorReveal.ts): the door and its fanlight cut `deep` into the wall as one cavity (jambs, soffit,
 * a stone threshold or steps, the leaf at the back), a portiek's side doors; validation; drawn on a Helmersbuurt and a
 * Transvaalbuurt house, and absent = the flush door, byte-identical.
 *   node --import tsx --test src/canalRecall/buildingRecipe/doorReveal.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {doorRevealOpenings, doorRevealProblems} from './doorReveal.ts';
import {canalhouseOpeningRecess} from '../canalhouseOpeningRecess.ts';
import {resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';
import {createHash} from 'node:crypto';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/${pand}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };
function house(typeId: string, pand: string, street: string, edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id}, street).design;
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `reveal-${pand.slice(-6)}`, pandId: pand, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-11-29'}], ...design, notes: []} as CanalHouseIntent);
}
const front = {doorBay: 1};
const trisOf = (g: T.Object3D) => { let n = 0; g.traverse(o => { if (o instanceof T.Mesh) n += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3; }); return n; };
const hashOf = (g: T.Object3D) => { const h = createHash('sha256'); g.traverse(o => { if (o instanceof T.Mesh) { h.update(o.name); h.update(Buffer.from(new Float32Array(Array.from(o.geometry.getAttribute('position').array as ArrayLike<number>)).buffer)); } }); return h.digest('hex'); };

test('doorReveal schema: form, depth per form, steps, jamb, width, side doors only on a deep portiek, a door to recess', () => {
  assert.deepEqual(doorRevealProblems({form: 'reveal', deep: 0.3, steps: 1, jamb: 'stone'}, front, 'f'), []);
  assert.deepEqual(doorRevealProblems({form: 'portiek', deep: 1.2, span: 1.8, sideDoors: true, leaf: 'glazed'}, front, 'f'), []);
  assert.ok(doorRevealProblems({form: 'reveal', deep: 1.2}, front, 'f').some(p => /deep: 0.15..0.7/.test(p)));
  assert.ok(doorRevealProblems({form: 'arch', deep: 0.3}, front, 'f').some(p => /form/.test(p)));
  assert.ok(doorRevealProblems({form: 'reveal', deep: 0.3, steps: 7}, front, 'f').some(p => /steps/.test(p)));
  assert.ok(doorRevealProblems({form: 'reveal', deep: 0.3, depth: 1}, front, 'f').some(p => /\{form/.test(p)));
  assert.ok(doorRevealProblems({form: 'reveal', deep: 0.4, sideDoors: true}, front, 'f').some(p => /sideDoors/.test(p)));
  assert.ok(doorRevealProblems({form: 'portiek', deep: 0.7, sideDoors: true}, front, 'f').some(p => /sideDoors/.test(p)));
  assert.ok(doorRevealProblems({form: 'reveal', deep: 0.3}, {doorBay: null}, 'f').some(p => /needs a door/.test(p)));
  assert.deepEqual(doorRevealProblems({form: 'reveal', deep: 0.3}, {doorBay: null, shopfront: {residentialDoor: {side: 'left'}}}, 'f'), []);
  assert.ok(doorRevealProblems({form: 'reveal', deep: 0.3}, {doorBay: 0, doorArch: {span: 1.2, apex: 2.6}}, 'f').some(p => /doorArch/.test(p)));
});

test('doorRevealOpenings: the fanlight sits on the door head (top unchanged) and the two share one lining', () => {
  const [door, fan] = doorRevealOpenings({form: 'reveal', deep: 0.35, steps: 2, jamb: 'stone'}, 1, 0, 1.2, 2.6, 0.5);
  assert.equal(fan.bottomM, 2.6);
  assert.equal(+(fan.bottomM + fan.heightM).toFixed(3), +(2.6 + 0.06 + 0.5).toFixed(3));
  const a = canalhouseOpeningRecess(door)!, b = canalhouseOpeningRecess(fan)!;
  assert.deepEqual(a.returns.map(r => r.id), ['left-jamb', 'right-jamb', 'step-0', 'step-1']);
  assert.deepEqual(b.returns.map(r => r.id), ['left-jamb', 'right-jamb', 'soffit']);
  assert.ok(a.returns.filter(r => r.id.endsWith('jamb')).every(r => r.surface === 'stone'));
  // The top step reaches the leaf; the street step stands at the facade.
  const [s0, s1] = a.returns.slice(2);
  assert.equal(+(s0.z! + s0.d! / 2).toFixed(6), 0);
  assert.equal(+(s1.z! - s1.d! / 2).toFixed(6), -0.35);
  assert.equal(s1.h, 0.34);
  // No fanlight: the door keeps its soffit and a stone sill.
  const [only] = doorRevealOpenings({form: 'reveal', deep: 0.3}, 1, 0, 1.2, 2.6, 0.1);
  assert.deepEqual(canalhouseOpeningRecess(only)!.returns.map(r => `${r.id}:${r.surface}`), ['left-jamb:wall', 'right-jamb:wall', 'soffit:wall', 'sill:stone']);
  // Portiek side doors stand on the landing, 15 cm before the back wall.
  const [pd] = doorRevealOpenings({form: 'portiek', deep: 1.2, span: 1.8, sideDoors: true, steps: 1}, 1, 0, 1.8, 2.6, 0.5);
  const sides = canalhouseOpeningRecess(pd)!.returns.filter(r => r.id.endsWith('-door'));
  assert.equal(sides.length, 2);
  assert.ok(sides.every(r => r.y === 0.17 && r.d === 0.9 && Math.abs(r.z! + 0.6) < 1e-9 && r.surface === 'door'));
});

test('Eerste Helmersstraat 213: the reveal cuts the wall, lines it and sets the leaf back; absent = the flush door', async () => {
  const pand = '0363100012159748', f = facts('helmers-209-253', pand);
  const flush = await compileBuilding(house('helmers-1897-banded', pand, 'Eerste Helmersstraat'), f);
  assert.equal(meshes(flush.group, /recess/).length, 0);
  const again = await compileBuilding(house('helmers-1897-banded', pand, 'Eerste Helmersstraat', fr => { delete fr.doorReveal; }), f);
  assert.equal(hashOf(again.group), hashOf(flush.group));
  const inset = await compileBuilding(house('helmers-1897-banded', pand, 'Eerste Helmersstraat', fr => { fr.doorReveal = {form: 'reveal', deep: 0.3, steps: 1}; }), f);
  const names = meshes(inset.group, /recess/).map(m => m.name.replace(/^.*opening\//, ''));
  for (const n of ['door/recess/left-jamb', 'door/recess/step-0', 'door-transom/recess/soffit']) assert.ok(names.some(x => x.endsWith(n)), `${n} in ${names.join(', ')}`);
  assert.ok(!names.some(x => x.endsWith('door/recess/soffit')) && !names.some(x => x.endsWith('door-transom/recess/sill')), 'one cavity: no lining between door and fanlight');
  const tris = trisOf(inset.group) - trisOf(flush.group);
  assert.ok(tris > 0 && tris < 200, `reveal adds ${tris} triangles`);
});

test('Albert Luthulistraat portiek: a deep cavity wider than the door, side doors on its walls', async () => {
  const pand = '0363100012126814', f = facts('luthuli-21-41-r1', pand);
  const built = await compileBuilding(house('transvaal-1923-portiek', pand, 'Albert Luthulistraat', fr => { fr.doorReveal = {form: 'portiek', deep: 1.2, span: 1.7, sideDoors: true, steps: 1, leaf: 'glazed'}; }), f);
  assert.equal(meshes(built.group, /recess\/(left|right)-door$/).length, 2);
});
