import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  START_SETTLE_CAP_DESKTOP_MS, START_SETTLE_CAP_TOUCH_MS, START_SETTLE_TIERS,
  isTouchPointer, startSettleCapMs, startSettleEnabled, startSettlePending, startSettleStep,
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
