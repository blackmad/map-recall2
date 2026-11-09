import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containerStacks, isOpenYard, unproject, MAX_BOXES_PER_YARD, AISLE_CLEARANCE_M, project } from './yardFill';
import type { LngLat, Ring } from './landmarks/osmUnderModels';

const o: LngLat = [4.804, 52.4076];
const rect = (w: number, h: number): Ring => [[0, 0], [w, 0], [w, h], [0, h], [0, 0]].map(([x, y]) => unproject(x, y, o));

test('open yard needs area, low building cover and aisles', () => {
  assert.ok(isOpenYard(60000, 2000, 5));
  assert.ok(!isOpenYard(5000, 0, 5));
  assert.ok(!isOpenYard(60000, 30000, 5));
  assert.ok(!isOpenYard(60000, 0, 1));
});

test('stacks are deterministic, stay inside, clear aisles and buildings', () => {
  const yard = rect(300, 200);
  const aisle = [unproject(0, 100, o), unproject(300, 100, o)];
  const bld = rect(40, 40).map(p => { const [x, y] = project(p, o); return unproject(x + 200, y + 20, o); });
  const a = containerStacks('Y1', yard, [aisle], [bld]);
  const b = containerStacks('Y1', yard, [aisle], [bld]);
  assert.deepEqual(a, b);
  assert.ok(a.length > 100 && a.length <= MAX_BOXES_PER_YARD);
  for (const s of a) {
    const [x, y] = project(s.c, o);
    assert.ok(x > 0 && x < 300 && y > 0 && y < 200);
    assert.ok(Math.abs(y - 100) >= AISLE_CLEARANCE_M - 0.5 || false, `box at y=${y} on the aisle`);
    assert.ok(!(x > 195 && x < 245 && y > 15 && y < 65), 'box inside the building');
  }
});

test('different yard ids give different layouts', () => {
  const yard = rect(200, 120);
  assert.notDeepEqual(containerStacks('A', yard, [], []).map(s => s.colour), containerStacks('B', yard, [], []).map(s => s.colour));
});

// Named regression spots from the 2026-11-09 feedback (items 22 Hornweg, 11 Zaanstraat): the staged fills must exist.
import fs from 'node:fs';
test('staged fills cover the Hornweg terminal and the Zaanstraat rail yard', () => {
  const dir = new URL('../../scripts/data/yard-fill/', import.meta.url);
  const stacks = JSON.parse(fs.readFileSync(new URL('container-stacks.json', dir), 'utf8')) as { yards: { id: string; boxes: unknown[] }[] };
  const sidings = JSON.parse(fs.readFileSync(new URL('rail-sidings.json', dir), 'utf8')) as { anchors: { anchor: string; lines: unknown[] }[] };
  assert.ok((stacks.yards.find(y => y.id === 'hornweg-terminal')?.boxes.length ?? 0) > 1000);
  assert.ok((sidings.anchors.find(a => a.anchor === 'zaanstraat-rail-yard')?.lines.length ?? 0) > 50);
});
