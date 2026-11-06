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
  // Round 2 (#239): an arched door is recessed as an arched cavity.
  assert.deepEqual(doorRevealProblems({form: 'reveal', deep: 0.3}, {doorBay: 0, doorArch: {span: 1.2, apex: 2.6}}, 'f'), []);
});

test('doorRevealOpenings: the fanlight sits on the door head (top unchanged) and the two share one lining', () => {
  const [door, fan] = doorRevealOpenings({form: 'reveal', deep: 0.35, steps: 2, jamb: 'stone'}, 1, 0, 1.2, 2.6, 0.5);
  assert.equal(fan.bottomM, 2.6);
  assert.equal(+(fan.bottomM + fan.heightM).toFixed(3), +(2.6 + 0.06 + 0.5).toFixed(3));
  const a = canalhouseOpeningRecess(door)!, b = canalhouseOpeningRecess(fan)!;
  // The door's jambs run on through the fanlight (one lining), in three shaded bands mouth to leaf; the fanlight has the soffit.
  assert.deepEqual(a.returns.map(r => r.id), ['left-jamb', 'left-jamb-shade-1', 'left-jamb-shade-2', 'right-jamb', 'right-jamb-shade-1', 'right-jamb-shade-2', 'step-0', 'step-1']);
  assert.deepEqual(b.returns.map(r => r.id), ['soffit', 'soffit-shade-1', 'soffit-shade-2']);
  assert.ok(a.returns.filter(r => /jamb/.test(r.id)).every(r => r.surface === 'stone' && r.h === +(fan.bottomM + fan.heightM).toFixed(3)));
  assert.deepEqual(a.returns.filter(r => r.id.startsWith('left-jamb')).map(r => [r.shade, +(r.z! + r.d! / 2).toFixed(6), +(r.z! - r.d! / 2).toFixed(6)]), [[1, 0, -0.116667], [0.8, -0.116667, -0.233333], [0.78, -0.233333, -0.35]]);
  // The top step reaches the leaf; the street step stands at the facade.
  const [s0, s1] = a.returns.filter(r => r.id.startsWith('step-'));
  assert.equal(+(s0.z! + s0.d! / 2).toFixed(6), 0);
  assert.equal(+(s1.z! - s1.d! / 2).toFixed(6), -0.35);
  assert.equal(s1.h, 0.34);
  // No fanlight: the door keeps its soffit and a stone sill.
  const [only] = doorRevealOpenings({form: 'reveal', deep: 0.3}, 1, 0, 1.2, 2.6, 0.1);
  assert.deepEqual(canalhouseOpeningRecess(only)!.returns.filter(r => !/shade/.test(r.id)).map(r => `${r.id}:${r.surface}`), ['left-jamb:wall', 'right-jamb:wall', 'soffit:wall', 'sill:stone']);
  // Portiek side doors stand on the landing, 15 cm before the back wall.
  const [pd] = doorRevealOpenings({form: 'portiek', deep: 1.2, span: 1.8, sideDoors: true, steps: 1}, 1, 0, 1.8, 2.6, 0.5);
  const sides = canalhouseOpeningRecess(pd)!.returns.filter(r => r.id.endsWith('-door'));
  assert.equal(sides.length, 2);
  assert.ok(sides.every(r => r.y === 0.17 && r.d === 0.9 && Math.abs(r.z! + 0.6) < 1e-9 && r.surface === 'door'));
});

