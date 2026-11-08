import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  START_SETTLE_CAP_DESKTOP_MS, START_SETTLE_CAP_TOUCH_MS, START_SETTLE_TIERS,
  StartSettleHold, isTouchPointer, startSettleCoveredFrameMs, startSettleCapMs, startSettleEnabled, startSettlePending, startSettleStep,
} from './startSettle';

const ALL = { groundCentre: true, buildings: true, far: true, baked: true };

test('the flag is on unless it is asked off', () => {
  assert.equal(startSettleEnabled(undefined), true);
  assert.equal(startSettleEnabled('1'), true);
  assert.equal(startSettleEnabled('0'), false);
  assert.equal(startSettleEnabled('false'), false);
  assert.equal(startSettleEnabled('off'), false);
  assert.equal(startSettleEnabled(false), false);
});

test('the cap is 6 s on a fine pointer and 4 s on a coarse one, never longer on touch', () => {
  assert.equal(startSettleCapMs(false), START_SETTLE_CAP_DESKTOP_MS);
  assert.equal(startSettleCapMs(false), 6000);
  assert.equal(startSettleCapMs(true), START_SETTLE_CAP_TOUCH_MS);
  assert.equal(startSettleCapMs(true), 4000);
  assert.ok(startSettleCapMs(true) <= startSettleCapMs(false));
});

test('touch comes from (pointer: coarse), and no matchMedia counts as fine', () => {
  const coarse = { matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' }) };
  const fine = { matchMedia: () => ({ matches: false }) };
  assert.equal(isTouchPointer(coarse), true);
  assert.equal(isTouchPointer(fine), false);
  assert.equal(isTouchPointer({}), false);
  assert.equal(isTouchPointer(undefined), false);
  assert.equal(isTouchPointer({ matchMedia: () => { throw new Error('no'); } }), false);
});

test('the gating tiers are the camera cell, buildings, far and baked; a missing tier is pending', () => {
  assert.deepEqual([...START_SETTLE_TIERS], ['groundCentre', 'buildings', 'far', 'baked']);
  assert.deepEqual(startSettlePending(ALL), []);
  assert.deepEqual(startSettlePending({}), ['groundCentre', 'buildings', 'far', 'baked']);
  assert.deepEqual(startSettlePending({ ...ALL, far: false }), ['far']);
  assert.deepEqual(startSettlePending({ ...ALL, groundCentre: false, baked: false }), ['groundCentre', 'baked']);
});

test('settled before the cap ends the hold at once', () => {
  const s = startSettleStep(1200, ALL, 6000);
  assert.deepEqual(s, { done: true, reason: 'settled', pending: [] });
});

test('still pending before the cap keeps the hold', () => {
  const s = startSettleStep(5999, { ...ALL, buildings: false }, 6000);
  assert.equal(s.done, false);
  assert.equal(s.reason, 'waiting');
  assert.deepEqual(s.pending, ['buildings']);
});

test('at the cap the hold ends whatever is pending', () => {
  const s = startSettleStep(6000, { ...ALL, buildings: false, baked: false }, 6000);
  assert.equal(s.done, true);
  assert.equal(s.reason, 'cap');
  assert.deepEqual(s.pending, ['buildings', 'baked']);
});

test('settling exactly at the cap is settled, not cap', () => {
  assert.equal(startSettleStep(4000, ALL, 4000).reason, 'settled');
});

test('the touch cap ends a stuck hold at 4 s, the desktop cap at 6 s', () => {
  const stuck = { groundCentre: false };
  assert.equal(startSettleStep(3999, stuck, startSettleCapMs(true)).done, false);
  assert.equal(startSettleStep(4000, stuck, startSettleCapMs(true)).reason, 'cap');
  assert.equal(startSettleStep(5999, stuck, startSettleCapMs(false)).done, false);
  assert.equal(startSettleStep(6000, stuck, startSettleCapMs(false)).reason, 'cap');
});

test('the hold advances the world at the ride pose on every poll before judging, and only while waiting', () => {
  const hold = new StartSettleHold(() => 6000);
  const calls: string[] = [];
  let landed = false;
  const advance = () => { calls.push('advance'); };
  const judge = () => { calls.push('judge'); return landed ? ALL : { ...ALL, buildings: false }; };
  assert.equal(hold.poll(1000, advance, judge), true);
  assert.equal(hold.poll(1100, advance, judge), true);
  assert.deepEqual(calls, ['advance', 'judge', 'advance', 'judge']);
  assert.deepEqual(hold.last?.pending, ['buildings']);
  landed = true;
  assert.equal(hold.poll(1200, advance, judge), false);
  assert.equal(hold.last?.reason, 'settled');
  assert.equal(hold.done, true);
  // Latched: no more advancing or judging once the hold has ended (the racing frames own the world from here).
  assert.equal(hold.poll(1300, advance, judge), false);
  assert.equal(calls.length, 6);
});

test('the hold ends at the cap, timed from its first poll, whatever is pending', () => {
  const hold = new StartSettleHold(() => 4000);
  const pending = () => ({ groundCentre: false });
  assert.equal(hold.poll(500, () => {}, pending), true);
  assert.equal(hold.poll(4499, () => {}, pending), true);
  assert.equal(hold.poll(4500, () => {}, pending), false);
  assert.equal(hold.last?.reason, 'cap');
  assert.deepEqual(hold.last?.pending, ['groundCentre', 'buildings', 'far', 'baked']);
});

test('the held frames render faster than the 1 Hz covered pace while the hold is armed, slower on touch', () => {
  assert.equal(startSettleCoveredFrameMs(false), 100);
  assert.equal(startSettleCoveredFrameMs(true), 250);
  assert.ok(startSettleCoveredFrameMs(true) < 1000);
});
