import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGroundWorkers, groundFocusFlag, groundQuickFlag, groundWorkersFlag, inFocusBlock, pickWorker } from './groundWorkers';

test('groundWorkersFlag reads 1–4 from the query, else the fallback', () => {
  assert.equal(groundWorkersFlag(1, '?groundWorkers=3'), 3);
  assert.equal(groundWorkersFlag(2, '?groundWorkers=1'), 1);
  assert.equal(groundWorkersFlag(2, '?groundWorkers=9'), 2);
  assert.equal(groundWorkersFlag(2, '?groundWorkers=x'), 2);
  assert.equal(groundWorkersFlag(3, ''), 3);
  assert.equal(groundWorkersFlag(7, ''), 4);
});

test('pickWorker: one worker is always 0', () => {
  assert.equal(pickWorker('a', 1, new Map([['a', 0]]), ['a', 'b']), 0);
});

test('pickWorker balances new cells over the workers', () => {
  const assigned = new Map<string, number>(), pending: string[] = [];
  for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) { pending.push(k); const w = pickWorker(k, 3, assigned, pending); assigned.set(k, w); }
  assert.deepEqual([...assigned.values()], [0, 1, 2, 0, 1, 2]);
});

test('pickWorker keeps a still-pending cell on its worker (a new level replaces the queued one there)', () => {
  assert.equal(pickWorker('a', 2, new Map([['a', 1], ['b', 0], ['c', 0]]), ['a', 'b', 'c']), 1);
});

test('pickWorker sends an unassigned cell to the least busy worker', () => {
  assert.equal(pickWorker('d', 2, new Map([['b', 0], ['c', 0]]), ['b', 'c', 'd']), 1);
});

test('inFocusBlock: the focus cell and its 8 neighbours', () => {
  assert.equal(inFocusBlock('0_0', '0_0'), true);
  assert.equal(inFocusBlock('-1_1', '0_0'), true);
  assert.equal(inFocusBlock('2_0', '0_0'), false);
  assert.equal(inFocusBlock('0_0', null), false);
  assert.equal(groundFocusFlag('?groundFocus=0'), false);
  assert.equal(groundFocusFlag(''), true);
});

test('defaults: three workers on desktop, one on touch; quick first paint opt-in', () => {
  assert.equal(defaultGroundWorkers('full'), 3);
  assert.equal(defaultGroundWorkers('touch'), 1);
  assert.equal(groundQuickFlag(''), false);
  assert.equal(groundQuickFlag('?groundQuick=1'), true);
});
