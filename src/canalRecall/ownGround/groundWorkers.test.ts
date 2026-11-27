import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultGroundWorkers, dispatchTier, groundWorkersFlag, inFocusBlock, nextDispatch, sharedNeighbours } from './groundWorkers';

test('groundWorkersFlag reads 1–4 from the query, else the fallback', () => {
  assert.equal(groundWorkersFlag(1, '?groundWorkers=3'), 3);
  assert.equal(groundWorkersFlag(2, '?groundWorkers=1'), 1);
  assert.equal(groundWorkersFlag(2, '?groundWorkers=9'), 2);
  assert.equal(groundWorkersFlag(2, '?groundWorkers=x'), 2);
  assert.equal(groundWorkersFlag(3, ''), 3);
  assert.equal(groundWorkersFlag(7, ''), 4);
});

test('inFocusBlock: the focus cell and its 8 neighbours', () => {
  assert.equal(inFocusBlock('0_0', '0_0'), true);
  assert.equal(inFocusBlock('-1_1', '0_0'), true);
  assert.equal(inFocusBlock('2_0', '0_0'), false);
  assert.equal(inFocusBlock('0_0', null), false);
});

test('defaults: three workers on desktop, one on touch', () => {
  assert.equal(defaultGroundWorkers('full'), 3);
  assert.equal(defaultGroundWorkers('touch'), 1);
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
});

test('nextDispatch with lodOf: affinity never takes a coarser cell ahead of the best-ranked level (R5-A #260 step 3)', () => {
  // The 2026-11-09 start: worker 0 (holding -1_0's neighbourhood) free, waiting 0_-1@0 then -2_0@1, -2_-1@1.
  const seen = [new Set(['-2_-1', '-2_0', '-2_1', '-1_-1', '-1_0', '-1_1', '0_-1', '0_0', '0_1'])];
  const aff = (k: string, w: number) => sharedNeighbours(k, seen[w]);
  const lod = new Map([['0_-1', 0], ['-2_0', 1], ['-2_-1', 1]]);
  const order = ['0_-1', '-2_0', '-2_-1'], pending = new Set(order);
  assert.deepEqual(nextDispatch(order, pending, new Set(), [0], 1, 4, aff), [['-2_0', 0]], 'affinity alone crosses levels');
  assert.deepEqual(nextDispatch(order, pending, new Set(), [0], 1, 4, aff, k => lod.get(k)), [['0_-1', 0]]);
  // Among L1 cells affinity still chooses.
  const l1 = ['-2_-2', '-2_0'], lod1 = () => 1;
  assert.deepEqual(nextDispatch(l1, new Set(l1), new Set(), [0], 1, 4, aff, lod1), [['-2_0', 0]]);
});

test('dispatchTier with the focus block: affinity never takes an L1 cell outside the block ahead of one inside (R5-A #260)', () => {
  // The 2026-11-09 start: focus 0_-1, worker 0 holding -1_0 and 0_-1; waiting 1_-2@1 (block) then -1_1@1, 0_1@1 (outside).
  const seen = [new Set(['-2_-1', '-2_0', '-2_1', '-1_-1', '-1_0', '-1_1', '0_-1', '0_0', '0_1', '-1_-2', '0_-2', '1_-2', '1_-1', '1_0'])];
  const aff = (k: string, w: number) => sharedNeighbours(k, seen[w]);
  const order = ['1_-2', '-1_1', '0_1'], pending = new Set(order);
  assert.deepEqual(nextDispatch(order, pending, new Set(), [0], 1, 4, aff, k => dispatchTier(k, 1, undefined)), [['-1_1', 0]], 'level only: crosses the block edge');
  assert.deepEqual(nextDispatch(order, pending, new Set(), [0], 1, 4, aff, k => dispatchTier(k, 1, '0_-1')), [['1_-2', 0]]);
  assert.equal(dispatchTier('1_-2', 1, '0_-1'), '1:1');
  assert.equal(dispatchTier('-1_1', 1, '0_-1'), '1:0');
  assert.equal(dispatchTier('-1_1', 0, undefined), '0');
});
