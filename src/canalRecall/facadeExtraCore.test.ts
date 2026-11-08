import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExtraSink, type WallFrame } from './facadeExtraCore.js';

const frame: WallFrame = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: 1, len: 10 };

test('a plain box is charged what it emits: four faces, eight triangles', () => {
  const sink = new ExtraSink(8);
  assert.equal(sink.box(frame, 0, 1, 0, .2, 2, 2.2, '#abcdef'), true, 'a box that fits exactly in 8 triangles is kept');
  assert.equal(sink.tris.length, 8);
  assert.equal(sink.room(), 0);
});

test('a bottomed box that fits its exact triangle count is kept', () => {
  const sink = new ExtraSink(10);
  assert.equal(sink.box(frame, 0, 1, 0, .2, 2, 2.2, '#abcdef', true), true);
  assert.equal(sink.tris.length, 10);
});

test('filling a sink with boxes leaves no room that a box could still use', () => {
  const sink = new ExtraSink(230);
  let placed = 0;
  for (let i = 0; i < 200; i++) if (sink.box(frame, 0, .5, 0, .1, 0, .5 + i * .01, '#888')) placed++;
  assert.ok(placed > 0);
  assert.ok(sink.room() < 8, `a plain box fits in ${sink.room()} free triangles but was refused`);
  assert.ok(sink.tris.length <= 230);
});
