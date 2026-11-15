import assert from 'node:assert/strict';
import test from 'node:test';
import {readFront, sameFront} from './frontMeasure.ts';

/** A 10 m × 9 m brick front at 20 px/m: 4 window columns × 3 window rows of dark glass. */
function synthetic(cols: number, rows: number, brick: [number, number, number]): {data: Uint8Array; w: number; h: number} {
  const ppm = 20, w = 10 * ppm, h = 9 * ppm, data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const bx = Math.floor((x / w) * cols), by = Math.floor((y / h) * rows);
    const inWin = Math.abs(x - ((bx + 0.5) * w) / cols) < 0.6 * ppm && Math.abs(y - ((by + 0.5) * h) / rows) < 0.8 * ppm;
    const c = inWin ? [40, 45, 55] : brick;
    data.set(c, (y * w + x) * 3);
  }
  return {data, w, h};
}

test('reads window columns, rows and the brick', () => {
  const s = synthetic(4, 3, [150, 80, 60]), r = readFront(s.data, s.w, s.h, 3, 20)!;
  assert.equal(r.bays, 4);
  assert.equal(r.rows, 3);
  assert.equal(r.wall.hex, '#96503c');
});

test('different grids or bricks are different fronts', () => {
  const a = readFront(synthetic(4, 3, [150, 80, 60]).data, 200, 180, 3, 20)!;
  const b = readFront(synthetic(4, 3, [152, 82, 61]).data, 200, 180, 3, 20)!;
  const c = readFront(synthetic(4, 2, [150, 80, 60]).data, 200, 180, 3, 20)!;
  const d = readFront(synthetic(4, 3, [200, 190, 150]).data, 200, 180, 3, 20)!;
  assert.equal(sameFront(a, b).same, true);
  assert.equal(sameFront(a, c).same, false);
  assert.equal(sameFront(a, d).same, false);
});
