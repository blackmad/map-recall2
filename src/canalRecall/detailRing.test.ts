import test from 'node:test';
import assert from 'node:assert/strict';
import { DETAIL_LEAD_M, DETAIL_LEAD_M_TOUCH, DETAIL_MAX_TILES, DETAIL_MAX_TILES_TOUCH, detailBlock, detailLingerEnabled, metresToTile, type DetailBlock } from './detailRing.ts';

// Regression location (lane E4, #217): the seeded ride's iPhone profile (z17 tiles) east-north-east along the
// Koninginneweg and Van Baerlestraat. With six tiles a tile beside the rider dropped to coarse shells 90-115 m away,
// and side tiles turned detailed ~115 m away; eight tiles and a 160 m lead keep both beyond the 120 m gate.
const M_LNG = 111_320 * Math.cos((52.357 * Math.PI) / 180);
const dir: [number, number] = [Math.cos(0.4), Math.sin(0.4)];
const at = (m: number): [number, number] => [4.8557 + (dir[0] * m) / M_LNG, 52.3544 + (dir[1] * m) / 111_320];

function ride(maxTiles: number, leadM: number) {
  let block: DetailBlock | null = null;
  let nearestDrop = Infinity, nearestArrival = Infinity, most = 0;
  for (let m = 0; m <= 1900; m += 10) {
    const rider = at(m);
    const next = detailBlock(rider, dir, 17, block, { maxTiles, leadM });
    for (const k of block?.keys ?? []) if (!next.keys.includes(k)) nearestDrop = Math.min(nearestDrop, metresToTile(rider, k, 17));
    if (block) for (const k of next.keys) if (!block.keys.includes(k)) nearestArrival = Math.min(nearestArrival, metresToTile(rider, k, 17));
    most = Math.max(most, next.keys.length);
    block = next;
  }
  return { nearestDrop, nearestArrival, most };
}

test('touch: eight tiles and the longer lead keep detail swaps further from the rider than six did', () => {
  const before = ride(DETAIL_MAX_TILES, DETAIL_LEAD_M), after = ride(DETAIL_MAX_TILES_TOUCH, DETAIL_LEAD_M_TOUCH);
  assert.ok(after.most <= DETAIL_MAX_TILES_TOUCH);
  // Metres from the rider to the nearest tile that left / joined (a tile's edge, so its buildings are further still).
  assert.ok(before.nearestDrop < 100 && after.nearestDrop > 150, `drops: ${before.nearestDrop.toFixed(0)} → ${after.nearestDrop.toFixed(0)} m`);
  assert.ok(after.nearestArrival > before.nearestArrival + 15, `arrivals: ${before.nearestArrival.toFixed(0)} → ${after.nearestArrival.toFixed(0)} m`);
});

test('?detailLinger=0 turns it off', () => {
  const g = globalThis as { __canalRecallDetailLinger?: boolean };
  assert.equal(detailLingerEnabled(), true);
  g.__canalRecallDetailLinger = false;
  try { assert.equal(detailLingerEnabled(), false); } finally { delete g.__canalRecallDetailLinger; }
});
