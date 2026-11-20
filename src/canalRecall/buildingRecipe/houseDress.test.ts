// Per-house window frames and dressings in a large-kit row (`walls[].houses[].frame` / `.dress`), lane
// narva-pilot-20261116: Narva-eiland's rows of separately designed fronts on one BAG pand.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import {compileLargeBuilding} from './largeCompile.ts';
import type {BuildingFacts} from './facts.ts';
import type {LargeBuildingIntent} from './intent.ts';

const HOUSES = 'scripts/building-recipes/houses';
const ID = 'stadhouderskade-111-137448';
const raw = (): LargeBuildingIntent => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${ID}/facts.json`, 'utf8'));
/** the fixture's first group with house k given `extra` */
const withHouse = (k: number, extra: Record<string, unknown>) => {
  const base = raw();
  return {...base, walls: base.walls.map((w, i) => (i === 0 ? {...w, houses: w.houses!.map((h, j) => (j === k ? {...h, ...extra} : h))} : w))};
};

test('houses[].frame/dress: validator takes the per-house vocabulary and refuses group-only parts', () => {
  assert.doesNotThrow(() => validateLargeIntent(withHouse(0, {frame: '#e8e6e0', dress: {colour: '#e6e2da', stripes: {storeys: [1, 2], count: 5, share: 0.3}}})));
  assert.doesNotThrow(() => validateLargeIntent(withHouse(2, {dress: {surrounds: {storeys: [1]}, piers: {ends: true}, bands: {at: ['sill']}}})));
  assert.throws(() => validateLargeIntent(withHouse(0, {frame: 'pale'})), /frame: unknown colour/);
  assert.throws(() => validateLargeIntent(withHouse(0, {dress: {quoins: {ends: true}}})), /not per house/);
  assert.throws(() => validateLargeIntent(withHouse(0, {dress: {oriels: {bays: [0], from: 1, to: 2}}})), /not per house/);
  assert.throws(() => validateLargeIntent(withHouse(0, {dress: {stripes: {storeys: [1], count: 40}}})), /stripes/);
});

test('houses[].frame/dress: absent changes nothing in the fit', () => {
  const plain = fitLarge(validateLargeIntent(raw()), facts()).recipe;
  const dressed = fitLarge(validateLargeIntent(withHouse(0, {frame: '#e8e6e0', dress: {colour: '#e6e2da', stripes: {storeys: [1]}}})), facts()).recipe;
  // the houses without frame/dress keep the group's frame slot and carry no dress
  const segs = plain.groups[0].houses!.segs, dsegs = dressed.groups[0].houses!.segs;
  for (let k = 1; k < segs.length; k++) {
    assert.deepEqual(dsegs[k], segs[k]);
    assert.deepEqual(dressed.spec.systems[segs[k].system], plain.spec.systems[segs[k].system]);
  }
  assert.equal(segs[0].dress, undefined);
  assert.ok(!/(frame|dress)@g\d+h\d+/.test(JSON.stringify(plain)));
});

test('houses[].frame/dress: the fit gives the house its own frame slot and dress slot', () => {
  const r = fitLarge(validateLargeIntent(withHouse(0, {frame: '#e8e6e0', dress: {colour: '#e6e2da', stripes: {storeys: [1]}}})), facts()).recipe;
  const s0 = r.groups[0].houses!.segs[0];
  const sys = JSON.stringify(r.spec.systems[s0.system]);
  assert.ok(sys.includes('"frame":"frame@g0h0"') && !sys.includes('"frame":"frame"'), sys);
  assert.equal(s0.dress?.slot, 'dress@g0h0');
  assert.ok(JSON.stringify(r).includes('dress@g0h0'));
  // no colour: the house's dressings take the group's stone slot
  const r2 = fitLarge(validateLargeIntent(withHouse(1, {dress: {surrounds: {}}})), facts()).recipe;
  assert.ok(r2.groups[0].houses!.segs[1].dress?.slot && !/^dress@/.test(r2.groups[0].houses!.segs[1].dress!.slot));
});

test('houses[].dress: compile draws the dressings inside the house span only, in their own slot', () => {
  const plain = compileLargeBuilding(validateLargeIntent(raw()), facts(), {budget: 1e9});
  const built = compileLargeBuilding(validateLargeIntent(withHouse(0, {frame: '#e8e6e0', dress: {colour: '#e6e2da', stripes: {storeys: [1, 2], count: 4, share: 0.3}, surrounds: {storeys: [1]}}})), facts(), {budget: 1e9});
  assert.ok((built.components.dressings ?? 0) > (plain.components.dressings ?? 0));
  const meshes: T.Mesh[] = [];
  built.group.traverse(o => { if ((o as T.Mesh).isMesh) meshes.push(o as T.Mesh); });
  const dress = meshes.filter(m => /dress@g0h0/.test(m.name)), frames = meshes.filter(m => /frame@g0h0/.test(m.name));
  assert.ok(dress.length, `dress mesh among ${meshes.map(m => m.name).join(', ')}`);
  assert.ok(frames.length, 'frame mesh for the house');
  // the house's dressings stay on its span: their extent along the main panel is no wider than the house
  const seg = built.recipe.groups[0].houses!.segs[0], box = new T.Box3();
  for (const m of dress) box.expandByObject(m);
  const size = box.getSize(new T.Vector3());
  assert.ok(Math.max(size.x, size.z) <= seg.u1 - seg.u0 + 0.5, `dress extent ${Math.max(size.x, size.z).toFixed(2)} m vs house ${(seg.u1 - seg.u0).toFixed(2)} m`);
});

// Narva-eiland 252366: one BAG pand over two LoD2.2 rows and the deck between them; tiles draw it as two OSM outlines.
test('footprintParts / osmAliases: validator; footprintInside measures the model share inside BAG', async () => {
  const {footprintInside} = await import('./gates.ts');
  const n = JSON.parse(fs.readFileSync(`${HOUSES}/narva-eiland-252366/intent.json`, 'utf8'));
  assert.doesNotThrow(() => validateLargeIntent(n));
  assert.throws(() => validateLargeIntent({...n, footprintParts: false}), /footprintParts/);
  assert.throws(() => validateLargeIntent({...n, osmAliases: ['way/1']}), /osmAliases/);
  assert.throws(() => validateLargeIntent({...n, osmAliases: []}), /osmAliases/);
  const sq = (x0: number, y0: number, s: number) => [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];
  const f = {bagFootprintRD: [sq(0, 0, 10)]} as unknown as BuildingFacts;
  // model local frame: x east, z south of the anchor (0, 10): a 4 m square wholly inside, then half outside
  assert.equal(footprintInside(f, [[[1, 1], [5, 1], [5, 5], [1, 5]]], [0, 10]), 1);
  assert.ok(Math.abs(footprintInside(f, [[[8, 1], [12, 1], [12, 5], [8, 5]]], [0, 10]) - 0.5) < 0.02);
});

// Memeleiland 251849 (lane houthavens-memel-wiborg-20261120): broad stone jambs and a tall head panel round each window.
test('surrounds.jamb / head: validated as shares; widen the jambs and raise the head; absent keeps the 0.13 m frame', async () => {
  const {surroundJamb, surroundHead, DRESS} = await import('../blockBuilding/dressings.ts');
  const hole = [0, 1.4, 0, 2.2] as const;
  assert.equal(surroundJamb({}, hole), DRESS.surround.t);
  assert.equal(surroundHead({}, hole), DRESS.surround.t);
  assert.ok(Math.abs(surroundJamb({jamb: 0.2}, hole) - 0.28) < 1e-9);
  assert.ok(Math.abs(surroundHead({head: 0.25}, hole) - 0.55) < 1e-9);
  assert.doesNotThrow(() => validateLargeIntent(withHouse(0, {dress: {surrounds: {storeys: [1], jamb: 0.18, head: 0.22}}})));
  assert.throws(() => validateLargeIntent(withHouse(0, {dress: {surrounds: {jamb: 0.6}}})), /surrounds.jamb/);
  assert.throws(() => validateLargeIntent(withHouse(0, {dress: {surrounds: {head: 0.01}}})), /surrounds.head/);
  // the broad frame draws more stone than the default one on the same house
  const area = (b: ReturnType<typeof compileLargeBuilding>) => { let n = 0; b.group.traverse(o => { const m = o as T.Mesh; if (m.isMesh && /dress@g0h0/.test(m.name)) { const bb = new T.Box3().setFromObject(m), s = bb.getSize(new T.Vector3()); n += s.x * s.y + s.z * s.y; } }); return n; };
  const thin = compileLargeBuilding(validateLargeIntent(withHouse(0, {dress: {colour: '#e6e2da', surrounds: {storeys: [1]}}})), facts(), {budget: 1e9});
  const broad = compileLargeBuilding(validateLargeIntent(withHouse(0, {dress: {colour: '#e6e2da', surrounds: {storeys: [1], jamb: 0.25, head: 0.3}}})), facts(), {budget: 1e9});
  assert.ok(area(broad) >= area(thin), 'broad surround extent at least the thin one');
});

test('shutters: validated; a leaf each side of the windows of the house; absent draws none', async () => {
  assert.doesNotThrow(() => validateLargeIntent(withHouse(0, {dress: {colour: '#c4602a', shutters: {storeys: [1, 2], w: 0.45}}})));
  assert.throws(() => validateLargeIntent(withHouse(0, {dress: {shutters: {w: 0.9}}})), /shutters.w/);
  assert.throws(() => validateLargeIntent(withHouse(0, {dress: {shutters: {flaps: 2}}})), /shutters/);
  const dressMeshes = (b: ReturnType<typeof compileLargeBuilding>) => { let n = 0; b.group.traverse(o => { const m = o as T.Mesh; if (m.isMesh && /dress@g0h0/.test(m.name)) n += (m.geometry.index?.count ?? m.geometry.attributes.position.count); }); return n; };
  const none = compileLargeBuilding(validateLargeIntent(withHouse(0, {dress: {colour: '#c4602a', bands: {at: ['sill'], storeys: [1]}}})), facts(), {budget: 1e9});
  const withS = compileLargeBuilding(validateLargeIntent(withHouse(0, {dress: {colour: '#c4602a', bands: {at: ['sill'], storeys: [1]}, shutters: {storeys: [1]}}})), facts(), {budget: 1e9});
  assert.ok(dressMeshes(withS) > dressMeshes(none), 'shutters add dressing geometry');
});
