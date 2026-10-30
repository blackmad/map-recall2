import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixedFillTower, type HeightCell } from './mixedFillTowers';

// A 10 x 40 m outline on a 0.5 m grid: ground over most of it, a street front of `front` m depth at 17.6 m.
const outline = (front: number, frontM = 17.6): HeightCell[] => {
  const cells: HeightCell[] = [];
  for (let x = 0.25; x < 10; x += 0.5) for (let y = 0.25; y < 40; y += 0.5) cells.push([x, y, y > 40 - front ? frontM : 0.3]);
  return cells;
};

test('Overtoom: a tall street front over a garden becomes a tower from the fill top', () => {
  const t = mixedFillTower(outline(11), 4.9);
  assert.ok(t);
  assert.equal(t.heightM, 17.6);
  assert.equal(t.areaM2, 110);
  assert.ok(t.fill > 0.95, `fill ${t.fill}`);
});

test('a front too small, or not tall enough over the box, is no tower', () => {
  assert.equal(mixedFillTower(outline(3), 4.9), null, '30 m2: a neighbour wall');
  assert.equal(mixedFillTower(outline(11, 12), 4.9), null, '12 m is roof furniture over a 4.9 m box');
});

test('a scattered tree crown is no tower', () => {
  const cells = outline(0);
  // Every other cell over 15 x 15 m: plenty of area in total, but none of it connected.
  for (const c of cells) if (c[1] < 15 && c[0] < 10 && (Math.round(c[0] * 2) + Math.round(c[1] * 2)) % 2 === 0) c[2] = 16;
  assert.equal(mixedFillTower(cells, 3), null);
});
