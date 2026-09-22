/**
 * The clipped-column measure is a fixed threshold over brightness and colour,
 * chosen so a strip whose top is all brick is not mistaken for a strip whose
 * top is all sky. That is the one failure that would invert its own answer, so
 * it gets a picture whose answer is known by construction.
 */
import assert from 'node:assert/strict';
import { skyFloor, skyline, topClippedColumns, topClippedShare, type Strip } from './skyline.ts';

let checks = 0;
const check = (name: string, fn: () => void) => {
  checks++;
  try { fn(); } catch (error) { console.error(`FAIL ${name}:`, error); process.exitCode = 1; }
};

/** A strip from a per-pixel colour. */
function strip(width: number, height: number, colour: (x: number, y: number) => [number, number, number]): Strip {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const [r, g, b] = colour(x, y);
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { width, height, data };
}
const grey = (value: number): [number, number, number] => [value, value, value];
const blue: [number, number, number] = [120, 160, 230];
const brick: [number, number, number] = [150, 95, 70];

check('sky above, brick below gives the boundary and no clipped columns', () => {
  const image = strip(20, 40, (_x, y) => (y < 10 ? blue : brick));
  assert.deepEqual(skyline(image), new Array(20).fill(10));
  assert.deepEqual(topClippedColumns(image), new Array(20).fill(false));
  assert.equal(topClippedShare(image), 0);
});

check('brick to the top edge is a clipped column', () => {
  const image = strip(40, 40, x => (x >= 36 ? brick : blue));
  const columns = topClippedColumns(image);
  assert.equal(columns[0], false);
  assert.equal(columns[35], false);
  assert.equal(columns[36], true);
  assert.equal(columns[39], true);
  assert.equal(topClippedShare(image), 4 / 40);
});

check('a bright but warm pixel is building, not sky', () => {
  const warm: [number, number, number] = [220, 180, 150];
  assert.equal(topClippedShare(strip(10, 20, () => warm)), 1);
});

check('a bright neutral pixel counts as sky', () => {
  assert.equal(topClippedShare(strip(10, 20, () => grey(200))), 0);
});

check('a fully dark strip reads as clipped, not as unmeasurable', () => {
  const image = strip(20, 40, () => grey(40));
  assert.equal(skyFloor(image), null);
  assert.deepEqual(skyline(image), new Array(20).fill(null));
  assert.equal(topClippedShare(image), 1);
});

if (!process.exitCode) console.log(`skyline: ${checks} checks passed`);
