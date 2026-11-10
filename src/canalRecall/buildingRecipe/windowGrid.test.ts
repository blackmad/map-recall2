/**
 * `otherWalls: 'window-grid'` (lane newbuild-kit-20261110, feedback 75242f30 "why no windows" at Houthavenkade 26): the
 * unlisted walls stay blank geometry, take their own slot and carry `windowGrid` for the city look's shader grid.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileLargeBuilding} from './largeCompile.ts';
import {WINDOW_GRID_WALL_SLOT} from './fitLarge.ts';
import {validateLargeIntent} from './largeIntent.ts';

const HOUSE = 'scripts/building-recipes/houses/houthavenkade-26-247232';
const intent = JSON.parse(readFileSync(`${HOUSE}/intent.json`, 'utf8'));
const facts = JSON.parse(readFileSync(`${HOUSE}/facts.json`, 'utf8'));
const triangles = (g: any) => { let n = 0; g.traverse((o: any) => { if (o.isMesh) n += o.geometry.getAttribute('position').count / 3; }); return n; };
const meshes = (g: any) => { const out: any[] = []; g.traverse((o: any) => { if (o.isMesh) out.push(o); }); return out; };

test('window-grid validates; an unknown otherWalls does not', () => {
  assert.doesNotThrow(() => validateLargeIntent({...intent, otherWalls: 'window-grid'}));
  assert.throws(() => validateLargeIntent({...intent, otherWalls: 'window-grids'}), /otherWalls/);
});

test('window-grid adds no triangle and moves the unlisted walls to their own windowGrid slot (Houthavenkade 26)', () => {
  const blank = compileLargeBuilding(validateLargeIntent({...intent, otherWalls: 'blank'}), facts);
  const grid = compileLargeBuilding(validateLargeIntent({...intent, otherWalls: 'window-grid'}), facts);
  assert.equal(triangles(grid.group), triangles(blank.group));
  assert.ok(triangles(grid.group) <= grid.budgetTriangles, `${triangles(grid.group)} > ${grid.budgetTriangles}`);
  const gridWall = meshes(grid.group).find(m => m.name === `wall/${WINDOW_GRID_WALL_SLOT}`);
  assert.ok(gridWall, 'the unlisted walls have their own mesh');
  assert.equal(gridWall.material.userData.windowGrid, true);
  assert.equal(gridWall.userData.materialSlot, meshes(blank.group).find(m => m.name === 'wall/wall')!.userData.materialSlot);
  assert.equal(grid.recipe.spec.palette[WINDOW_GRID_WALL_SLOT], grid.recipe.spec.palette.wall);
  // Absent: nothing carries the slot or the extra.
  assert.ok(!meshes(blank.group).some(m => m.name.includes(WINDOW_GRID_WALL_SLOT) || m.material.userData?.windowGrid));
  assert.equal(blank.recipe.other.windowGrid, undefined);
});
