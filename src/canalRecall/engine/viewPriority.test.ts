// engine/viewPriority.ts: on-screen boxes first by screen share, off-screen by distance from the view's focus; the
// mode flag; the page-wide publish. Run: node --import tsx --test src/canalRecall/engine/viewPriority.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { ON_SCREEN_RANK, activeViewPriority, activeViewRank, boxDistanceM, onScreenRank, publishViewPriority, screenShare, tileBox, viewPriorityMode, viewRank, viewSamples, wantsViewPriority, type GroundBox, type LngLat } from './viewPriority.js';

// A toy pitched camera over flat ground looking north from (4.9, 52.37): screen x maps to longitude, screen y to
// latitude with the far ground compressed toward the top (rows above y = 100 are sky).
const W = 800, H = 500;
const unproject = (x: number, y: number): LngLat | null => {
  if (y < 100) return null;
  const depthM = 40_000 / (y - 60); // 100 px -> 1000 m ahead, 500 px -> ~91 m ahead
  const lateralM = (x - W / 2) / W * depthM * 1.2;
  return [4.9 + lateralM / (111320 * Math.cos(52.37 * Math.PI / 180)), 52.37 + depthM / 111320];
};
const box = (eastM0: number, northM0: number, eastM1: number, northM1: number): GroundBox => {
  const kx = 111320 * Math.cos(52.37 * Math.PI / 180);
  return [4.9 + eastM0 / kx, 52.37 + northM0 / 111320, 4.9 + eastM1 / kx, 52.37 + northM1 / 111320];
};

test('samples: sky rows are left out of the points but count in the total; the focus is the near middle', () => {
  const v = viewSamples(unproject, W, H, 20, 10);
  assert.equal(v.total, 200);
  assert.equal(v.points.length / 2, 160, 'the top 2 of 10 rows are sky');
  assert.ok(v.focus && v.focus[1] > 52.37 && v.focus[1] < 52.3725, `focus near the viewer: ${v.focus}`);
});

test('rank: on screen before off screen; the near block (larger on screen) before the far one', () => {
  const v = viewSamples(unproject, W, H);
  const near = box(-150, 80, 150, 300), far = box(-150, 700, 150, 920), behind = box(-150, -900, 150, -600), aside = box(3000, 100, 3300, 400);
  const [rn, rf, rb, ra] = [near, far, behind, aside].map(b => viewRank(b, v));
  assert.ok(onScreenRank(rn) && onScreenRank(rf), 'both blocks ahead are on screen');
  assert.ok(!onScreenRank(rb) && !onScreenRank(ra), 'behind and far aside are not');
  assert.ok(screenShare(near, v) > screenShare(far, v), 'the near block covers more of the screen');
  assert.ok(rn < rf && rf < rb && rf < ra, `order near ${rn} far ${rf} behind ${rb} aside ${ra}`);
  assert.ok(rn >= ON_SCREEN_RANK);
  // Off screen: by ground distance from the focus (the block 600 m behind before the one 3 km aside).
  assert.ok(rb < ra);
  assert.ok(Math.abs(rb - boxDistanceM(behind, v.focus!)) < 1e-6);
});

test('rank: a z16 tile under the view outranks the rider\'s tile 800 m behind the camera', () => {
  // The user's case: the rider's neighbourhood stays resident behind a camera panned 800 m ahead.
  const v = viewSamples(unproject, W, H);
  const n = 2 ** 16, x = Math.floor((4.9 + 180) / 360 * n), rad = 52.3712 * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
  const underView = tileBox(16, x, y), rider = box(-200, -1000, 200, -800);
  assert.ok(viewRank(underView, v) < viewRank(rider, v));
});

test('mode: default detached; 0 off; all; the window global', () => {
  assert.equal(viewPriorityMode('', {}), 'detached');
  assert.equal(viewPriorityMode('?viewPriority=0', {}), 'off');
  assert.equal(viewPriorityMode('?viewPriority=all', {}), 'all');
  assert.equal(viewPriorityMode('', { __canalRecallViewPriority: false }), 'off');
  assert.equal(wantsViewPriority('detached', false, 0), false, 'riding: rider ranks');
  assert.equal(wantsViewPriority('detached', true, 0), true);
  assert.equal(wantsViewPriority('detached', true, 0.5), false, 'not during the intro flight');
  assert.equal(wantsViewPriority('all', false, 0), true);
  assert.equal(wantsViewPriority('off', true, 0), false);
});

test('publish: consumers see the view until it is withdrawn; versions advance', () => {
  publishViewPriority(null);
  assert.equal(activeViewPriority(), null);
  assert.equal(activeViewRank(box(0, 0, 10, 10)), null);
  const v = viewSamples(unproject, W, H);
  publishViewPriority(v);
  const a = activeViewPriority();
  assert.ok(a && a.view === v);
  assert.ok(onScreenRank(activeViewRank(box(-150, 80, 150, 300))!));
  publishViewPriority(viewSamples(unproject, W, H));
  assert.ok(activeViewPriority()!.version > a!.version);
  publishViewPriority(null);
  assert.equal(activeViewPriority(), null);
});
