/**
 * Lettering on a fabric awning (`shopfront.sign.mount: 'awning'`, Van Baerlestraat 46, Ace & Dik, 2024-12-11 strip): the
 * name lies on the straight awning's sloped top, on a dutch awning's valance; validation; every other mesh unchanged.
 *   node --import tsx --test src/canalRecall/buildingRecipe/awningSign.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';

const FACE = 'baerle-32-50', PAND = '0363100012237282';
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/pands/${PAND}/facts.json`, 'utf8'));
function house(edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const h = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/intent.json`, 'utf8')).houses.find((x: {pandId: string}) => x.pandId === PAND);
  const design = structuredClone(h.design);
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'awning-sign-test', pandId: PAND, address: h.address, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-12-11'}], ...design, notes: []} as CanalHouseIntent);
}
const meshes = (g: T.Object3D) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh) out.push(o); }); return out; };
const lettering = (g: T.Object3D) => meshes(g).filter(m => m.name === 'sign/lettering');
const box = (m: T.Mesh) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox!; };

test('awning sign validation: needs a fabric awning; a fascia board may stay behind it', () => {
  assert.throws(() => house(f => { f.shopfront!.awning = undefined; }), /awning-mounted sign needs a fabric awning/);
  assert.throws(() => house(f => { f.shopfront!.awning = {style: 'rigid', colour: '#6e665e'}; }), /awning-mounted sign needs a fabric awning/);
  house(f => { f.shopfront!.awning!.style = 'fabric-dutch'; });
});

test('Ace & Dik: the lettering lies on the straight awning\'s slope; on a dutch awning it stands on the valance', async () => {
  const straight = lettering((await compileBuilding(house(), facts)).group);
  assert.equal(straight.length, 1);
  const b = box(straight[0]);
  // tilted: the letters run back toward the wall as they rise (the awning drops 0.5 m over 1.0 m)
  assert.ok(b.max.z - b.min.z > 0.15, `depth ${b.max.z - b.min.z}`);
  assert.ok(b.max.y - b.min.y < 0.3, `height ${b.max.y - b.min.y}`);
  const dutch = lettering((await compileBuilding(house(f => { f.shopfront!.awning!.style = 'fabric-dutch'; }), facts)).group);
  const d = box(dutch[0]);
  assert.ok(d.max.z - d.min.z < 0.05 && d.min.z > 0.85, `upright on the valance 0.9 m out: z ${d.min.z}..${d.max.z}`);
});

test('awning sign absent = every other mesh the same', async () => {
  const key = (g: T.Object3D) => meshes(g).filter(m => m.name !== 'sign/lettering').map(m => `${m.name}:${Array.from(m.geometry.getAttribute('position').array).map(x => x.toFixed(4)).join(',')}`);
  const a = key((await compileBuilding(house(), facts)).group), b = key((await compileBuilding(house(f => { delete f.shopfront!.sign; }), facts)).group);
  assert.deepEqual(a.sort(), b.sort());
});
