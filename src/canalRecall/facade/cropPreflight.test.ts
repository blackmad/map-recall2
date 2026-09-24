import assert from 'node:assert/strict';
import { preflightCrop } from './cropPreflight.ts';

const make = (width: number, height: number, fill: (x: number, y: number) => number) => {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[y * width + x] = fill(x, y);
  return { data, width, height };
};

// A blank mid-grey crop is unusable.
const blank = preflightCrop(make(60, 40, () => 128));
assert.equal(blank.usable, false);
assert.ok(blank.reasons.includes('blank-or-flat'));
assert.ok(blank.reasons.includes('featureless'));

// A structured facade-like crop (vertical edges on a mid tone) is usable.
const structured = preflightCrop(make(60, 40, (x) => (x % 8 < 3 ? 60 : 190)));
assert.equal(structured.usable, true, JSON.stringify(structured));

// A mostly-sky crop is unusable even though it has some edges.
const sky = preflightCrop(make(60, 40, (x, y) => (y < 30 ? 235 : x % 6 === 0 ? 60 : 180)));
assert.equal(sky.usable, false);
assert.ok(sky.reasons.includes('mostly-sky'));

// An empty image is rejected without throwing.
assert.equal(preflightCrop({ data: new Uint8Array(0), width: 0, height: 0 }).usable, false);

console.log('crop preflight: blank, structured, sky and empty handled.');
