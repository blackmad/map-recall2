import test from 'node:test';
import assert from 'node:assert/strict';
import { footprintBox, rideBox, ringCells, ringFollowEnabled, ringFootprintEnabled, ringSignature, FOOTPRINT_HALF_M, type RingBounds } from './worldRing.ts';
import { tileFor, tileKey } from '../slippyTiles.ts';

// Regression location (lane E4, #217): the seeded ride east along the Koninginneweg / Van Baerlestraat stays inside the
// z14 tile 8413/5385 for ~1.5 km. The streamer re-planned only when its z14 tiles changed, so the ring's next 1 km cell
// was read only when the next z14 tile came into view, and 1,586 buildings arrived 57 m from the rider.
const M_LNG = 111_320 * Math.cos((52.357 * Math.PI) / 180);
const view = (lng: number, lat: number): RingBounds => ({ west: lng - 300 / M_LNG, east: lng + 300 / M_LNG, south: lat - 120 / 111_320, north: lat + 520 / 111_320 });

test('the ring changes inside one z14 tile, so a follow signature with its cells re-plans as the rider rides', () => {
  const lat = 52.357, from = 4.8572, to = from + 1300 / M_LNG;
  assert.equal(tileKey(tileFor(from, lat, 14)), tileKey(tileFor(to, lat, 14)), 'both ends in one z14 tile');
  assert.equal(tileKey(tileFor(from, lat, 14)), '14/8413/5385');
  const signatures = new Set<string>();
  for (let m = 0; m <= 1300; m += 100) signatures.add(ringSignature(ringCells(view(from + m / M_LNG, lat), [])));
  assert.ok(signatures.size >= 2, `the ring moved ${signatures.size - 1} time(s) inside the tile`);
  assert.equal(ringSignature(new Set(['b', 'a'])), 'a,b', 'order-free');
  assert.equal(ringSignature(null), '');
});

test('?ringFollow=0 turns the follow off', () => {
  const g = globalThis as { __canalRecallRingFollow?: boolean };
  assert.equal(ringFollowEnabled(), true);
  g.__canalRecallRingFollow = false;
  try { assert.equal(ringFollowEnabled(), false); } finally { delete g.__canalRecallRingFollow; }
});

// Regression (lane R4-F #249): the aerial pan's oost leg. A pitched view from the air (S1 pose, ~6 km deep) over a
// parked rider at the Dam: rideBox held the rider's stand-in (25 cells) until the rider left the view box, then the
// ring read the whole view at once. The near footprint moves with the view centre and grows by a row at a time.
test('from the air the near footprint grows a row at a time where rideBox jumped, and never exceeds the box', () => {
  const rider: [number, number] = [4.8926, 52.3731], lat = 52.3731, MLNG = 111_320 * Math.cos(lat * Math.PI / 180);
  // The view: 2.5 km wide, from 600 m behind the centre to 5 km ahead (north), the centre flown east at 120 m/s, 1 s steps.
  const viewAt = (lng: number): RingBounds => ({ west: lng - 1250 / MLNG, east: lng + 1250 / MLNG, south: lat - 600 / 111_320, north: lat + 5000 / 111_320 });
  let prevBox = -1, prevFoot = -1, boxJump = 0, footRise = 0, footMax = 0, boxMax = 0;
  for (let s = 0; s <= 40; s++) {
    const lng = rider[0] + s * 120 / MLNG, view = viewAt(lng);
    const box = ringCells(rideBox(view, 16.9, rider), []).size, foot = ringCells(footprintBox(view, [lng, lat]), []).size;
    assert.ok(foot <= ringCells(view, []).size, 'never more than the box');
    if (prevBox >= 0) boxJump = Math.max(boxJump, box - prevBox);
    if (prevFoot >= 0) footRise = Math.max(footRise, foot - prevFoot);
    prevBox = box; prevFoot = foot; footMax = Math.max(footMax, foot); boxMax = Math.max(boxMax, box);
  }
  assert.ok(boxJump >= 15, `rideBox jumps (${boxJump} cells in one second)`);
  assert.ok(footRise <= 5, `the footprint grows by at most a column (${footRise})`);
  assert.ok(footMax < boxMax, `footprint ${footMax} < box ${boxMax}`);
  const f = footprintBox(viewAt(rider[0]), rider);
  assert.ok((f.east - f.west) * MLNG <= 2 * FOOTPRINT_HALF_M + 1 && (f.north - f.south) * 111_320 <= 600 + FOOTPRINT_HALF_M + 1);
});

test('ringFootprintEnabled: off by default; the query and the window switch', () => {
  assert.equal(ringFootprintEnabled('', {}), false);
  assert.equal(ringFootprintEnabled('?ringFootprint=1', {}), true);
  assert.equal(ringFootprintEnabled('?ringFootprint=0', { __canalRecallRingFootprint: true }), false);
  assert.equal(ringFootprintEnabled('', { __canalRecallRingFootprint: true }), true);
});
