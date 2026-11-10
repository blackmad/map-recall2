/**
 * Landlust kit round 3 (2026-11-10): the zinc box dormer body on the tiled-roof fronts (tile-pair, three-axis, erker) and
 * `extraDoorBays` + `doorPairs` under the existing `groundCanopy` slab on the slot blocks (Opus verdict
 * docs/reports/landlust-strip-verdict-20261110.md). Both are byte-identical when absent: the roof golden
 * (roofGolden.test.ts) compiles every other buurt's faces and changes only the Landlust runs that use these types.
 *   node --import tsx --test src/canalRecall/blockFace/landlustKit.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(type: string, face: string, pand: string, edit?: (f: Record<string, unknown>) => void, placement: Record<string, unknown> = {}): CanalHouseIntent {
  const t = defaultTypeLoader(type)!, street = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/intent.json`, 'utf8')).street as string, design = resolvePlacement(t, {type, ...placement} as never, street).design;
  if (edit) design.fronts.forEach(edit as never);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `landlust-${pand}`, pandId: `0363100012${pand}`, address: 'Landlust', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-11-21'}], ...design} as never);
}
const dormers = (type: string, face: string, pand: string, edit?: (f: Record<string, unknown>) => void, placement?: Record<string, unknown>) => fitIntent(house(type, face, pand, edit, placement), facts(face, pand)).recipe.elevations[0].dormers?.value ?? [];
const doors = (type: string, face: string, pand: string, edit?: (f: Record<string, unknown>) => void, placement?: Record<string, unknown>) => fitIntent(house(type, face, pand, edit, placement), facts(face, pand)).recipe.elevations[0].openings.value.filter(o => o.kind === 'door' && o.bottomM < 0.5);

test('validation: zinc and stone bodies on a box dormer, brick still not; extraDoorBays needs a doorBay and other bays', () => {
  const base = house('landlust-1934-tile-pair', 'leijnsen-2-30-r1', '064868');
  const front = (patch: Record<string, unknown>) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.doesNotThrow(front({dormerBody: 'zinc'}));
  assert.doesNotThrow(front({dormerBody: 'stone'}));
  assert.throws(front({dormerBody: 'brick'}), /a box dormer is brick/);
  assert.throws(front({dormerBody: 'copper'}), /dormerBody: one of/);
  const slot = house('landlust-1935-slot-block-four', 'haen-6-62-r2', '084532');
  const sfront = (patch: Record<string, unknown>) => () => validateIntent({...slot, fronts: slot.fronts.map(f => ({...f, doorRow: undefined, ...patch}))} as CanalHouseIntent);
  assert.doesNotThrow(sfront({extraDoorBays: [3]}));
  assert.throws(sfront({extraDoorBays: []}), /extraDoorBays/);
  assert.throws(sfront({extraDoorBays: [2]}), /not the doorBay/);
  assert.throws(sfront({extraDoorBays: [3, 3]}), /extraDoorBays/);
  assert.throws(sfront({extraDoorBays: [9]}), /extraDoorBays/);
  assert.throws(sfront({doorBay: null, extraDoorBays: [3]}), /needs a doorBay/);
  assert.throws(sfront({doorPairs: 'yes'}), /doorPairs/);
});

test('zinc box dormer: one per pand on the tile-pair, three-axis and erker types, in the roof covering (white stone on the erker)', () => {
  for (const [type, face, pand, surface] of [['landlust-1934-tile-pair', 'leijnsen-2-30-r1', '064868', 'roof']] as const) {
    const d = dormers(type, face, pand);
    assert.equal(d.length, 1, type);
    assert.equal(d[0].wallSurface, surface, type);
    assert.ok(d[0].widthM > 1.6 && d[0].widthM < 2.6 && d[0].heightM === 1.3, `${type}: ${d[0].widthM} x ${d[0].heightM}`);
    assert.equal(dormers(type, face, pand, f => { for (const k of ['dormers', 'dormerStyle', 'dormerBody', 'dormerAt', 'dormerSize']) delete f[k]; }).length, 0, `${type} without the keys`);
  }
  assert.ok(dormers('landlust-1933-three-axis-tile', 'coppelstock-25-55-r1', fs.readdirSync('scripts/block-face/faces/coppelstock-25-55-r1/pands')[0].slice(10)).length === 1);
});

test('erker pair crown: one dormer across a party wall, half on each pand, flush with the wall; the plain crown has none', () => {
  const t = 'landlust-1933-erker-window', f = 'treslong-5-19-a';
  const left = dormers(t, f, '151165', undefined, {crown: 'party-dormer', pair: 'left'}), right = dormers(t, f, '151495', undefined, {crown: 'party-dormer', pair: 'right', mirror: true});
  assert.equal(left.length, 1);
  assert.equal(right.length, 1);
  assert.equal(left[0].wallSurface, 'stone');
  assert.ok(Math.abs(left[0].widthM - right[0].widthM) < 1e-6 && left[0].widthM > 0.8 && left[0].widthM < 1.2, `${left[0].widthM}`);
  assert.equal(left[0].partyEdge, 'right');
  assert.equal(right[0].partyEdge, 'left');
  assert.equal(left[0].heightM, 1);
  assert.deepEqual(left[0].verticalBars, []);
  assert.ok(left[0].bottomM < 13 && left[0].bottomM > 9.5, `on the gutter line: ${left[0].bottomM}`);
  assert.equal(dormers(t, f, '151165').length, 0, 'the default crown has no dormer');
});

test('slot block crowns: two zinc box dormers per block; the parapet crown has none', () => {
  const t = 'landlust-1935-slot-block-four', f = 'haen-6-62-r2', p = '084532';
  const d = dormers(t, f, p, undefined, {crown: 'zinc-dormers'});
  assert.equal(d.length, 2);
  assert.ok(d.every(x => x.wallSurface === 'stone' && x.bodyColour === '#6f7275' && x.capColour === '#3e4144' && x.frontOverhangM === 0.15 && x.heightM === 1.5 && x.widthM > 2 && x.widthM < 2.8 && x.frontWall !== undefined && x.verticalBars?.length === 2), JSON.stringify(d.map(x => [x.leftM, x.widthM])));
  assert.equal(dormers(t, f, p, undefined, {crown: 'parapet'}).length, 0);
});

test('zinc dormer compiles: its cheeks and top are the roof surface material', async () => {
  const built = await compileBuilding(house('landlust-1934-tile-pair', 'leijnsen-2-30-r1', '064868'), facts('leijnsen-2-30-r1', '064868'));
  const names: string[] = []; built.group.traverse(o => { if (o instanceof T.Mesh && /dormer/.test(o.name)) names.push(o.name); });
  assert.ok(names.some(n => /left-wall/.test(n)) && names.some(n => /roof|top|cap/.test(n)), names.join(', '));
});

test('slot block: doorRow gives four 0.75 m doors side by side across 0.32-0.69 of the front under one slab; absent gives one door and no slab', async () => {
  const type = 'landlust-1935-slot-block-four', face = 'haen-6-62-r2', pand = '084532';
  const four = doors(type, face, pand);
  assert.deepEqual(four.map(o => o.id).sort(), ['door', 'door-2', 'door-3', 'door-4'], 'single leaves, no fanlight windows');
  const byLeft = [...four].sort((a, b) => a.leftM - b.leftM);
  assert.ok(byLeft.every(o => Math.abs(o.widthM - 0.75) < 0.02), JSON.stringify(byLeft.map(o => o.widthM)));
  for (let i = 1; i < 4; i++) assert.ok(byLeft[i].leftM >= byLeft[i - 1].leftM + byLeft[i - 1].widthM, 'no overlapping doors');
  const mirrored = doors(type, face, pand, undefined, {mirror: true}).sort((a, b) => a.leftM - b.leftM);
  assert.ok(Math.abs((mirrored[0].leftM + mirrored[3].leftM + mirrored[3].widthM) - (byLeft[0].leftM + byLeft[3].leftM + byLeft[3].widthM)) < 0.5, 'the row is near-symmetric');
  const one = doors(type, face, pand, f => { delete f.doorRow; });
  assert.equal(one.length, 1);
  assert.equal(one[0].id, 'door');
  const slabs = async (edit?: (f: Record<string, unknown>) => void) => {
    const built = await compileBuilding(house(type, face, pand, edit), facts(face, pand));
    const out: T.Box3[] = []; built.group.traverse(o => { if (o instanceof T.Mesh && o.name.startsWith('ground-canopy/')) { assert.equal(o.geometry.getAttribute('position').count, 30, 'one slab: five quads, got ' + o.geometry.getAttribute('position').count); out.push(new T.Box3().setFromBufferAttribute(o.geometry.getAttribute('position') as T.BufferAttribute)); } }); return out;
  };
  const withSlab = await slabs();
  assert.equal(withSlab.length, 1, 'one canopy mesh');
  const box = withSlab[0];
  assert.ok(box.max.x - box.min.x > 4.3, `one continuous slab across the four doors: ${box.max.x - box.min.x}`);
  assert.ok(box.min.y < Math.max(...four.map(o => o.bottomM + o.heightM)) + 0.2, `the slab rests on the door heads: ${box.min.y}`);
  assert.equal((await slabs(f => { delete f.groundCanopy; })).length, 0);
});

test('validation: doorRow ranges and exclusions', () => {
  const slot = house('landlust-1935-slot-block-four', 'haen-6-62-r2', '084532');
  const sfront = (patch: Record<string, unknown>) => () => validateIntent({...slot, fronts: slot.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.doesNotThrow(sfront({doorRow: {from: 0.3, to: 0.7, count: 4, leaf: 0.75}}));
  assert.throws(sfront({doorRow: {from: 0.3, to: 0.35, count: 4, leaf: 0.75}}), /doorRow/);
  assert.throws(sfront({doorRow: {from: 0.3, to: 0.7, count: 1, leaf: 0.75}}), /doorRow/);
  assert.throws(sfront({doorRow: {from: 0.3, to: 0.7, count: 4, leaf: 0.75}, doorPairs: true}), /doorRow/);
  assert.throws(sfront({doorRow: {from: 0.3, to: 0.7, count: 4, leaf: 0.75, gap: 1}}), /doorRow/);
});

test('extraDoorBays + doorPairs (kept for other blocks): four doors in two pairs, ids unique', () => {
  const type = 'landlust-1935-slot-block-four', face = 'haen-6-62-r2', pand = '084532';
  const d = doors(type, face, pand, f => { delete f.doorRow; f.extraDoorBays = [3]; f.doorPairs = true; });
  assert.deepEqual(d.map(o => o.id).sort(), ['door', 'door-2', 'door-b3', 'door-b3-2']);
});

test('painted-zinc and party-wall dormers compile: smooth measured materials, no cheek on the party side, one full-width post; absent keys change nothing', async () => {
  const names = (g: T.Object3D) => { const o: Record<string, T.Mesh> = {}; g.traverse(x => { if (x instanceof T.Mesh && x.name.startsWith('dormer/')) o[x.name] = x; }); return o; };
  const zinc = names((await compileBuilding(house('landlust-1935-slot-block-four', 'haen-6-62-r2', '084532', undefined, {crown: 'zinc-dormers'}), facts('haen-6-62-r2', '084532'))).group);
  const left = Object.entries(zinc).find(([n]) => /dormer-0\/left-wall$/.test(n))![1];
  assert.equal('#' + (left.material as T.MeshStandardMaterial).color.getHexString(), '#6f7275');
  assert.equal(((left.material as T.MeshStandardMaterial).userData as {tintSource?: string}).tintSource, 'measured');
  const cap = Object.entries(zinc).find(([n]) => /dormer-0\/roof-slab$/.test(n))![1];
  assert.equal('#' + (cap.material as T.MeshStandardMaterial).color.getHexString(), '#3e4144');
  const plain = names((await compileBuilding(house('landlust-1935-slot-block-four', 'haen-6-62-r2', '084532', f => { f.dormerBody = 'zinc'; delete f.dormerWindow; }, {crown: 'zinc-dormers'}), facts('haen-6-62-r2', '084532'))).group);
  const pl = Object.entries(plain).find(([n]) => /dormer-0\/left-wall$/.test(n))![1];
  assert.notEqual('#' + (pl.material as T.MeshStandardMaterial).color.getHexString(), '#6f7275', 'the plain zinc body keeps its surface slot colour');
  const half = names((await compileBuilding(house('landlust-1933-erker-window', 'treslong-5-19-a', '151165', undefined, {crown: 'party-dormer', pair: 'left'}), facts('treslong-5-19-a', '151165'))).group);
  assert.ok(!Object.keys(half).some(n => /right-wall$/.test(n)), 'no cheek on the party side');
  assert.ok(Object.keys(half).some(n => /left-wall$/.test(n)));
  const post = Object.entries(half).find(([n]) => /frame-right$/.test(n))![1], free = Object.entries(names((await compileBuilding(house('landlust-1933-erker-window', 'treslong-5-19-a', '151165', f => { delete f.dormerParty; }, {crown: 'party-dormer', pair: 'left'}), facts('treslong-5-19-a', '151165'))).group)).find(([n]) => /frame-right$/.test(n))![1];
  const wid = (m: T.Mesh) => { const b = new T.Box3().setFromBufferAttribute(m.geometry.getAttribute('position') as T.BufferAttribute); return b.max.x - b.min.x; };
  assert.ok(wid(post) > wid(free) + 0.02, `party post ${wid(post)} vs free ${wid(free)}`);
});
