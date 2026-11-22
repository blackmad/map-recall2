import test from 'node:test';
import assert from 'node:assert/strict';
import {measureStripPalette, stripImageMismatch} from './stripPalette.ts';

// 2026-11-22: build-chunk-wall-exposure crashed at measureStripPalette (negative typed-array length) because
// Bellamyplein 18-38 r1's archived strip.jpg is 1101 px wide while its strip.json spans run to 2203 px.
const strip = (width: number, height: number) => ({rgb: new Uint8Array(width * height * 3).fill(150), width, height});

test('a span wholly past the image measures nothing instead of throwing', () => {
  const p = measureStripPalette({...strip(1101, 755), x0: 1323, x1: 1542, pixelsPerMetre: 40, eavesM: 14});
  assert.equal(p.pixels, 0);
  assert.equal(p.wall, null);
  assert.deepEqual(p.shares, {wall: 0, accent: 0, glass: 0});
});

test('a span inside the image still measures its wall', () => {
  const p = measureStripPalette({...strip(1101, 755), x0: 220, x1: 441, pixelsPerMetre: 40, eavesM: 14});
  assert.ok(p.pixels > 0);
  assert.equal(p.wall, '#969696');
});

test('stripImageMismatch flags a stale strip file and passes a matching one', () => {
  assert.equal(stripImageMismatch({width: 2203, height: 755}, {width: 2203, height: 755}), null);
  assert.match(stripImageMismatch({width: 2203, height: 755}, {width: 1101, height: 755})!, /1101x755 px.*2203x755 px/);
});
