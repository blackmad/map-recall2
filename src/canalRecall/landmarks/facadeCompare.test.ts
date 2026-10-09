import test from 'node:test';
import assert from 'node:assert/strict';
import {compare, countPeaks, measureFacade, type MaterialSoup} from './facadeCompare';

/** A north-facing wall (normal -z, so bearing 0) at z = 0 with glass panes 2 cm proud of it. */
function wall(width: number, height: number, panes: {x: number; y: number; w: number; h: number}[]): MaterialSoup {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  const quad = (x0: number, y0: number, x1: number, y1: number, z: number, m: number) => {
    const b = positions.length / 3;
    positions.push(x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z);
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    triMaterial.push(m, m);
  };
  quad(0, 0, width, height, 0, 0);
  for (const p of panes) quad(p.x, p.y, p.x + p.w, p.y + p.h, -0.02, 1);
  return {positions, indices, triMaterial, materials: [{name: 'brick', rgb: [120, 60, 40]}, {name: 'glass', rgb: [80, 110, 120]}]};
}

const grid = (cols: number[], rows: number[]) => cols.flatMap(x => rows.map(y => ({x, y, w: 1.2, h: 1.6})));

test('counts openings per row and window axes on a regular grid', () => {
  const m = measureFacade(wall(12, 10, grid([1, 4, 7, 10 - 0.2], [1, 4, 7])), {name: 'n', bearing: 0});
  assert.deepEqual(m.rows, [4, 4, 4]);
  assert.equal(m.columns, 4);
});

test('glazing bars do not split one window into several', () => {
  const soup = wall(6, 5, [{x: 1, y: 1, w: 0.6, h: 1.6}, {x: 1.68, y: 1, w: 0.6, h: 1.6}, {x: 4, y: 1, w: 1.2, h: 1.6}]);
  assert.deepEqual(measureFacade(soup, {name: 'n', bearing: 0}).rows, [2]);
});

test('symmetric grid passes, scattered windows fail (Het Pakhuis rear, 2026-10-10)', () => {
  const sym = measureFacade(wall(12, 10, grid([1, 4, 6.8, 9.8], [1, 4, 7])), {name: 's', bearing: 0});
  assert.ok(sym.symmetry >= 0.7, `symmetric IoU ${sym.symmetry}`);
  const scattered = wall(12, 10, [{x: 0.5, y: 1, w: 1.2, h: 1.6}, {x: 2.2, y: 4, w: 1.2, h: 1.6}, {x: 5.1, y: 1, w: 1.2, h: 1.6}, {x: 8.9, y: 7, w: 1.2, h: 1.6}, {x: 6.3, y: 4, w: 1.2, h: 1.6}]);
  const f = {name: 'x', bearing: 0, symmetric: true, rows: [2, 2, 1]};
  const checks = compare(f, measureFacade(scattered, f));
  assert.equal(checks.find(c => c.what.startsWith('mirror'))!.pass, false);
  assert.equal(checks.find(c => c.what.startsWith('openings'))!.pass, true);
});

test('a facade facing away from the declared bearing sees no openings', () => {
  assert.deepEqual(measureFacade(wall(12, 10, grid([1, 4], [1])), {name: 's', bearing: 180}).rows, []);
});

test('gable peaks: five gables, ignoring a chimney', () => {
  const cell = 0.1, h: number[] = [];
  for (let x = 0; x < 200; x++) {
    const k = x % 40;
    h.push(10 + (k < 20 ? k : 40 - k) * 0.2 + (x === 105 ? 1 : 0));
  }
  assert.equal(countPeaks(h, cell, 1.5), 5);
  assert.equal(countPeaks(new Array(100).fill(10), cell, 1.5), 0);
});
