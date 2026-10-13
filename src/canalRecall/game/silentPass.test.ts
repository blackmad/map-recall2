import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAVE_STREET_SECONDS, advanceSilentPass, beginSilentPass, questionFreezesRide } from './silentPass.ts';

function ride(name: string, roads: string[], dt = 0.1): number {
  let state = beginSilentPass(name);
  for (let i = 0; i < roads.length; i++) {
    const step = advanceSilentPass(state, { dt, roadName: roads[i] });
    state = step.state;
    if (step.left) return i;
  }
  return -1;
}

test('a silent pass ends once the street has been left for a while', () => {
  const roads = [...Array(40).fill('Nes'), ...Array(20).fill('Damstraat')];
  const leftAt = ride('Nes', roads);
  assert.ok(leftAt >= 40 + Math.round(LEAVE_STREET_SECONDS / 0.1) - 1, `left at step ${leftAt}`);
});

test('a junction wobble does not count as leaving', () => {
  const roads = [...Array(20).fill('Nes'), 'Damstraat', 'Damstraat', ...Array(30).fill('Nes')];
  assert.equal(ride('Nes', roads), -1);
});

test('riding off the mapped network counts as leaving', () => {
  assert.notEqual(ride('Nes', [...Array(5).fill('Nes'), ...Array(20).fill('')]), -1);
});

test('every question freezes the ride; a silent pass never does', () => {
  assert.equal(questionFreezesRide(true, false), true);
  assert.equal(questionFreezesRide(true, true), false);
  assert.equal(questionFreezesRide(false, false), false);
});
