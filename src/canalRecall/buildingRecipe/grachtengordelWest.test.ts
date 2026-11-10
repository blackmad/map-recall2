/**
 * Canal-belt kit (lane belt-gg-west 2026-11-10): attic lights in an entablature frieze (`friezeVents.sill` +
 * `friezeVents.light`), measured on Herengracht 92 and 94 (2021-01-25 strip). Validated, drawn as one dark light per
 * top-storey axis inside the frieze, and a front without the key (or with the Helmersbuurt `drop` form) is unchanged.
 *   node --import tsx --test src/canalRecall/buildingRecipe/grachtengordelWest.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import {resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';
import {ENTABLATURE} from './entablature.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/${pand}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };

function house(edit?: (f: FrontIntent) => void): CanalHouseIntent {
  const t = defaultTypeLoader('ggw-1740-frieze-cornice')!;
  const design = resolvePlacement(t, {type: t.id}, 'Herengracht').design;
  if (edit) design.fronts.forEach(edit);
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'herengracht-175700', pandId: '0363100012175700', address: 'Herengracht 92', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2021-01-25'}], ...design, notes: []} as CanalHouseIntent);
}
const bad = (h: CanalHouseIntent, patch: Partial<FrontIntent>) => () => validateIntent({...h, fronts: h.fronts.map(f => ({...f, ...patch}))} as CanalHouseIntent);

test('frieze attic lights: validation of sill/light/drop', () => {
  const h = house();
  const fv = h.fronts[0].friezeVents!;
  assert.throws(bad(h, {friezeVents: {...fv, drop: 0.2}}), /one of drop .* or sill/);
  assert.throws(bad(h, {friezeVents: {span: 1.1, rise: 0.45}}), /one of drop .* or sill/);
  assert.throws(bad(h, {friezeVents: {...fv, sill: 2.0}}), /friezeVents.sill/);
  assert.throws(bad(h, {friezeVents: {...fv, slot: true}}), /light or slot/);
  assert.throws(bad(h, {friezeVents: {...fv, span: 0.15}}), /friezeVents.light/);
  assert.throws(bad(h, {entablature: undefined, cornice: 'simple'}), /needs an entablature/);
});

test('frieze attic lights: one dark light per axis inside the entablature frieze of Herengracht 92; none without the key', async () => {
  const f = facts('herengracht-84-148', '0363100012175700');
  const built = await compileBuilding(house(), f);
  const panels = meshes(built.group, /^frieze-vents\/.*\/panels$/), lights = meshes(built.group, /^frieze-vents\/.*\/lights$/);
  assert.equal(panels.length, 1);
  assert.equal(lights.length, 1);
  assert.equal(lights[0].userData.surface, 'door');
  assert.equal(lights[0].geometry.getAttribute('position').count, 3 * 30, 'three lights of 5 faces');
  assert.equal(panels[0].geometry.getAttribute('position').count, 3 * 4 * 30, 'a frame of four bars round each light');
  // The lights stand in the frieze: their foot is the entablature foot + sill, their face proud of the frieze face.
  const box = new T.Box3().setFromBufferAttribute(lights[0].geometry.getAttribute('position') as T.BufferAttribute);
  const p = new T.Box3().setFromBufferAttribute(panels[0].geometry.getAttribute('position') as T.BufferAttribute);
  assert.ok(box.max.z > ENTABLATURE.friezeDepthM, 'pane in front of the frieze face');
  assert.ok(Math.abs((box.min.y - p.min.y) - 0.07) < 1e-3 && Math.abs((p.max.y - p.min.y) - 0.45) < 1e-3, 'a 0.45 m frame, the pane 7 cm inside its edge');
  assert.ok(p.max.z - box.max.z >= 0.035 - 1e-6 && box.max.z - ENTABLATURE.friezeDepthM >= 0.035 - 1e-6, 'frame, pane and frieze faces 3.5 cm apart');
  const without = await compileBuilding(house(fr => { delete fr.friezeVents; }), f);
  assert.equal(meshes(without.group, /^frieze-vents/).length, 0);
});

test('resizePerStorey keeps a souterrain weight first (a cornice house of four storeys drawn with three)', async () => {
  const {resizePerStorey} = await import('../blockFace/houseType.ts');
  const body = {bays: 3, storeyHeights: [1.9, 4.0, 3.05, 2.65, 2.6], windowHeights: [0.82, 0.79, 0.68, 0.65], headLines: [0.875, 0.885, 0.81, 0.81]};
  const three = resizePerStorey(body, 4, 3);
  assert.deepEqual(three.storeyHeights, [1.9, 4.0, 3.05, 2.6]);
  assert.deepEqual(three.windowHeights, [0.82, 0.79, 0.65]);
  assert.deepEqual(resizePerStorey({bays: 3, storeyHeights: [3, 2, 2]}, 3, 4).storeyHeights, [3, 2, 2, 2], 'a list without a souterrain entry is unchanged in behaviour');
});
