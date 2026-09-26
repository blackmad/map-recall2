import assert from 'node:assert/strict';
import { edgeMaps, segmentSupport } from './edgeSupport.ts';

const width = 200, height = 100;
const data = new Uint8Array(width * height).fill(20);
for (let y = 0; y < height; y++) data[y * width + 50] = 235;
const maps = edgeMaps({ data, width, height });

// A vertical line is strong in the vertical (horizontal-gradient) response and
// weak in the horizontal one.
const onVertical = segmentSupport(maps, [50, 5], [50, 95], 'vertical', 2);
const onHorizontal = segmentSupport(maps, [50, 5], [50, 95], 'horizontal', 2);
const off = segmentSupport(maps, [90, 5], [90, 95], 'vertical', 2);
assert.ok(onVertical > 100, `vertical edge support should be strong, got ${onVertical}`);
assert.ok(off < onVertical / 3, `off-line support should be weak, got ${off} vs ${onVertical}`);
assert.ok(onHorizontal < onVertical / 3, `a vertical line should not score as a horizontal edge, got ${onHorizontal}`);

// Horizontal wrap: a line at x=0 must still be found when sampled across the seam.
const seam = new Uint8Array(width * height).fill(20);
for (let y = 0; y < height; y++) seam[y * width] = 235;
const seamMaps = edgeMaps({ data: seam, width, height });
const wrapped = segmentSupport(seamMaps, [0, 5], [0, 95], 'vertical', 2);
assert.ok(wrapped > 100, `edge support should wrap across the seam, got ${wrapped}`);

console.log('edge support: orientation split, line response and horizontal wrap passed.');
