/**
 * Glazed tile panels (`tilePanels`, buildingRecipe/tileAccents.ts) on the Bellamybuurt tile-bay type, Hasebroekstraat 68
 * (086016, hasebroek-52-88): diamonds on the piers of storeys 1 and 3 in their measured tint, courses either side,
 * nothing on the windows; validation; a house without the key builds no tile meshes.
 *   node --import tsx --test src/canalRecall/buildingRecipe/tileAccents.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from './facts.ts';
import {compileBuilding} from './compile.ts';
import {validateIntent, type CanalHouseIntent} from './intent.ts';
import {storeyPiers, TILE_PANELS} from './tileAccents.ts';
import {resolvePlacement} from '../blockFace/houseType.ts';
import {defaultTypeLoader} from '../blockFace/typeLibrary.ts';

const PAND = '0363100012086016';
const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/block-face/faces/hasebroek-52-88/pands/${PAND}/facts.json`, 'utf8'));
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };

function house(withTiles = true): CanalHouseIntent {
  const t = defaultTypeLoader('bellamy-1915-tile-bay')!;
  const design = resolvePlacement(t, {type: t.id}, 'Hasebroekstraat').design;
  if (!withTiles) for (const f of design.fronts) delete f.tilePanels;
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: 'hasebroek-086016', pandId: PAND, address: 'Hasebroekstraat 68', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-12-11'}], ...design, notes: []} as CanalHouseIntent);
}

test('piers: the wall between windows and the front ends, narrow piers dropped', () => {
  assert.deepEqual(storeyPiers([{l: 0.5, r: 1.5}, {l: 3.3, r: 5.4}], 0, 6.4), [[0, 0.5], [1.5, 3.3], [5.4, 6.4]]);
  assert.deepEqual(storeyPiers([{l: 0.3, r: 1.5}], 0, 1.7), []);
  void TILE_PANELS;
});

test('validation: storeys above the ground, colours', () => {
  const base = house();
  const bad = (tp: unknown) => () => validateIntent({...base, fronts: base.fronts.map(f => ({...f, tilePanels: tp}))} as CanalHouseIntent);
  assert.throws(bad({storeys: [0], colour: '#e0bf80'}), /tilePanels.storeys/);
  assert.throws(bad({storeys: [1], colour: 'yellow'}), /tilePanels.colour/);
  assert.throws(bad({storeys: [1], colour: '#e0bf80', glaze: true}), /tilePanels/);
});

test('Hasebroekstraat 68: tile diamonds on storeys 1 and 3, measured tint, clear of the windows', async () => {
  const built = await compileBuilding(house(), facts);
  const tiles = meshes(built.group, /^tile-panels\/.*\/tiles$/), courses = meshes(built.group, /^tile-panels\/.*\/courses$/);
  assert.equal(tiles.length, 1);
  assert.equal(courses.length, 1);
  assert.equal(((tiles[0].material as T.MeshStandardMaterial).userData as {tintSource?: string}).tintSource, 'measured');
  assert.equal('#' + (tiles[0].material as T.MeshStandardMaterial).color.getHexString(), '#e0bf80');
  const diamonds = tiles[0].geometry.getAttribute('position').count / (3 * (2 + 8));
  assert.ok(diamonds >= 4, `diamonds ${diamonds}`);
  const without = await compileBuilding(house(false), facts);
  assert.equal(meshes(without.group, /^tile-panels/).length, 0);
});
