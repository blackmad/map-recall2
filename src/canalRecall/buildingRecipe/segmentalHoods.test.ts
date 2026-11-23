/**
 * Segmental window hoods (`segmentalHoods`, Cornelis Schuytstraat 9-15, 1897, 2022-03-21 strip): one white moulded hood
 * over each first-floor window, standing clear of the square window head on two ears; validation; faces wound outward;
 * absent = every other mesh the same.
 *   node --import tsx --test src/canalRecall/buildingRecipe/segmentalHoods.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {hoodGeometry, hoodSpans, SEGMENTAL_HOOD} from './segmentalHoods.ts';

const FACE = 'schuyt-7-15', PAND = '0363100012158436';
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/pands/${PAND}/facts.json`, 'utf8'));
function house(edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const h = JSON.parse(fs.readFileSync(`scripts/block-face/faces/${FACE}/intent.json`, 'utf8')).houses.find((x: {pandId: string}) => x.pandId === PAND);
  const design = structuredClone(h.design);
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'hood-test', pandId: PAND, address: h.address, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2022-03-21'}], ...design, notes: []} as CanalHouseIntent);
}
const bad = (patch: unknown) => () => house(f => { f.segmentalHoods = patch as never; });
const meshes = (g: T.Object3D) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh) out.push(o); }); return out; };

test('segmentalHoods validation: storeys and ranges', () => {
  assert.throws(bad({storeys: []}), /segmentalHoods.storeys/);
  assert.throws(bad({storeys: [9]}), /segmentalHoods.storeys/);
  assert.throws(bad({storeys: [1], rise: 2}), /segmentalHoods.rise/);
  assert.throws(bad({storeys: [1], proud: 0}), /segmentalHoods.proud/);
  assert.throws(bad({storeys: [1], keystone: true}), /unknown field/);
  house(f => { f.segmentalHoods = {storeys: [1], rise: 0.25, ears: 0}; });
});

test('hoodSpans: the listed storeys\' windows only, past each jamb, springing over the head', () => {
  const w = (id: string, l: number, b = 5) => ({id, kind: 'window', leftM: l, widthM: 1.2, bottomM: b, heightM: 2});
  const s = hoodSpans([w('s1-b0', 0.5), w('s1-b1', 3), w('s2-b0', 0.5, 9), {id: 'door', kind: 'door', leftM: 5, widthM: 1, bottomM: 0, heightM: 2}], {storeys: [1]});
  assert.equal(s.length, 2);
  assert.ok(Math.abs(s[0].x0 - (0.5 - SEGMENTAL_HOOD.past)) < 1e-9 && Math.abs(s[1].x1 - (4.2 + SEGMENTAL_HOOD.past)) < 1e-9);
  assert.ok(Math.abs(s[0].spring - (7 + SEGMENTAL_HOOD.gap)) < 1e-9);
});

test('hood geometry: closed hexahedra wound outward, crown higher than the springing, ears optional', () => {
  const span = {x0: 0, x1: 1.4, spring: 7};
  const v = hoodGeometry(span, {storeys: [1]});
  assert.equal(v.length / 9, (SEGMENTAL_HOOD.segments + 2) * 12);
  assert.equal(hoodGeometry(span, {storeys: [1], ears: 0}).length / 9, SEGMENTAL_HOOD.segments * 12);
  // every hexahedron (12 triangles) is wound outward from its own centre
  for (let h = 0; h < v.length; h += 108) {
    const pts: T.Vector3[] = []; for (let i = h; i < h + 108; i += 3) pts.push(new T.Vector3(v[i], v[i + 1], v[i + 2]));
    const c = pts.reduce((a, p) => a.add(p), new T.Vector3()).divideScalar(pts.length);
    for (let t = 0; t < 36; t += 3) {
      const [a, b, d] = [pts[t], pts[t + 1], pts[t + 2]];
      const n = b.clone().sub(a).cross(d.clone().sub(a)), m = a.clone().add(b).add(d).divideScalar(3).sub(c);
      assert.ok(n.dot(m) > 0, `hexahedron ${h / 108} triangle ${t / 3} faces inward`);
    }
  }
  const ys = []; for (let i = 1; i < v.length; i += 3) ys.push(v[i]);
  assert.ok(Math.abs(Math.max(...ys) - (7 + SEGMENTAL_HOOD.rise + SEGMENTAL_HOOD.height)) < 1e-6);
  assert.ok(Math.abs(Math.min(...ys) - (7 - SEGMENTAL_HOOD.ears)) < 1e-6);
});

test('Cornelis Schuytstraat 9: three stone hoods over the first floor; absent = every other mesh unchanged', async () => {
  const withH = await compileBuilding(house(), facts);
  const body = meshes(withH.group).filter(m => m.name.startsWith('segmental-hoods/'));
  assert.equal(body.length, 1);
  assert.equal(body[0].userData.surface, 'stone');
  assert.equal(body[0].geometry.getAttribute('position').count / ((SEGMENTAL_HOOD.segments + 2) * 36), 3);
  const without = await compileBuilding(house(f => { delete f.segmentalHoods; }), facts);
  const key = (g: T.Object3D) => meshes(g).filter(m => !m.name.startsWith('segmental-hoods/')).map(m => `${m.name}:${Array.from(m.geometry.getAttribute('position').array).map(x => x.toFixed(4)).join(',')}`);
  assert.deepEqual(key(withH.group).sort(), key(without.group).sort());
});
