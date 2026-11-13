import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profiledRibs} from './profiledCladding';

test('ribs fill the field at the pitch, centred inside the end margins', () => {
  const ribs = profiledRibs({length: 4.2, y0: 2, y1: 5.5, pitch: 0.4, rib: 0.1});
  // usable 4.0 m -> 10 ribs, first centred at 0.1 + 0.2
  assert.equal(ribs.length, 10);
  assert.ok(Math.abs((ribs[0].t0 + ribs[0].t1) / 2 - 0.3) < 1e-9);
  assert.ok(Math.abs((ribs[9].t0 + ribs[9].t1) / 2 - 3.9) < 1e-9);
  for (const r of ribs) { assert.equal(r.y0, 2); assert.equal(r.y1, 5.5); assert.ok(Math.abs(r.t1 - r.t0 - 0.1) < 1e-9); }
});

test('ribs stop at an opening with the margin and resume above it', () => {
  const ribs = profiledRibs({length: 2, y0: 0, y1: 6, pitch: 0.5, rib: 0.1, openings: [{t0: 0.5, t1: 1.5, y0: 1, y1: 3}], margin: 0.1, endMargin: 0});
  const crossing = ribs.filter(r => r.t1 > 0.4 && r.t0 < 1.6);
  // ribs at 0.75 and 1.25 are split: 0..0.9 and 3.1..6
  assert.deepEqual(crossing.map(r => [r.y0, r.y1]), [[0, 0.9], [3.1, 6], [0, 0.9], [3.1, 6]]);
  const clear = ribs.filter(r => r.t1 <= 0.4 || r.t0 >= 1.6);
  for (const r of clear) assert.deepEqual([r.y0, r.y1], [0, 6]);
});

test('an opening covering the whole height removes the rib; short pieces are dropped', () => {
  const ribs = profiledRibs({length: 1, y0: 0, y1: 3, pitch: 0.5, rib: 0.1, openings: [{t0: 0, t1: 0.5, y0: 0.1, y1: 3}], endMargin: 0});
  // left rib (0.25) would keep 0..0.05, below minHeight; right rib (0.75) is clear of the 0.05 margin
  assert.deepEqual(ribs.map(r => [(r.t0 + r.t1) / 2, r.y0, r.y1]), [[0.75, 0, 3]]);
});

test('no ribs when the field is narrower than one rib inside the end margins; bad specs throw', () => {
  assert.deepEqual(profiledRibs({length: 0.25, y0: 0, y1: 1, pitch: 0.4, rib: 0.1}), []);
  assert.throws(() => profiledRibs({length: 1, y0: 1, y1: 1, pitch: 0.4, rib: 0.1}));
  assert.throws(() => profiledRibs({length: 1, y0: 0, y1: 1, pitch: 0.4, rib: 0.4}));
});
