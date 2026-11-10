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
function house(type: string, face: string, pand: string, edit?: (f: Record<string, unknown>) => void): CanalHouseIntent {
  const t = defaultTypeLoader(type)!, street = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/intent.json`, 'utf8')).street as string, design = resolvePlacement(t, {type}, street).design;
  if (edit) design.fronts.forEach(edit as never);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `landlust-${pand}`, pandId: `0363100012${pand}`, address: 'Landlust', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-11-21'}], ...design} as never);
}
const dormers = (type: string, face: string, pand: string, edit?: (f: Record<string, unknown>) => void) => fitIntent(house(type, face, pand, edit), facts(face, pand)).recipe.elevations[0].dormers?.value ?? [];
const doors = (type: string, face: string, pand: string, edit?: (f: Record<string, unknown>) => void) => fitIntent(house(type, face, pand, edit), facts(face, pand)).recipe.elevations[0].openings.value.filter(o => o.kind === 'door' && o.bottomM < 0.5);

test('validation: zinc and stone bodies on a box dormer, brick still not; extraDoorBays needs a doorBay and other bays', () => {
  const base = house('landlust-1934-tile-pair', 'leijnsen-2-30-r1', '064868');
  const front = (patch: Record<string, unknown>) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.doesNotThrow(front({dormerBody: 'zinc'}));
  assert.doesNotThrow(front({dormerBody: 'stone'}));
  assert.throws(front({dormerBody: 'brick'}), /a box dormer is brick/);
  assert.throws(front({dormerBody: 'copper'}), /dormerBody: one of/);
  const slot = house('landlust-1935-slot-block-four', 'haen-6-62-r2', '084532');
  const sfront = (patch: Record<string, unknown>) => () => validateIntent({...slot, fronts: slot.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);
  assert.doesNotThrow(sfront({extraDoorBays: [3]}));
  assert.throws(sfront({extraDoorBays: []}), /extraDoorBays/);
  assert.throws(sfront({extraDoorBays: [2]}), /not the doorBay/);
  assert.throws(sfront({extraDoorBays: [3, 3]}), /extraDoorBays/);
  assert.throws(sfront({extraDoorBays: [9]}), /extraDoorBays/);
  assert.throws(sfront({doorBay: null, extraDoorBays: [3]}), /needs a doorBay/);
  assert.throws(sfront({doorPairs: 'yes'}), /doorPairs/);
});

test('zinc box dormer: one per pand on the tile-pair, three-axis and erker types, in the roof covering (white stone on the erker)', () => {
  for (const [type, face, pand, surface] of [['landlust-1934-tile-pair', 'leijnsen-2-30-r1', '064868', 'roof'], ['landlust-1933-erker-window', 'treslong-5-19-a', '151165', 'stone']] as const) {
    const d = dormers(type, face, pand);
    assert.equal(d.length, 1, type);
    assert.equal(d[0].wallSurface, surface, type);
    assert.ok(d[0].widthM > 1.6 && d[0].widthM < 2.6 && d[0].heightM === 1.3, `${type}: ${d[0].widthM} x ${d[0].heightM}`);
    assert.equal(dormers(type, face, pand, f => { for (const k of ['dormers', 'dormerStyle', 'dormerBody', 'dormerAt', 'dormerSize']) delete f[k]; }).length, 0, `${type} without the keys`);
  }
  assert.ok(dormers('landlust-1933-three-axis-tile', 'coppelstock-25-55-r1', fs.readdirSync('scripts/block-face/faces/coppelstock-25-55-r1/pands')[0].slice(10)).length === 1);
});

test('zinc dormer compiles: its cheeks and top are the roof surface material', async () => {
  const built = await compileBuilding(house('landlust-1934-tile-pair', 'leijnsen-2-30-r1', '064868'), facts('leijnsen-2-30-r1', '064868'));
  const names: string[] = []; built.group.traverse(o => { if (o instanceof T.Mesh && /dormer/.test(o.name)) names.push(o.name); });
  assert.ok(names.some(n => /left-wall/.test(n)) && names.some(n => /roof|top|cap/.test(n)), names.join(', '));
});

test('slot block: doorPairs + extraDoorBays give four doors in two pairs, a canopy slab over each pair; absent gives one door and no slab', async () => {
  const type = 'landlust-1935-slot-block-four', face = 'haen-6-62-r2', pand = '084532';
  const four = doors(type, face, pand);
  assert.deepEqual(four.map(o => o.id).sort(), ['door', 'door-2', 'door-b3', 'door-b3-2']);
  const byLeft = [...four].sort((a, b) => a.leftM - b.leftM);
  assert.ok(byLeft[1].leftM - (byLeft[0].leftM + byLeft[0].widthM) > 0.1, 'doors of a pair do not overlap');
  for (let i = 1; i < 4; i++) assert.ok(byLeft[i].leftM >= byLeft[i - 1].leftM + byLeft[i - 1].widthM, 'no overlapping doors');
  const one = doors(type, face, pand, f => { delete f.extraDoorBays; delete f.doorPairs; });
  assert.equal(one.length, 1);
  assert.equal(one[0].id, 'door');
  const count = async (edit?: (f: Record<string, unknown>) => void) => {
    const built = await compileBuilding(house(type, face, pand, edit), facts(face, pand));
    let n = 0; built.group.traverse(o => { if (o instanceof T.Mesh && o.name.startsWith('ground-canopy/')) n++; }); return n;
  };
  assert.equal(await count(), 1, 'one canopy mesh per front');
  assert.equal(await count(f => { delete f.groundCanopy; }), 0);
});
