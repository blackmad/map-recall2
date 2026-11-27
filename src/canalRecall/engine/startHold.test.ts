import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVEAL_DISSOLVE_MS, START_HOLD_BUILDING_LINES, START_HOLD_CAP_MS, START_HOLD_LINE_MS, START_HOLD_INTRO_MIN_MS, START_HOLD_MESSAGE_AFTER_MS, censusGrid, introHoldCapMs, isStandIn,
  revealDissolveAlpha, startHoldCapMs, coveredFrameMs, startHoldFramesEnabled, COVERED_GROUND_INSTALLS_PER_FRAME, startHoldTickDue, startHoldTicks, START_HOLD_TICK_MS_DESKTOP, START_HOLD_TICK_MS_TOUCH, startHoldEnabled, startHoldMessageKey, startTierCensus,
} from './startHold';
import { en } from '../../i18n/messages/en';
import { nl } from '../../i18n/messages/nl';

test('the flag is on unless asked off', () => {
  for (const v of [undefined, null, '1', 'on', true]) assert.equal(startHoldEnabled(v), true);
  for (const v of ['0', 0, false, 'false', 'off']) assert.equal(startHoldEnabled(v), false);
});

test('the cap is 10 s, the sweep can ask 2-20 s, nonsense falls back', () => {
  assert.equal(START_HOLD_CAP_MS, 10_000);
  assert.equal(startHoldCapMs(undefined), 10_000);
  assert.equal(startHoldCapMs('8000'), 8000);
  assert.equal(startHoldCapMs('12000'), 12_000);
  for (const v of ['', 'x', '500', '60000', null]) assert.equal(startHoldCapMs(v), 10_000);
});

test('the intro hold gets what is left of the cap, never under 1.8 s', () => {
  assert.equal(introHoldCapMs(2000), 8000);
  assert.equal(introHoldCapMs(9500), START_HOLD_INTRO_MIN_MS);
  assert.equal(introHoldCapMs(-5), 10_000);
  assert.equal(introHoldCapMs(4000, 8000), 4000);
});

test('stand-ins inside the ring hold; facades, baked, steady coarse and anything outside do not', () => {
  assert.equal(isStandIn({ distanceM: 400, owner: 'farPending' }), true);
  assert.equal(isStandIn({ distanceM: 400, owner: 'coarse' }), true);
  assert.equal(isStandIn({ distanceM: 400, owner: 'coarse', wanted: false }), false);
  assert.equal(isStandIn({ distanceM: 700, owner: 'farPending' }), false);
  for (const owner of ['facade', 'baked', 'none'] as const) assert.equal(isStandIn({ distanceM: 50, owner }), false);
  assert.equal(isStandIn({ distanceM: NaN, owner: 'farPending' }), false);
});

test('the census buckets by distance and counts the stand-ins', () => {
  const c = startTierCensus([
    { distanceM: 100, owner: 'facade' }, { distanceM: 250, owner: 'facade' }, { distanceM: 450, owner: 'farPending' },
    { distanceM: 550, owner: 'coarse', wanted: false }, { distanceM: 900, owner: 'farPending' }, { distanceM: 1500, owner: 'baked' },
  ]);
  assert.deepEqual(c.within[300], { facade: 2 });
  assert.deepEqual(c.within[600], { facade: 2, farPending: 1, coarse: 1 });
  assert.deepEqual(c.within[1000], { facade: 2, farPending: 2, coarse: 1 });
  assert.deepEqual(c.within[1200], { facade: 2, farPending: 2, coarse: 1 });
  assert.deepEqual(c.band600to1200, { farPending: 1 });
  assert.equal(c.standIns, 1);
});

test('the grid samples cell centres and nothing on an empty canvas', () => {
  const g = censusGrid(200, 100, [2, 2]);
  assert.deepEqual(g, [[50, 25], [150, 25], [50, 75], [150, 75]]);
  assert.deepEqual(censusGrid(0, 100), []);
});

test('the loading line turns to "Building the city" after a moment', () => {
  assert.equal(startHoldMessageKey(0), 'ride.load.settling');
  assert.equal(startHoldMessageKey(0, 'ride.load.findingWay'), 'ride.load.findingWay');
  assert.equal(startHoldMessageKey(START_HOLD_MESSAGE_AFTER_MS), 'ride.load.buildingCity');
});

