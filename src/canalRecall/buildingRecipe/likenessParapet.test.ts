import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modelElevation, PARAPET_GLASS} from './likeness.ts';
import {MASK} from './measureFacade.ts';
import type {MaterialSoup} from '../landmarks/facadeCompare.ts';

// #134: a glass balustrade in front of the wall reads wall-like in the photo (Mary van der Sluisstraat 247342 walls[1]:
// photo 0.18 glazing, model 0.41 with `rail: glass` balcony spans), so the likeness elevation reads proud parapet glass as
// trim; windows in or behind the plane stay glazing, and so does proud glass outside the rail zone (no parapet there).
test('modelElevation: proud parapet glass in the rail zone is trim, recessed windows and high proud glass stay glazing', () => {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  // a quad in the plane z (x east, y up; the panel faces south, +z): material m
  const quad = (x0: number, x1: number, y0: number, y1: number, z: number, m: number) => {
    const b = positions.length / 3; positions.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z); indices.push(b, b + 1, b + 2, b, b + 2, b + 3); triMaterial.push(m, m);
  };
  quad(0, 10, 0, 10, 0, 0);            // the brick wall
  quad(1, 3, 4.5, 6.5, 0.05, 1);       // a window, storey 1 (the soup has no hole: just in front of the wall)
  quad(1, 3, 3.6, 4.3, 0.05, 1);       // a low window inside the rail zone, in the plane: still glazing
  quad(5, 9, 3.6, 4.6, 0.5, 1);        // a glass balustrade 0.5 m proud, over the storey line at 3.5 m
  quad(5, 9, 5.5, 6.5, 0.5, 1);        // proud glass 2 m over the line: not a parapet
  const soup: MaterialSoup = {positions, indices, triMaterial, materials: [
    {name: 'brick', rgb: [150, 82, 62], materialSlot: 'brick', tint: '#96523e'},
    {name: 'glass', rgb: [60, 70, 80], materialSlot: 'glass', tint: '#3c4650'}]};
  const lines = [0, 3.5, 7, 10], box = {u0: 0, u1: 10, v0: 0, v1: 10};
  const panel = {o: [0, 0, 0], r: [1, 0, 0], n: [0, 0, 1], uMin: 0, uMax: 10}, m = modelElevation(soup, panel, box, lines, 0.1, undefined, 1.5, undefined, true);
  const at = (u: number, v: number) => m.mask[Math.floor((box.v1 - v) / 0.1) * m.cols + Math.floor(u / 0.1)];
  assert.equal(at(7, 4.0), MASK.trim, 'parapet glass');
  assert.equal(at(2, 5.5), MASK.dark, 'window');
  assert.equal(at(2, 4.0), MASK.dark, 'a window in the plane, in the rail zone');
  assert.equal(at(7, 6.0), MASK.dark, 'proud glass above the rail zone');
  assert.equal(at(4, 8), MASK.wall, 'wall');
  assert.ok(PARAPET_GLASS.railM >= 1 && PARAPET_GLASS.proudM > 0);
  // a group without balcony bands reads the same glass as glazing (byte-identical likeness for every other group)
  assert.equal(modelElevation(soup, panel, box, lines, 0.1).mask[Math.floor((box.v1 - 4.0) / 0.1) * m.cols + 70], MASK.dark, 'no parapets without balcony bands');
});
