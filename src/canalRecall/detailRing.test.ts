import test from 'node:test';
import assert from 'node:assert/strict';
import { DETAIL_LEAD_M, DETAIL_LEAD_M_TOUCH, DETAIL_MAX_TILES, DETAIL_MAX_TILES_TOUCH, detailBlock, detailBlockFrozen, detailFreezeAerialEnabled, detailLingerEnabled, metresToTile, type DetailBlock } from './detailRing.ts';
import { isAerialView } from './rendererShared/aerialView.ts';

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

// Lane R3-G (#242): the detail block freezes from the air. Regression location: the user's 2026-11-07 shots, Free
// Ride at pitch ~74° and eye ~150 m panning over the Amstelkanaal and the Chassébuurt (the test pans east from
// 52.3478, 4.9046): every z16 tile edge the camera subject crossed built and dissolved detail tiles in view.

/** The setDetailCentre rule: plan unless frozen; returns the block the frame keeps. */
function step(previous: DetailBlock | null, rider: [number, number], aerial: boolean, enabled = true): DetailBlock {
  return detailBlockFrozen(previous, aerial, enabled) ? previous! : detailBlock(rider, null, 16, previous);
}
const amstelkanaal: [number, number] = [4.9046, 52.3478];
const pan = (m: number): [number, number] => [amstelkanaal[0] + m / M_LNG, amstelkanaal[1]];

test('the user\'s aerial pose counts as aerial; the chase pose does not', () => {
  assert.equal(isAerialView(16.9, 74, 52.35), true); // S4-like: eye ~145 m
  assert.equal(isAerialView(19, 84, 52.35), false); // cockpit
});

test('frozen while aerial: a 2 km pan keeps the entry block', () => {
  let block = step(null, pan(0), true); // a ride that starts aerial plans once at its entry pose
  const entry = block;
  assert.equal(entry.keys.length, 4);
  for (let m = 0; m <= 2000; m += 25) block = step(block, pan(m), true);
  assert.equal(block, entry);
  assert.deepEqual(block.keys, entry.keys);
});

test('re-planned on leaving the air, from the current subject', () => {
  let block = step(null, pan(0), true);
  for (let m = 0; m <= 2000; m += 25) block = step(block, pan(m), true);
  const landed = step(block, pan(2000), false);
  assert.deepEqual(landed.keys.slice(0, 4), detailBlock(pan(2000), null, 16, null).keys);
  // The entry tiles are 2 km away: none lingers.
  assert.ok(landed.keys.every(k => metresToTile(pan(2000), k, 16) < 400));
});

test('on the ground nothing changes: the block follows the rider exactly as before', () => {
  let frozenRule: DetailBlock | null = null, today: DetailBlock | null = null;
  for (let m = 0; m <= 2000; m += 25) {
    frozenRule = step(frozenRule, pan(m), false);
    today = detailBlock(pan(m), null, 16, today);
    assert.deepEqual(frozenRule, today);
  }
});

test('?detailFreezeAerial=0 is today: the block follows the subject from the air', () => {
  let off: DetailBlock | null = null, today: DetailBlock | null = null;
  for (let m = 0; m <= 2000; m += 25) {
    off = step(off, pan(m), true, false);
    today = detailBlock(pan(m), null, 16, today);
    assert.deepEqual(off, today);
  }
  const g = globalThis as { __canalRecallDetailFreezeAerial?: boolean };
  assert.equal(detailFreezeAerialEnabled(), true);
  g.__canalRecallDetailFreezeAerial = false;
  try { assert.equal(detailFreezeAerialEnabled(), false); } finally { delete g.__canalRecallDetailFreezeAerial; }
});
