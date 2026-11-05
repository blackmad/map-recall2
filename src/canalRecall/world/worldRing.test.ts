import test from 'node:test';
import assert from 'node:assert/strict';
import { ringCells, ringFollowEnabled, ringSignature, type RingBounds } from './worldRing.ts';
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
