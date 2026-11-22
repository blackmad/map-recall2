// Belt fixes 2026-11-22: a pand split in stage 1 (Herengracht 76-78, 50-52) is drawn on its own part of the footprint.
import assert from 'node:assert/strict';
import test from 'node:test';
import { houseSlice, lineOf, sliceGeometry, sliceRing } from './sliceFootprint.ts';

const LAT = 52.38, kx = 111_320 * Math.cos(LAT * Math.PI / 180);
const at = (xM: number, yM: number): [number, number] => [4.89 + xM / kx, LAT + yM / 110_540];
// A 10 m front along +x, 12 m deep.
const ring = [at(0, 0), at(10, 0), at(10, -12), at(0, -12), at(0, 0)];
const a = at(0, 0), b = at(10, 0);
const xs = (r: number[][]) => r.map(p => (p[0] - 4.89) * kx);

test('houseSlice cuts only at the dividers', () => {
  assert.deepEqual(houseSlice([0, 4], [0, 8.37]), { fromM: 0, toM: 4, cutFrom: false, cutTo: true });
  assert.deepEqual(houseSlice([4, 8.37], [0, 8.37]), { fromM: 4, toM: 8.37, cutFrom: true, cutTo: false });
  assert.deepEqual(houseSlice([0.03, 8.35], [0, 8.37]), { fromM: 0.03, toM: 8.35, cutFrom: false, cutTo: false });
});

test('sliceRing keeps the house part of the footprint, closed', () => {
  const left = sliceRing(ring, a, b, houseSlice([0, 4], [0, 10]))!;
  assert.deepEqual(left[0], left[left.length - 1]);
  assert.ok(Math.abs(Math.max(...xs(left)) - 4) < 1e-6);
  assert.ok(Math.abs(Math.min(...xs(left))) < 1e-6);
  const right = sliceRing(ring, a, b, houseSlice([4, 10], [0, 10]))!;
  assert.ok(Math.abs(Math.min(...xs(right)) - 4) < 1e-6);
  assert.ok(Math.abs(Math.max(...xs(right)) - 10) < 1e-6);
  const mid = sliceRing(ring, a, b, houseSlice([3, 6], [0, 10]))!;
  assert.deepEqual([Math.min(...xs(mid)), Math.max(...xs(mid))].map(v => +v.toFixed(6)), [3, 6]);
  assert.equal(sliceRing(ring, a, b, { fromM: 20, toM: 30, cutFrom: true, cutTo: true }), null);
  assert.equal(sliceRing(ring, a, a, houseSlice([0, 4], [0, 10])), null);
});

test('sliceGeometry handles Polygon and MultiPolygon outer rings', () => {
  const s = houseSlice([0, 4], [0, 10]);
  assert.equal(sliceGeometry({ type: 'Polygon', coordinates: [ring] }, a, b, s)?.type, 'Polygon');
  const far = [at(20, 0), at(25, 0), at(25, -5), at(20, -5), at(20, 0)];
  const multi = sliceGeometry({ type: 'MultiPolygon', coordinates: [[ring], [far]] }, a, b, s);
  assert.equal(multi?.type, 'Polygon'); // the far piece lies past the divider
  assert.equal(sliceGeometry({ type: 'Point', coordinates: a }, a, b, s), null);
});

test('lineOf parses a framed wall line', () => {
  assert.deepEqual(lineOf('line:4.1,52.1,4.2,52.2'), [[4.1, 52.1], [4.2, 52.2]]);
  assert.equal(lineOf('pand:0363'), null);
  assert.equal(lineOf('line:4.1,52.1,x,52.2'), null);
  assert.equal(lineOf(undefined), null);
});
