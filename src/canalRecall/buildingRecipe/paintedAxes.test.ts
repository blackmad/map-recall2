/**
 * Painted storeys over part of a front (`paintedStoreys.axes`, PC Hooftstraat 86, 2026-11-22): one pand of two houses,
 * white stucco over the left three axes and brick on the right three. Validation; the facing spans only those bays;
 * absent = the whole width, and a front without it compiles byte-identically.
 *   node --import tsx --test src/canalRecall/buildingRecipe/paintedAxes.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createHash} from 'node:crypto';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';

const FACE = 'scripts/block-face/faces/hooft-80-112', PAND = '0363100012158320';
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${FACE}/pands/${PAND}/facts.json`, 'utf8'));
function house(edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const face = JSON.parse(fs.readFileSync(`${FACE}/intent.json`, 'utf8'));
  const h = face.houses.find((x: any) => x.pandId === PAND);
  const design = structuredClone(h.design);
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `paint-${PAND.slice(-6)}`, pandId: PAND, address: h.address, sources: face.sources, ...design, notes: []} as CanalHouseIntent);
}
const hashOf = (g: T.Object3D) => { const h = createHash('sha256'); g.traverse(o => { if (o instanceof T.Mesh) { h.update(o.name); h.update(Buffer.from(new Float32Array(Array.from(o.geometry.getAttribute('position').array as ArrayLike<number>)).buffer)); const m = o.material as T.MeshStandardMaterial; h.update(m.color?.getHexString() ?? ''); } }); return h.digest('hex'); };
/** World-space x extent of the painted-storey facings (their own measured paint colour). */
function paintedExtent(g: T.Object3D): [number, number] {
  g.updateMatrixWorld(true);
  const box = new T.Box3();
  g.traverse(o => { if (o instanceof T.Mesh && /painted-storey-s\d+/.test(o.name)) box.expandByObject(o); });
  assert.ok(!box.isEmpty(), 'painted facings exist');
  const size = box.getSize(new T.Vector3());
  return [Math.max(size.x, size.z), Math.min(size.x, size.z)];
}

test('validation: axes is [first, last] inside the grid and not the whole front', () => {
  assert.doesNotThrow(() => house());
  assert.throws(() => house(f => { f.paintedStoreys!.axes = [0, 5]; }), /paintedStoreys\.axes/);
  assert.throws(() => house(f => { f.paintedStoreys!.axes = [2, 1]; }), /paintedStoreys\.axes/);
  assert.throws(() => house(f => { f.paintedStoreys!.axes = [0, 9]; }), /paintedStoreys\.axes/);
  assert.throws(() => house(f => { (f.paintedStoreys as any).axes = 'left'; }), /paintedStoreys\.axes/);
});

test('PC Hooftstraat 86: the white paint covers the left three bays only; absent = the whole front, byte-identical', async () => {
  const f = facts();
  const whole = (fr: FrontIntent) => { delete fr.paintedStoreys!.axes; };
  const plain = await compileBuilding(house(whole), f), again = await compileBuilding(house(whole), f);
  assert.equal(hashOf(again.group), hashOf(plain.group));
  const half = await compileBuilding(house(), f);
  assert.notEqual(hashOf(half.group), hashOf(plain.group));
  const [wPlain] = paintedExtent(plain.group), [wHalf] = paintedExtent(half.group);
  assert.ok(wPlain > 11, `whole front painted (${wPlain.toFixed(2)} m)`);
  assert.ok(wHalf > 0.4 * wPlain && wHalf < 0.6 * wPlain, `about half painted (${wHalf.toFixed(2)} of ${wPlain.toFixed(2)} m)`);
});
