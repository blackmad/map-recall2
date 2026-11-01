/**
 * Museumkwartier, Hondecoeterbuurt 1910-1911 glazed-oriel rows (#160): the type compiles on the pands it was measured on
 * (Wouwermanstraat 14 with the tower dormer, 22 with the pediment dormer), the kit's corbelled oriel console hangs under
 * the console slab in stepped courses, and an oriel without it is unchanged.
 *   node --import tsx --test src/canalRecall/blockFace/museumkwartierHondecoeter.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {validateIntent, ORIEL, type CanalHouseIntent} from '../buildingRecipe/intent.ts';
import {resolvePlacement} from './houseType.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const TYPE = 'museum-hc-1910-glazed-oriel';
const facts = (pand: string): BuildingFacts => JSON.parse(fs.readFileSync(`scripts/block-face/faces/wouwerman-2-44/pands/0363100012${pand}/facts.json`, 'utf8'));
function raw(pand: string, crown?: string, edit = (f: any) => f) {
  const t = defaultTypeLoader(TYPE)!;
  const design = resolvePlacement(t, {type: t.id, ...(crown ? {crown} : {})}, 'Wouwermanstraat').design;
  return edit({schemaVersion: 1, kind: 'canal-house', id: `hc-${pand}`, pandId: `0363100012${pand}`, address: 'Wouwermanstraat', sources: [{id: 'strip', kind: 'street-panorama', capturedAt: '2024-11-06'}], ...design, notes: []});
}
const house = (pand: string, crown?: string, edit?: (f: any) => any) => validateIntent(raw(pand, crown, edit)) as CanalHouseIntent;
const meshes = (g: T.Object3D, re: RegExp) => { const out: T.Mesh[] = []; g.traverse(o => { if (o instanceof T.Mesh && re.test(o.name)) out.push(o); }); return out; };
const intentProblems = (i: unknown): string[] => { try { validateIntent(i); return []; } catch (e) { return (e as Error).message.split('\n'); } };
const noCorbel = (f: any) => ({...f, fronts: f.fronts.map((x: any) => ({...x, bayWindows: {...x.bayWindows, oriel: (({consoleCorbel, ...o}: any) => o)(x.bayWindows.oriel)}}))});

test('Wouwermanstraat 14 and 22: four storeys, the oriel on storey 2 with its corbel, the tower or the pediment dormer', async () => {
  for (const [pand, crown] of [['138798', undefined], ['107749', 'pediment-dormer']] as const) {
    const h = house(pand, crown), f = h.fronts[0];
    assert.deepEqual(f.storeyHeights, [4.3, 3.45, 3.1, 3.55]);
    assert.deepEqual(f.bayWindows?.storeys, [2]);
    assert.deepEqual(f.bayWindows?.oriel?.consoleCorbel, {rise: 0.5, steps: 3, colour: '#6a6258'});
    assert.equal(!!f.tower, crown === undefined);
    assert.equal(f.dormerStyle, crown ? 'pediment' : undefined);
    const b = await compileBuilding(h, facts(pand));
    assert.equal(meshes(b.group, /^oriel-console\//).length, 1);
    const [corbel] = meshes(b.group, /^oriel-corbel\//);
    assert.ok(corbel, `${pand}: corbel mesh`);
    corbel.geometry.computeBoundingBox();
    const bb = corbel.geometry.boundingBox!, e = b.fit.fronts[0].erker!, top = e.oriel!.footM - ORIEL.consoleM;
    assert.ok(Math.abs(bb.max.y - (top - 0.002)) < 1e-3 && Math.abs(bb.min.y - (top - 0.5)) < 1e-3, `${pand}: courses ${bb.min.y}-${bb.max.y} under the slab at ${top}`);
    assert.ok(bb.min.x > e.leftM && bb.max.x < e.leftM + e.widthM, 'inside the slab ends');
    assert.equal(corbel.userData.surface, 'accent');
  }
});

test('oriel corbel: absent is byte-identical, problems name the bad fields', async () => {
  const a = await compileBuilding(house('083474'), facts('083474')), b = await compileBuilding(house('083474', undefined, noCorbel), facts('083474'));
  assert.equal(meshes(b.group, /^oriel-corbel\//).length, 0);
  const strip = (r: typeof a) => JSON.stringify({recipe: r.recipe, fit: {...r.fit, fronts: r.fit.fronts.map(f => ({...f, erker: f.erker && {...f.erker, oriel: f.erker.oriel && (({consoleCorbel, ...o}) => o)(f.erker.oriel)}}))}});
  assert.equal(strip(a), strip(b));
  const names = (r: typeof a) => { const n: string[] = []; r.group.traverse(o => { if (!/^oriel-corbel\//.test(o.name)) n.push(o.name); }); return n.join('|'); };
  assert.equal(names(a), names(b));
  const bad = (c: unknown) => intentProblems(raw('083474', undefined, f => ({...f, fronts: f.fronts.map((x: any) => ({...x, bayWindows: {...x.bayWindows, oriel: {...x.bayWindows.oriel, consoleCorbel: c}}}))})));
  assert.ok(bad({rise: 3}).some(p => /consoleCorbel/.test(p)));
  assert.ok(bad({rise: 0.5, steps: 9}).some(p => /consoleCorbel/.test(p)));
  assert.ok(bad({rise: 0.5, colour: 'grey'}).some(p => /consoleCorbel/.test(p)));
  assert.deepEqual(bad({rise: 0.5}).filter(p => /consoleCorbel/.test(p)), []);
  const noConsole = intentProblems(raw('083474', undefined, f => ({...f, fronts: f.fronts.map((x: any) => ({...x, bayWindows: {...x.bayWindows, oriel: {...x.bayWindows.oriel, console: false}}}))})));
  assert.ok(noConsole.some(p => /consoleCorbel: needs console/.test(p)));
});
