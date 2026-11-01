/**
 * Transvaalbuurt 1929-1931 types (issue #153): the Tugelaweg 91-120 cream-render block with its grey stair panel
 * (`paintedStoreys.panels`) and the Vaalrivierstraat 1931 two-storey row resolve, validate and compile on the pands they
 * were measured on; the panel follows a mirror and takes its own measured colour.
 *   node --import tsx --test src/canalRecall/blockFace/transvaalbuurt1929.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {mirrorFront, resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const facts = (face: string, pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/${face}/pands/0363100012${pand}/facts.json`, 'utf8'));
function house(typeId: string, pand: string, street: string, mirror = false): CanalHouseIntent {
  const t = defaultTypeLoader(typeId)!;
  const design = resolvePlacement(t, {type: t.id, ...(mirror ? {mirror} : {})}, street).design;
  return validateIntent({schemaVersion: 1, kind: 'canal-house', id: `t-${pand}`, pandId: `0363100012${pand}`, address: street, sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2020-04-29'}], ...design, notes: []} as CanalHouseIntent);
}
const named = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };

test('1929 block: seven axes, cream upper storeys, the grey panel on the stair axis, a deep eaves slab', () => {
  const f = house('transvaal-1929-block', '075050', 'Tugelaweg').fronts[0];
  assert.equal(f.axisGrid, 7);
  assert.deepEqual(f.paintedStoreys?.storeys, [1, 2, 3]);
  assert.deepEqual(f.paintedStoreys?.panels, [{axis: 3, breadth: 2.0, colour: '#abaca5'}]);
  assert.equal(f.doorBay, 3);
  assert.equal(f.eavesOverhang?.projection, 0.9);
  // a panel off the centre moves to the mirrored axis
  assert.equal(mirrorFront({...f, paintedStoreys: {...f.paintedStoreys!, panels: [{axis: 1, breadth: 1, colour: '#abaca5'}]}}).paintedStoreys?.panels?.[0].axis, 5);
});

test('paintedStoreys.panels validation: axis on the grid, breadth range, colour', () => {
  const base = house('transvaal-1929-block', '075050', 'Tugelaweg');
  const bad = (panels: unknown) => { try { validateIntent({...base, fronts: [{...base.fronts[0], paintedStoreys: {...base.fronts[0].paintedStoreys!, panels}}]} as CanalHouseIntent); return ''; } catch (e) { return String(e); } };
  assert.match(bad([{axis: 7, breadth: 2, colour: '#abaca5'}]), /panels\[0\]\.axis/);
  assert.match(bad([{axis: 3, breadth: 9, colour: '#abaca5'}]), /panels\[0\]\.breadth/);
  assert.match(bad([{axis: 3, breadth: 2, colour: 'grey'}]), /panels\[0\]\.colour/);
  assert.match(bad([]), /non-empty/);
});

test('compile: Tugelaweg 95-96 and 93-94 carry the panel in its colour over the cream storeys; 113-114 mirrored', async () => {
  for (const [face, pand, mirror] of [['tugelaweg-91-112', '075050', false], ['tugelaweg-91-112', '144774', false], ['tugelaweg-113-120', '086731', true]] as const) {
    const built = await compileBuilding(house('transvaal-1929-block', pand, 'Tugelaweg', mirror), facts(face, pand));
    const panels = named(built.group, /painted-panel-0\//), storeys = named(built.group, /painted-storey-s\d\//);
    assert.ok(panels.length > 0, `${pand}: panel meshes`);
    assert.ok(storeys.length > 0, `${pand}: painted storeys`);
    assert.equal('#' + (panels[0].material as T.MeshStandardMaterial).color.getHexString(), '#abaca5');
    assert.equal('#' + (storeys[0].material as T.MeshStandardMaterial).color.getHexString(), '#cdc4a8');
  }
});

test('compile: Vaalrivierstraat 12 and 10 (mirrored) as the 1931 two-storey row; no panel meshes without panels', async () => {
  for (const [pand, mirror] of [['120724', false], ['090866', true]] as const) {
    const h = house('vaalrivier-1931-row', pand, 'Vaalrivierstraat', mirror);
    assert.equal(h.fronts[0].doorBay, mirror ? 3 : 0);
    const built = await compileBuilding(h, facts('vaalrivier-2-14', pand));
    assert.ok(built.group.children.length > 0);
    assert.equal(named(built.group, /painted-(panel|storey)/).length, 0);
  }
});
