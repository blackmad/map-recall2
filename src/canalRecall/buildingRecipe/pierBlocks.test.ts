/**
 * White head-line pier blocks (pierBlocks.ts): Den Texstraat 7-27.
 *   node --import tsx --test src/canalRecall/buildingRecipe/pierBlocks.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dentilRects, pierBlockProblems, pierBlockRects, PIER_BLOCKS} from './pierBlocks.ts';
import type {FrontIntent} from './intent.ts';

// A 6.1 m front, three 1.2 m windows per storey at x 0.7, 2.45, 4.2 (piers 0.7, 0.55, 0.55, 0.7 m).
const win = (s: number, k: number, left: number, bottom: number) => ({id: `s${s}-b${k}`, kind: 'window', leftM: left, widthM: 1.2, bottomM: bottom, heightM: 2.2});
const OPEN = [0, 1, 2].flatMap(s => [win(s, 0, 0.7, 1.2 + s * 3.3), win(s, 1, 2.45, 1.2 + s * 3.3), win(s, 2, 4.2, 1.2 + s * 3.3)]);
const door = {id: 's0-door', kind: 'door', leftM: 0.1, widthM: 1, bottomM: 0, heightM: 2.2};

test('one block per pier, alternating long and short from the left, over the highest head, inside the reveals', () => {
  const r = pierBlockRects(OPEN, {storeys: [1]}, 0, 6.1);
  assert.equal(r.length, 4);
  assert.deepEqual(r.map(b => +(b.x1 - b.x0).toFixed(2)), [0.55, 0.28, 0.45, 0.28]);
  const head = 1.2 + 3.3 + 2.2;
  for (const b of r) assert.ok(Math.abs(b.y0 - (head + PIER_BLOCKS.over)) < 1e-9 && Math.abs(b.y1 - b.y0 - PIER_BLOCKS.rise) < 1e-9);
  const wins = OPEN.filter(o => o.id.startsWith('s1-'));
  for (const b of r) for (const w of wins) assert.ok(b.x1 <= w.leftM + 1e-9 || b.x0 >= w.leftM + w.widthM - 1e-9, 'a block never overlaps a window');
});

test('listed storeys only, ground included when listed; doors never count', () => {
  assert.equal(pierBlockRects([...OPEN, door], {storeys: [0, 1, 2]}, 0, 6.1).length, 12);
  assert.equal(pierBlockRects(OPEN, {storeys: [2]}, 0, 6.1).length, 4);
  assert.equal(pierBlockRects(OPEN, {}, 0, 6.1).length, 12);
});

test('piers narrower than 0.3 m take no block', () => {
  const tight = [win(1, 0, 0.1, 4), win(1, 1, 1.45, 4)];
  assert.equal(pierBlockRects(tight, {storeys: [1]}, 0, 2.6).length, 0);
});

test('dentils: a continuous row over the highest listed head, from 0.1 m inside each end; none unless asked', () => {
  assert.deepEqual(dentilRects(OPEN, {storeys: [1, 2]}, 0, 6.1), []);
  const d = dentilRects(OPEN, {storeys: [1, 2], dentils: {pitch: 0.45, block: 0.2, rise: 0.2}}, 0, 6.1);
  assert.ok(d.length >= 12);
  assert.ok(d[0].x0 >= 0.1 - 1e-9 && d.at(-1)!.x1 <= 6.0 + 1e-9);
  assert.ok(d.every(b => b.y0 > 1.2 + 2 * 3.3 + 2.2 + PIER_BLOCKS.over + PIER_BLOCKS.rise));
});

test('validation: keys, ranges, storeys, dentils', () => {
  const f = (pb: unknown) => pierBlockProblems({storeys: 4, pierBlocks: pb} as unknown as FrontIntent, 'f');
  assert.deepEqual(f({storeys: [0, 1, 2], long: 0.55, short: 0.28, rise: 0.3, dentils: {pitch: 0.45, block: 0.2, rise: 0.2}}), []);
  assert.match(f({big: 1})[0], /pierBlocks:/);
  assert.match(f({long: 3})[0], /long/);
  assert.match(f({storeys: [4]})[0], /storey indices/);
  assert.match(f({dentils: {pitch: 0.2, block: 0.3, rise: 0.2}})[0], /under the pitch/);
  assert.match(f({dentils: {pitch: 0.4}})[0], /dentils/);
});
