import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVEAL_DISSOLVE_MS, START_HOLD_CAP_MS, START_HOLD_INTRO_MIN_MS, START_HOLD_MESSAGE_AFTER_MS, censusGrid, introHoldCapMs, isStandIn,
  revealDissolveAlpha, startHoldCapMs, startHoldTickDue, START_HOLD_TICK_MS_DESKTOP, START_HOLD_TICK_MS_TOUCH, startHoldEnabled, startHoldMessageKey, startTierCensus,
} from './startHold';

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
