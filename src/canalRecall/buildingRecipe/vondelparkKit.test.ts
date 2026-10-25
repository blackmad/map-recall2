/**
 * Kit additions from the Vondelpark south-edge lane (2026-10-25, issue #62): timber verandas and stone loggias
 * (`gallery`, blockBuilding/gallery.ts), thin speklagen (`dressings.stripes.share`), oriel lists with their own storey
 * spans, a balustrade or iron railing on an oriel's roof (`rail`), a brick oriel body (`brick`) and a slate mansard face in the wall plane (`mansard`).
 * Every addition is opt-in: absent, the mesh is unchanged.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {GALLERY, archCurve, balusterCentres, fitGallery, galleryProblems} from '../blockBuilding/gallery.ts';
import {meshHashOf} from '../../../scripts/building-recipes/mesh-hash.ts';

const HOUSES = 'scripts/building-recipes/houses';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const K1 = 'koninginneweg-1-236925', VE97 = 'van-eeghenstraat-97-237151', PLAZA = 'koninginneweg-34-150885';

test('gallery schema: contiguous storeys, fractions only, a bay span needs the bay count, colours as #rrggbb', () => {
  assert.deepEqual(galleryProblems({storeys: [1, 2], arches: 2, deep: 0.5, railColour: '#2b2b2b'}, 'g', 5, 5), []);
  assert.ok(galleryProblems({storeys: [1, 3]}, 'g', 5, 5).some(p => /contiguous/.test(p)));
  assert.ok(galleryProblems({storeys: [1], deep: 1.2}, 'g', 5, 5).some(p => /deep/.test(p)));
  assert.ok(galleryProblems({storeys: [1], railColour: 'black'}, 'g', 5, 5).some(p => /railColour/.test(p)));
  assert.ok(galleryProblems({storeys: [1], depthM: 2}, 'g', 5, 5).some(p => /depthM/.test(p)));
  const base = raw(K1);
  base.walls[1].gallery = [{storeys: [9]}];
  assert.throws(() => validateLargeIntent(base), /gallery/);
});

test('gallery fit: defaults, its own timber slot when coloured, the railing its own slot', () => {
  const slots: string[] = [];
  const [g] = fitGallery({storeys: [2], colour: '#ece6d6', railColour: '#2b2b2b'}, {stone: 'stone', timber: (k, c) => { slots.push(`t${k}${c}`); return `t${k}`; }, rail: (k, c) => { slots.push(`r${k}${c}`); return `r${k}`; }});
  assert.equal(g.railSlot, 'r0');
  assert.deepEqual(slots.sort(), ['r0#2b2b2b', 't0#ece6d6']);
  const [plain] = fitGallery({storeys: [1, 2]}, {stone: 'stone', timber: () => 'frame'});
  assert.equal(plain.railSlot, undefined);
  assert.equal(plain.from, 1); assert.equal(plain.to, 2);
  assert.deepEqual(balusterCentres(0, 0.2), []);
  assert.equal(balusterCentres(0, 3).length, Math.floor(3 / GALLERY.balusterPitchM));
  const arc = archCurve(0, 2, 1, 0.5);
  assert.deepEqual(arc[0].map(v => +v.toFixed(6)), [0, 1]);
  assert.deepEqual(arc[arc.length - 1].map(v => +v.toFixed(6)), [2, 1]);
});

test('Koninginneweg 1: galleries drawn on the Koninginneweg and Van Eeghenstraat fronts; absent = no gallery, fewer triangles', () => {
  const intent = validateLargeIntent(raw(K1)), f = facts(K1);
  const {recipe} = fitLarge(intent, f);
  assert.deepEqual(recipe.groups.map(g => g.gallery?.length ?? 0), [0, 2, 0, 1]);
  const a = compileBuilding(intent, f);
  assert.ok((a.components.galleries ?? 0) >= 3);
  const stripped = raw(K1);
  for (const w of stripped.walls) delete w.gallery;
  const b = compileBuilding(validateLargeIntent(stripped), f);
  assert.equal(b.components.galleries, undefined);
  assert.notEqual(meshHashOf(a.group), meshHashOf(b.group));
});

test('stripes.share: thin speklagen change the mesh; absent keeps the even courses', () => {
  const f = facts(VE97), withShare = compileBuilding(validateLargeIntent(raw(VE97)), f);
  const even = raw(VE97);
  for (const w of even.walls) delete w.dressings.stripes.share;
  const e = compileBuilding(validateLargeIntent(even), f);
  assert.notEqual(meshHashOf(withShare.group), meshHashOf(e.group));
  const bad = raw(VE97); bad.walls[0].dressings.stripes.share = 0.9;
  assert.throws(() => validateLargeIntent(bad), /stripes\.share/);
});

test('oriel lists, roof rails and brick bodies: each changes the mesh; a single set still validates', () => {
  const f = facts(VE97), full = raw(VE97);
  const a = compileBuilding(validateLargeIntent(full), f);
  const noRail = raw(VE97);
  for (const o of noRail.walls[0].dressings.oriels) delete o.rail;
  const b = compileBuilding(validateLargeIntent(noRail), f);
  assert.notEqual(meshHashOf(a.group), meshHashOf(b.group));
  assert.ok(a.components.dressings! >= b.components.dressings!);
  const single = raw(VE97); single.walls[0].dressings.oriels = single.walls[0].dressings.oriels[1];
  assert.ok(validateLargeIntent(single));
  const bad = raw(VE97); bad.walls[0].dressings.oriels[0].rail = 'glass';
  assert.throws(() => validateLargeIntent(bad), /oriels\.rail/);
  const pf = facts(PLAZA), brickIntent = raw(PLAZA);
  brickIntent.walls[0].dressings.oriels.brick = true;
  const brick = compileBuilding(validateLargeIntent(brickIntent), pf), stone = compileBuilding(validateLargeIntent(raw(PLAZA)), pf);
  assert.notEqual(meshHashOf(brick.group), meshHashOf(stone.group), 'a brick body is drawn in the wall slot');
});

test('mansard storeys: a slate face in the wall plane on its own slot, lit as a wall with the slate texture; absent unchanged', async () => {
  const {largeMaterialSlot} = await import('./largeCompile.ts');
  const VE180 = 'van-eeghenstraat-180-236607', f = facts(VE180), intent = validateLargeIntent(raw(VE180));
  const {recipe} = fitLarge(intent, f);
  assert.deepEqual(recipe.groups[0].mansard, {storeys: [3, 4], slot: 'mansard@g0'});
  assert.equal(recipe.spec.palette['mansard@g0'], '#2a2c31');
  assert.deepEqual(largeMaterialSlot('mansard@g0', recipe), {materialSlot: 'slate', surface: 'wall'});
  const a = compileBuilding(intent, f);
  assert.equal(a.components.mansards, 2);
  const none = raw(VE180); delete none.walls[0].mansard;
  const b = compileBuilding(validateLargeIntent(none), f);
  assert.equal(b.components.mansards, undefined);
  assert.notEqual(meshHashOf(a.group), meshHashOf(b.group));
  const bad = raw(VE180); bad.walls[0].mansard = {storeys: [0]};
  assert.throws(() => validateLargeIntent(bad), /mansard\.storeys/);
  const both = raw(VE180); both.walls[0].stoneStoreys = [3];
  assert.throws(() => validateLargeIntent(both), /mansard or stone/);
});
