import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGroundWorkers, groundAffinityFlag, groundFocusFlag, groundPullFlag, groundQuickFlag, groundWorkersFlag, inFocusBlock, nextDispatch, pickWorker, sharedNeighbours } from './groundWorkers';

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

test('groundPullFlag: on unless ?groundPull=0', () => {
  assert.equal(groundPullFlag(''), true);
  assert.equal(groundPullFlag('?groundPull=0'), false);
});

test('nextDispatch fills each worker up to the depth, best-ranked first, least-held worker first', () => {
  const pending = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.deepEqual(nextDispatch(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], pending, new Set(), [0, 0, 0], 2),
    [['a', 0], ['b', 1], ['c', 2], ['d', 0], ['e', 1], ['f', 2]]);
});

test('nextDispatch skips cells already with a worker or no longer pending, and fills only free slots', () => {
  const pending = new Set(['a', 'b', 'c', 'd']);
  assert.deepEqual(nextDispatch(['x', 'a', 'b', 'c', 'd'], pending, new Set(['a']), [2, 1, 0], 2), [['b', 2], ['c', 1], ['d', 2]]);
  assert.deepEqual(nextDispatch(['a'], new Set(['a']), new Set(), [2, 2], 2), []);
  assert.deepEqual(nextDispatch(['a', 'b'], new Set(['a', 'b']), new Set(), [0], 1), [['a', 0]]);
});

test('sharedNeighbours counts the 3×3 block cells already seen', () => {
  assert.equal(sharedNeighbours('0_0', new Set(['0_0', '1_1', '2_2', '-1_0'])), 3);
  assert.equal(sharedNeighbours('5_5', new Set(['0_0'])), 0);
});

test('nextDispatch with a window: a worker takes the nearby cell it shares neighbours with, ties to rank', () => {
  const seen = [new Set(['3_0', '4_0']), new Set(['0_0'])];
  const aff = (k: string, w: number) => sharedNeighbours(k, seen[w]);
  const pending = new Set(['0_1', '2_0', '1_0', '9_9']);
  // Worker 0 (fewest held on a tie: lowest index) looks at 0_1, 2_0, 1_0 and takes 2_0 (next to 3_0); worker 1 then 0_1.
  assert.deepEqual(nextDispatch(['0_1', '2_0', '1_0', '9_9'], pending, new Set(), [0, 0], 1, 3, aff), [['2_0', 0], ['0_1', 1]]);
  // No affinity anywhere: rank order.
  assert.deepEqual(nextDispatch(['9_9', '0_1'], new Set(['9_9', '0_1']), new Set(), [0], 1, 3, () => 0), [['9_9', 0]]);
  assert.equal(groundAffinityFlag('?groundAffinity=0'), false);
  assert.equal(groundAffinityFlag(''), true);
});