test('Eerste Helmersstraat 213: the reveal cuts the wall, lines it and sets the leaf back; absent = the flush door', async () => {
  const pand = '0363100012159748', f = facts('helmers-209-253', pand);
  const flush = await compileBuilding(house('helmers-1897-banded', pand, 'Eerste Helmersstraat', fr => { delete fr.doorReveal; }), f);
  assert.equal(meshes(flush.group, /recess/).length, 0);
  const again = await compileBuilding(house('helmers-1897-banded', pand, 'Eerste Helmersstraat', fr => { delete fr.doorReveal; }), f);
  assert.equal(hashOf(again.group), hashOf(flush.group));
  // The type's own reveal (measured on the 2024-11-29 panoramas): 0.25 m, brick, no step.
  const typed = await compileBuilding(house('helmers-1897-banded', pand, 'Eerste Helmersstraat'), f);
  const typedNames = meshes(typed.group, /recess/).map(m => m.name);
  assert.ok(typedNames.some(n => n.endsWith("door/recess/left-jamb")) && !typedNames.some(n => /step-/.test(n)), typedNames.join(", "));
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

test('Van Breestraat round-arched door (#239): a doorArch with a doorReveal cuts an arched cavity, the wall stays around the arch', async () => {
  const pand = '0363100012160169', f = facts('bree-107-149-r1', pand);
  const arched = (fr: FrontIntent) => { fr.doorBay = 0; fr.doorArch = {span: 1, apex: 3.3}; };
  const flush = await compileBuilding(house('museum-cs-1900-gable-balcony', pand, 'Van Breestraat', arched), f);
  const built = await compileBuilding(house('museum-cs-1900-gable-balcony', pand, 'Van Breestraat', fr => { arched(fr); fr.doorReveal = {form: 'reveal', deep: 0.35}; }), f);
  const names = meshes(built.group, /recess/).map(m => m.name.replace(/^.*opening\//, ''));
  for (const n of ['door/recess/left-jamb', 'door/recess/right-jamb', 'door/recess/arch', 'door/recess/arch-shade-2', 'door/recess/spandrel', 'door/recess/sill']) assert.ok(names.includes(n), `${n} in ${names.join(', ')}`);
  assert.ok(!names.some(n => /soffit/.test(n)), 'an arch, not a flat soffit');
  // The leaf keeps its round head and stands at the back; the jambs stop at the springing (apex - span / 2).
  const leaf = meshes(built.group, /opening\/door\/pane$/)[0], flushLeaf = meshes(flush.group, /opening\/door\/pane$/)[0];
  const zOf = (m: T.Mesh) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox!.max.z; };
  assert.ok(Math.abs(zOf(flushLeaf) - zOf(leaf) - 0.35) < 1e-6, `leaf set back ${zOf(flushLeaf) - zOf(leaf)}`);
  const jamb = meshes(built.group, /door\/recess\/left-jamb$/)[0];
  jamb.geometry.computeBoundingBox();
  assert.ok(Math.abs(jamb.geometry.boundingBox!.max.y - 2.8) < 1e-6, `jamb top ${jamb.geometry.boundingBox!.max.y}`);
  // The intrados lining is a ring under the arch: its top at the apex, its foot at the springing.
  const ring = meshes(built.group, /door\/recess\/arch$/)[0];
  ring.geometry.computeBoundingBox();
  const rb = ring.geometry.boundingBox!;
  assert.ok(Math.abs(rb.max.y - 3.3) < 1e-6 && Math.abs(rb.min.y - 2.8) < 1e-6, `ring ${rb.min.y}..${rb.max.y}`);
  // The spandrel restores the wall face between the arch and the cut's top (3 cm over the apex), at the facade plane.
  const sp = meshes(built.group, /door\/recess\/spandrel$/)[0];
  sp.geometry.computeBoundingBox();
  assert.ok(Math.abs(sp.geometry.boundingBox!.max.y - 3.33) < 1e-6 && Math.abs(sp.geometry.boundingBox!.max.z) < 1e-6);
  const n = sp.geometry.getAttribute('normal');
  assert.ok(n.getZ(0) > 0.99, 'spandrel faces the street');
  // The shaded bands draw darker than the wall's own colour, mouth to back.
  const wallHex = (meshes(built.group, /door\/recess\/spandrel$/)[0].material as T.MeshStandardMaterial).color.getHexString();
  const bands = ['arch', 'arch-shade-1', 'arch-shade-2'].map(id => (meshes(built.group, new RegExp(`door/recess/${id}$`))[0].material as T.MeshStandardMaterial).color.getHSL({h: 0, s: 0, l: 0}).l);
  assert.equal((meshes(built.group, /door\/recess\/arch$/)[0].material as T.MeshStandardMaterial).color.getHexString(), wallHex);
  assert.ok(bands[0] > bands[1] && bands[1] > bands[2], bands.join(' '));
});

test('shade (#239): absent = the recess returns and meshes of round 1, byte-identical; present = one band per factor', () => {
  const o = {id: 'l', kind: 'window' as const, leftM: 0, bottomM: 1, widthM: 2, heightM: 2, trimWidthM: 0.1, recessM: 0.8, recessReturns: {glazedSides: [], soffitSurface: 'wall' as const}};
  assert.deepEqual(canalhouseOpeningRecess(o)!.returns.map(r => r.id), ['left-jamb', 'right-jamb', 'soffit', 'sill']);
  assert.ok(canalhouseOpeningRecess(o)!.returns.every(r => r.shade === undefined && r.z === undefined));
  const shaded = canalhouseOpeningRecess({...o, recessReturns: {...o.recessReturns, shade: [1, 0.7]}})!;
  assert.deepEqual(shaded.returns.map(r => `${r.id}:${r.shade ?? '-'}`), ['left-jamb:1', 'left-jamb-shade-1:0.7', 'right-jamb:1', 'right-jamb-shade-1:0.7', 'soffit:1', 'soffit-shade-1:0.7', 'sill:-']);
  assert.throws(() => canalhouseOpeningRecess({...o, recessReturns: {...o.recessReturns, shade: [0.7, 1]}}), /shade/);
  // A segmental head is recessed as an arch (the canal-house round and segmental door heads).
  const seg = canalhouseOpeningRecess({...o, kind: 'door', head: 'segmental', headRiseM: 0.3, recessReturns: {glazedSides: []}})!;
  assert.deepEqual(seg.returns.map(r => `${r.id}:${r.h}`), ['left-jamb:1.7', 'right-jamb:1.7', 'arch:0.3', 'sill:0.04']);
  assert.deepEqual(seg.arch, {rise: 0.3, cutTopM: 3.03});
});

test('per-house shop grounds (#239): the residential door beside a shop keeps the type measured reveal; null drops it', async () => {
  const t = defaultTypeLoader('helmers-1897-balconette')!;
  const shop = {shopfront: {colour: '#372e2a', fascia: true, entrance: 'centre', residentialDoor: {side: 'right' as const}}};
  const placed = resolvePlacement(t, {type: t.id, ground: shop} as never, 'Eerste Helmersstraat').design.fronts[0];
  assert.deepEqual(placed.doorReveal, {form: 'reveal', deep: 0.25});
  assert.equal(resolvePlacement(t, {type: t.id, ground: {...shop, doorReveal: null}} as never, 'Eerste Helmersstraat').design.fronts[0].doorReveal, undefined);
  // A whole-width shop has no door to recess; a type without a reveal stays flush.
  assert.equal(resolvePlacement(t, {type: t.id, ground: {shopfront: {colour: '#372e2a', fascia: true}}} as never, 'Eerste Helmersstraat').design.fronts[0].doorReveal, undefined);
  const plain = defaultTypeLoader('helmers-1911-balcony-axis')!;
  assert.equal(resolvePlacement(plain, {type: plain.id, ground: shop} as never, 'Eerste Helmersstraat').design.fronts[0].doorReveal, undefined);
  // Drawn: the shop's residential door stands at the back of its cavity.
  const pand = '0363100012159748', f = facts('helmers-209-253', pand);
  const design = resolvePlacement(t, {type: t.id, ground: shop} as never, 'Eerste Helmersstraat').design;
  const built = await compileBuilding(validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'reveal-shop', pandId: pand, address: 'Eerste Helmersstraat', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-11-29'}], ...design, notes: []} as CanalHouseIntent), f);
  const names = meshes(built.group, /recess/).map(m => m.name);
  assert.ok(names.some(n => n.endsWith('door/recess/left-jamb')) && names.some(n => n.endsWith('door-transom/recess/soffit-shade-2')), names.join(', '));
});

test('President Steynstraat 11 (#239, the slivers): on a jogged front no shell face, step face or jog backing stands inside the cavity', async () => {
  const pand = '0363100012073365', f = facts('steyn-9-19-r1', pand), t = defaultTypeLoader('transvaal-1928-plain-row')!;
  const design = resolvePlacement(t, {type: t.id, mirror: true} as never, 'President Steynstraat').design;
  assert.deepEqual(design.fronts[0].doorReveal, {form: 'portiek', deep: 0.65, steps: 1, riser: 0.15});
  const built = await compileBuilding(validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'reveal-steyn', pandId: pand, address: 'President Steynstraat 11', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-11-29'}], ...design, notes: []} as CanalHouseIntent), f);
  built.group.updateMatrixWorld(true);
  const facade = built.group.getObjectByName('elevation/front0')!, door = built.recipe.elevations[0].openings.value.find(o => o.id === 'door')!;
  const toFacade = facade.matrixWorld.clone().invert();
  assert.ok(meshes(built.group, /^shell\/jog-backing/).length > 0, 'this front is jogged');
  // Rays from the street into the door opening: none may meet a shell face (wall, step face of the jog, its backing)
  // before the leaf, 0.65 m back (a native step face crossing the cavity drew a full-height sliver).
  const shell = meshes(built.group, /^shell\//).map(m => { const c = m.clone(); c.material = new T.MeshBasicMaterial({side: T.DoubleSide}); return c; });
  const ray = new T.Raycaster(), dir = new T.Vector3(0, 0, -1).transformDirection(facade.matrixWorld);
  let inside = 0;
  for (let i = 1; i < 10; i++) for (const y of [0.4, 1.2, 2.0]) {
    const o = new T.Vector3(door.leftM + 0.06 + (door.widthM - 0.12) * i / 10, door.bottomM + y, 1).applyMatrix4(facade.matrixWorld);
    ray.set(o, dir); ray.far = 1 + 0.5;
    if (ray.intersectObjects(shell, false).length) inside++;
  }
  assert.equal(inside, 0, `${inside} rays meet a shell face inside the cavity`);
});
