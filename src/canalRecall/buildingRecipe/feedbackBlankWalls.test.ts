/**
 * Named regressions for the 2026-11-14 "no windows" feedback on build 2cd2fb7 (lane blank-walls-20261114):
 *  - 21dc1e32 "why this wall so washed out?": Buitenzagerij 45 (pand 0363100012100112), the gallery-access spine along
 *    Het Dok drew as one windowless buff plane (large recipe, `otherWalls: 'blank'`);
 *  - 174d2455 "no windows, really?": the Kromhout works, Gedempt Hamerkanaal 209 (pand 0363100012243116), its west
 *    walls across the Johan van Hasseltkanaal drew as windowless red brick (large recipe, `otherWalls: 'blank'`);
 *  - 9aa8d03b "no windows, reallly?": Brandweerkazerne Hendrik (landmark fire-station-hendrik, pand 0363100012169391),
 *    its curved west wall on the Singelgracht (ring edges 8-13) was blank brick.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {compileLargeBuilding} from './largeCompile.ts';
import {WINDOW_GRID_WALL_SLOT} from './fitLarge.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {buildFireStationHendrik} from '../../../scripts/landmarks/fire-station-hendrik-builder.ts';

const meshes = (g: any) => { const out: any[] = []; g.traverse((o: any) => { if (o.isMesh) out.push(o); }); return out; };
const triangles = (g: any) => meshes(g).reduce((n, m) => n + m.geometry.getAttribute('position').count / 3, 0);
const house = (id: string) => {
  const dir = `scripts/building-recipes/houses/${id}`;
  return {intent: validateLargeIntent(JSON.parse(readFileSync(`${dir}/intent.json`, 'utf8'))), facts: JSON.parse(readFileSync(`${dir}/facts.json`, 'utf8'))};
};

for (const id of ['buitenzagerij-45-100112', 'hamerkanaal-209-243116']) {
  test(`${id}: the unphotographed walls carry the window grid, at no triangle cost`, () => {
    const {intent, facts} = house(id);
    const grid = compileLargeBuilding(intent, facts);
    const wall = meshes(grid.group).find(m => m.name === `wall/${WINDOW_GRID_WALL_SLOT}`);
    assert.ok(wall, 'the unlisted walls have the window-grid mesh');
    assert.equal(wall.material.userData.windowGrid, true);
    assert.ok(triangles(grid.group) <= grid.budgetTriangles);
    const blind = compileLargeBuilding(validateLargeIntent({...intent, otherWalls: 'blank', blankWalls: {source: intent.sources[0].id}}), facts);
    assert.equal(triangles(grid.group), triangles(blind.group));
  });
}

test('buitenzagerij-45-100112: the Het Dok spine is a photographed group (panorama w15-339) and the card names Noord, not the Jordaan', () => {
  const {intent} = house('buitenzagerij-45-100112');
  const spine = intent.walls.find(w => w.wallSurfaces.includes(47) && w.wallSurfaces.includes(185));
  assert.ok(spine && spine.system === 'brick-bay-grid' && (spine.storeys ?? 0) >= 3 && spine.balconyBands);
  assert.match(intent.address, /Amsterdam-Noord/);
  assert.doesNotMatch(intent.address, /Jordaan/);
});

test('hamerkanaal-209-243116: the west walls are metal-clad groups from the 2025-09-04 panoramas', () => {
  const {intent} = house('hamerkanaal-209-243116');
  for (const s of [176, 412, 14, 30]) {
    const g = intent.walls.find(w => w.wallSurfaces.includes(s));
    assert.equal(g?.wallFamily?.kind, 'metal', `surface ${s}`);
  }
});

test('fire-station-hendrik: the curved Singelgracht wall (edges 8-13) has glazing on its upper storeys', () => {
  const glass: T.Vector3[] = [];
  const add = (g: T.BufferGeometry, c: string, x = 0, y = 0, z = 0, a = 0) => {
    g.rotateY(a); g.translate(x, y, z);
    if (c === 'glass') { g.computeBoundingBox(); glass.push(g.boundingBox!.getCenter(new T.Vector3())); }
    return new T.Mesh(g);
  };
  const b = {add, box(x: number, y: number, z: number, w: number, h: number, d: number, c: string, a = 0) { return add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, a); }} as any;
  buildFireStationHendrik(46, 57.6, b);
  // the curved wall's plan box (builder frame: x east, z south), upper storeys only
  const west = glass.filter(p => p.x > -10 && p.x < -5 && p.z > -22.5 && p.z < -12.5 && p.y > 5);
  assert.ok(west.length >= 12, `${west.length} panes on the curved west wall`);
});
