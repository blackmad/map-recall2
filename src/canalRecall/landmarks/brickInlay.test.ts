import {test} from 'node:test';
import assert from 'node:assert/strict';
import {corbelBalconyProfile, lozenge, lozengeCross, piercedHoles, rowCentres} from './brickInlay';
import {outlineArea} from './crenellation';

test('a lozenge stands on its point, counter-clockwise, area 2r^2', () => {
  const l = lozenge(1, 2, 0.25);
  assert.deepEqual(l[0], [1, 1.75]);
  assert.ok(Math.abs(outlineArea(l) - 2 * 0.25 * 0.25) < 1e-12);
});

test('a lozenge cross is five touching lozenges, 6r across', () => {
  const c = lozengeCross(0, 0, 0.1);
  assert.equal(c.length, 5);
  const ts = c.flat().map(p => p[0]), ys = c.flat().map(p => p[1]);
  assert.ok(Math.abs(Math.max(...ts) - Math.min(...ts) - 0.6) < 1e-12);
  assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - 0.6) < 1e-12);
  // the right lozenge's left point is the centre lozenge's right point
  assert.deepEqual(c[2][3], c[0][1]);
});

test('row centres fill the run evenly, half a pitch in', () => {
  assert.deepEqual(rowCentres(0, 4, 1), [0.5, 1.5, 2.5, 3.5]);
  const r = rowCentres(0, 4.2, 1);
  assert.equal(r.length, 4);
  assert.ok(Math.abs(r[0] - 4.2 / 8) < 1e-12);
  assert.deepEqual(rowCentres(2, 1, 1), []);
});

test('pierced holes leave equal solid between and at the ends', () => {
  const h = piercedHoles({t0: 0, t1: 3.7, yHole0: 22.9, yHole1: 23.3, holes: 4, hole: 0.4});
  assert.equal(h.length, 4);
  const solid = (3.7 - 1.6) / 5;
  assert.ok(Math.abs(h[0].t0 - solid) < 1e-12);
  assert.ok(Math.abs(3.7 - h[3].t1 - solid) < 1e-12);
  assert.ok(Math.abs(h[1].t0 - h[0].t1 - solid) < 1e-12);
  assert.throws(() => piercedHoles({t0: 0, t1: 1, yHole0: 0, yHole1: 1, holes: 3, hole: 0.4}));
});

test('the corbel balcony profile tapers back to the wall under the floor', () => {
  const p = corbelBalconyProfile({yFloor: 8.4, yTop: 9.5, depth: 0.55, corbel: 0.7});
  assert.deepEqual(p[0], [0, 7.7]);
  assert.ok(outlineArea(p) > 0);
  assert.throws(() => corbelBalconyProfile({yFloor: 2, yTop: 1, depth: 0.5, corbel: 0.5}));
});
