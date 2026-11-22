/**
 * Lettered window canopies (`windowCanopies`, PC Hooftstraat 101 Saint Laurent, 2024-12-11 strip): one canopy per
 * window of the storey, the name across each valance, faces wound outward; validation; absent = every other mesh the same.
 *   node --import tsx --test src/canalRecall/buildingRecipe/windowCanopies.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {canopySection, canopySpans, prism, WINDOW_CANOPY} from './windowCanopies.ts';

const FACE = 'hooft-101-105', PAND = '0363100012236916';
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/pands/${PAND}/facts.json`, 'utf8'));
function house(edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const h = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/intent.json`, 'utf8')).houses.find((x: {pandId: string}) => x.pandId === PAND);
  const design = structuredClone(h.design);
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'canopy-test', pandId: PAND, address: h.address, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-12-11'}], ...design, notes: []} as CanalHouseIntent);
}
const bad = (patch: unknown) => () => house(f => { f.windowCanopies = patch as never; });
const meshes = (g: T.Object3D) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh) out.push(o); }); return out; };

test('windowCanopies validation: storey, colour, sign and ranges', () => {
  assert.throws(bad({storey: 0, colour: '#1c1c1a'}), /windowCanopies.storey/);
  assert.throws(bad({storey: 9, colour: '#1c1c1a'}), /windowCanopies.storey/);
  assert.throws(bad({storey: 1, colour: 'black'}), /windowCanopies.colour/);
  assert.throws(bad({storey: 1, colour: '#1c1c1a', sign: {text: 'ÉCLAT', textColour: '#ffffff'}}), /sign.text/);
  assert.throws(bad({storey: 1, colour: '#1c1c1a', sign: {text: 'YSL'}}), /sign/);
  assert.throws(bad({storey: 1, colour: '#1c1c1a', projection: 3}), /projection/);
  assert.throws(bad({storey: 1, colour: '#1c1c1a', fringe: true}), /unknown field/);
  house(f => { f.windowCanopies = {storey: 1, colour: '#1c1c1a'}; });
});

test('prism faces are wound outward', () => {
  const v: number[] = [], sec = canopySection(7, WINDOW_CANOPY.projection, WINDOW_CANOPY.valance);
  prism(v, sec.valance, 1, 2);
  const c = [1.5, sec.valance.reduce((s, p) => s + p[1], 0) / 4, sec.valance.reduce((s, p) => s + p[0], 0) / 4];
  for (let i = 0; i < v.length; i += 9) {
    const a = new T.Vector3(v[i], v[i + 1], v[i + 2]), b = new T.Vector3(v[i + 3], v[i + 4], v[i + 5]), d = new T.Vector3(v[i + 6], v[i + 7], v[i + 8]);
    const n = b.clone().sub(a).cross(d.clone().sub(a)), m = a.clone().add(b).add(d).divideScalar(3).sub(new T.Vector3(...c));
    assert.ok(n.dot(m) > 0, `triangle ${i / 9} faces inward`);
  }
  assert.equal(v.length / 9, 12);
});

test('canopySpans: the storey\'s windows only, widened and kept inside the front', () => {
  const w = (id: string, l: number) => ({id, kind: 'window', leftM: l, widthM: 1.2, bottomM: 4, heightM: 2});
  const s = canopySpans([w('s1-b0', 0.05), w('s1-b1', 3), w('s2-b0', 0.05), {id: 'door', kind: 'door', leftM: 5, widthM: 1, bottomM: 0, heightM: 2}], 1, 0, 7);
  assert.equal(s.length, 2);
  assert.equal(s[0].x0, 0.02);
  assert.ok(Math.abs(s[1].x0 - 2.9) < 1e-9 && Math.abs(s[1].x1 - 4.3) < 1e-9 && s[1].head === 6);
});

test('Saint Laurent 101: three lettered canopies over the first floor; absent = every other mesh unchanged', async () => {
  const withC = await compileBuilding(house(), facts);
  const body = meshes(withC.group).filter(m => m.name.startsWith('window-canopies/'));
  assert.equal(body.length, 1);
  assert.equal(body[0].userData.surface, 'awning');
  assert.equal((body[0].material as T.MeshStandardMaterial).color.getHexString(), '1c1c1a');
  // two 4-sided prisms per canopy, 12 triangles each
  assert.equal(body[0].geometry.getAttribute('position').count / 72, 3);
  const letters = meshes(withC.group).filter(m => m.name === 'sign/lettering' && m.parent === body[0].parent);
  assert.ok(letters.some(m => (m.material as T.MeshStandardMaterial).color.getHexString() === 'f0ece4' && m.geometry.getAttribute('position').count > 100));
  const without = await compileBuilding(house(f => { delete f.windowCanopies; }), facts);
  const key = (g: T.Object3D) => meshes(g).filter(m => !m.name.startsWith('window-canopies/')).map(m => `${m.name}:${Array.from(m.geometry.getAttribute('position').array).map(x => x.toFixed(4)).join(',')}`);
  const a = key(withC.group), b = key(without.group);
  // with canopies there is exactly one more lettering mesh (the canopies'), the rest is identical
  assert.equal(a.length, b.length + 1);
  const rest = [...a]; for (const k of b) { const i = rest.indexOf(k); assert.ok(i >= 0, 'a mesh changed'); rest.splice(i, 1); }
  assert.equal(rest.length, 1);
  assert.match(rest[0], /^sign\/lettering:/);
});