test('a capped hold dissolves over 600 ms; a settled one cuts', () => {
  assert.equal(revealDissolveAlpha(0, false), 0);
  assert.equal(revealDissolveAlpha(0, true), 1);
  assert.equal(revealDissolveAlpha(REVEAL_DISSOLVE_MS / 2, true), 0.25);
  assert.equal(revealDissolveAlpha(REVEAL_DISSOLVE_MS, true), 0);
  let prev = 1;
  for (let t = 0; t <= REVEAL_DISSOLVE_MS; t += 50) { const a = revealDissolveAlpha(t, true); assert.ok(a <= prev); prev = a; }
});

test('the held world is ticked at 10 Hz on desktop, 4 Hz on touch', () => {
  assert.equal(startHoldTickDue(0, null, false), true);
  assert.equal(startHoldTickDue(50, 0, false), false);
  assert.equal(startHoldTickDue(START_HOLD_TICK_MS_DESKTOP, 0, false), true);
  assert.equal(startHoldTickDue(START_HOLD_TICK_MS_DESKTOP, 0, true), false);
  assert.equal(startHoldTickDue(START_HOLD_TICK_MS_TOUCH, 0, true), true);
  assert.equal(startHoldTickDue(10, 500, false), true); // clock went back: tick
});

test('on touch only far prisms hold, and the held world is not ticked', () => {
  assert.equal(isStandIn({ distanceM: 400, owner: 'coarse' }, 600, true), false);
  assert.equal(isStandIn({ distanceM: 400, owner: 'farPending' }, 600, true), true);
  assert.equal(startTierCensus([{ distanceM: 100, owner: 'coarse' }], 600, true).standIns, 0);
  assert.equal(startHoldTicks(true), false);
  assert.equal(startHoldTicks(false), true);
});

test('a long hold rotates the building lines, and the intro hold continues where the ride hold stopped', () => {
  assert.equal(startHoldMessageKey(START_HOLD_MESSAGE_AFTER_MS - 1), 'ride.load.settling');
  assert.equal(startHoldMessageKey(START_HOLD_MESSAGE_AFTER_MS), START_HOLD_BUILDING_LINES[0]);
  assert.equal(startHoldMessageKey(START_HOLD_MESSAGE_AFTER_MS + START_HOLD_LINE_MS), START_HOLD_BUILDING_LINES[1]);
  assert.equal(startHoldMessageKey(START_HOLD_MESSAGE_AFTER_MS, 'ride.load.findingWay', 3), START_HOLD_BUILDING_LINES[3]);
  const n = START_HOLD_BUILDING_LINES.length;
  assert.equal(startHoldMessageKey(START_HOLD_MESSAGE_AFTER_MS + n * START_HOLD_LINE_MS), START_HOLD_BUILDING_LINES[0]);
  for (const key of START_HOLD_BUILDING_LINES) { assert.ok(key in en, key); assert.ok(key in nl, key); }
  assert.equal(new Set(START_HOLD_BUILDING_LINES).size, n);
});

// Named regression (2026-11-27, own engine default): at Westermarkt on a real GPU the census cleared ~4.4 s after
// navigation and the covered world fell back to 1 Hz frames; the ground installs one cell per rendered frame, so its
// built cells waited 1-2.8 s each and settle.ts's ownGround alone held the start to 7.8-9.6 s (the 10 s cap under
// SwiftShader). While a hold waits the covered frames run at the hold's tick.
test('covered frames run at the hold tick while a hold waits, 1 Hz otherwise, none once uncovered', () => {
  const base = { loading: true, waiting: true, touch: false, framesOn: true, idleMs: 1000 };
  assert.equal(coveredFrameMs(base), START_HOLD_TICK_MS_DESKTOP);
  assert.equal(coveredFrameMs({ ...base, touch: true }), START_HOLD_TICK_MS_TOUCH);
  assert.equal(coveredFrameMs({ ...base, waiting: false }), 1000);
  assert.equal(coveredFrameMs({ ...base, framesOn: false }), 1000, '?startHoldFrames=0 is the 1 Hz covered world');
  assert.equal(coveredFrameMs({ ...base, loading: false }), null);
  assert.ok(START_HOLD_TICK_MS_DESKTOP < 1000 && START_HOLD_TICK_MS_TOUCH < 1000);
  assert.ok(COVERED_GROUND_INSTALLS_PER_FRAME > 1);
});

test('?startHoldFrames is on unless asked off', () => {
  for (const v of [undefined, null, '1', true]) assert.equal(startHoldFramesEnabled(v), true);
  for (const v of ['0', 0, false, 'off']) assert.equal(startHoldFramesEnabled(v), false);
});
