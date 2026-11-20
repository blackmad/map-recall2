// wallFeatures.ts (lane houthavens-memel-wiborg-20261120): more signs per group, framed glazed slots on a blank wall,
// white terrace floors over glazed storeys. Validated, drawn when asked, nothing when absent.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from '../buildingRecipe/largeIntent.ts';
import {compileLargeBuilding} from '../buildingRecipe/largeCompile.ts';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import type {LargeBuildingIntent} from '../buildingRecipe/intent.ts';

const DIR = 'scripts/building-recipes/houses/houthavens-249737';
const raw = (): LargeBuildingIntent => JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8'));
const facts = (): BuildingFacts => JSON.parse(fs.readFileSync(`${DIR}/facts.json`, 'utf8'));
const strip = (i: LargeBuildingIntent) => ({...i, walls: i.walls.map(w => { const {signs: _s, wallLights: _l, terraces: _t, ...rest} = w; return rest; })});
const opts = {budget: 1e9} as never;

test('signs / wallLights / terraces: validated', () => {
  const at = (extra: Record<string, unknown>, k = 0) => { const i = strip(raw()); i.walls[k] = {...i.walls[k], ...extra}; return i; };
  assert.doesNotThrow(() => validateLargeIntent(raw()));
  assert.throws(() => validateLargeIntent(at({signs: [{text: 'A', along: [0.1, 0.12], up: [0.5, 0.6]}]})), /signs\[0\].along/);
  assert.throws(() => validateLargeIntent(at({signs: [{text: 'A', along: [0.1, 0.9], up: [0.5, 0.6], colour: 'nope'}]})), /signs\[0\].colour/);
  assert.throws(() => validateLargeIntent(at({wallLights: [{along: [0.1, 0.5], up: [0, 0.5], lights: 12}]})), /wallLights\[0\].lights/);
  assert.throws(() => validateLargeIntent(at({terraces: {storeys: [0]}}, 4)), /terraces.storeys/);
  assert.throws(() => validateLargeIntent(at({terraces: {storeys: [3], deep: 5}}, 4)), /terraces.deep/);
});

test('signs / wallLights / terraces: drawn when asked; absent, none of them', () => {
  const on = compileLargeBuilding(validateLargeIntent(raw()), facts(), opts), off = compileLargeBuilding(validateLargeIntent(strip(raw())), facts(), opts);
  assert.equal(on.components.wallLights, 3);
  assert.ok((on.components.terraces ?? 0) > 10, `terraces ${on.components.terraces}`);
  assert.ok(on.components.letters > off.components.letters, 'FIGHT DISTRICT adds letters');
  assert.equal(off.components.wallLights, undefined); assert.equal(off.components.terraces, undefined);
  assert.ok(on.blockGates.floatingOk, 'no floating terrace or light parts');
});
