// node --import tsx --test src/canalRecall/look/*.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_LOOKS, CITY_ROOF, FLAT_ROOF_GREYS, LOOK_VARIANTS, PERIOD_FROM, PERIOD_PRIORS, PERIODS, PHOTO_WALL_CELL_MEAN, ROOF_TONES, cellSetOf, lookHex, periodForYear, roofTone } from './palette.ts';
import { PARITY_TOLERANCE, faceNormal, lumaSpread, meanLuma } from './lookParityMath.ts';

test('one era scheme: 1860 / 1915 / 1945, a boundary belongs to the period it opens', () => {
  assert.deepEqual([PERIOD_FROM.c19, PERIOD_FROM.school, PERIOD_FROM.modern], [1860, 1915, 1945]);
  assert.deepEqual([1859, 1860, 1914, 1915, 1944, 1945, 2020].map(periodForYear), ['canal', 'c19', 'c19', 'school', 'school', 'modern', 'modern']);
  assert.equal(new Set(PERIODS.map(p => PERIOD_PRIORS[p].wall)).size, PERIODS.length, 'each period paints its own colour');
});

test('lookHex is the identity for the natural looks and keeps darks dark in cartoon', () => {
  for (const look of ['photo', 'procedural', 'untextured'] as const) assert.equal(lookHex('#A4523B', look), '#A4523B');
  // Values pinned from the pre-merge landmarkFronts.ts implementation.
  assert.equal(lookHex('#a4523b', 'storybook'), '#b84a37');
  assert.equal(lookHex('#a4523b', 'cartoon'), '#e23d0e');
  assert.equal(lookHex('#808080', 'storybook'), '#888888');
  // Iron and glass: lightness kept (below 0.35), only saturation pushed.
  assert.equal(lookHex('#1f2121', 'cartoon'), '#1c2424');
});

test('roof tones: one table, photo is the city table, tone picks within range', () => {
  assert.deepEqual(CITY_ROOF.tile, ROOF_TONES.photo.tile);
  assert.equal(CITY_ROOF.flat, FLAT_ROOF_GREYS);
  assert.equal(roofTone('photo', 'tile', 0), ROOF_TONES.photo.tile[0]);
  assert.equal(roofTone('photo', 'tile', 1), ROOF_TONES.photo.tile.at(-1));
  assert.equal(roofTone('cartoon', 'slate', 0.5), ROOF_TONES.cartoon.slate[1]);
});

test('every look is a complete parameter set', () => {
  for (const look of BUILDING_LOOKS) {
    const v = LOOK_VARIANTS[look];
    assert.ok(v.cells && Number.isFinite(v.shadeBands) && Number.isFinite(v.litWallGain), look);
    assert.equal(cellSetOf(look), look === 'untextured' ? 'procedural' : look);
  }
  assert.ok(Math.abs(LOOK_VARIANTS.photo.litWallGain * PHOTO_WALL_CELL_MEAN - 255) < 1e-9, 'lit photo walls show their tint');
});

test('parity maths: magenta clear is excluded, spread is relative to the mean', () => {
  const size = 4, px = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) px.set(i < 4 ? [255, 0, 255, 255] : [100, 100, 100, 255], i * 4);
  assert.equal(meanLuma(px, size, 0), 100);
  assert.deepEqual(faceNormal('south'), [0, -1, 0]);
  const r = { hex: '#808080', rig: {}, walls: { 'a/south': 100, 'b/south': 105, 'c/south': 95 } };
  const s = lumaSpread(r, ['a', 'b', 'c'], 'south');
  assert.ok(Math.abs(s.spread - 0.1) < 1e-9);
  assert.ok(PARITY_TOLERANCE > 0 && PARITY_TOLERANCE < 0.2);
});
