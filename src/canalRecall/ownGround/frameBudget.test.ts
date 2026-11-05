import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameBudget, GROUND_FRAME_BUDGET_MS, groundFrameBudgetMs, pageFrameBudget } from './frameBudget';

function fake(budgetMs = 8) {
  let t = 0;
  const log: string[] = [];
  const b = new FrameBudget({
    now: () => t,
    nextFrame: async () => { log.push('frame'); },
    yieldTask: async () => { log.push('task'); },
  }, budgetMs);
  return { b, log, work: (ms: number) => { t += ms; } };
}

test('slices share one budget per frame: the slice that spends it waits for the next frame', async () => {
  const { b, log, work } = fake(8);
  work(3); await b.yield();
  work(3); await b.yield();
  work(3); await b.yield(); // 9 ms this frame
  work(3); await b.yield(); // still the same frame: over budget again
  assert.deepEqual(log, ['task', 'task', 'frame', 'frame']);
  assert.equal(b.deferrals, 2);
  b.onFrame();
  work(2); await b.yield();
  assert.equal(log.at(-1), 'task', 'a new frame starts a fresh budget');
  assert.equal(b.spent, 2);
});

test('an explicit slice start counts only that slice', async () => {
  const { b, log, work } = fake(8);
  work(50); // idle (a fetch) before the slice
  const start = 50;
  work(2); await b.yield(start);
  assert.deepEqual(log, ['task']);
  assert.equal(b.spent, 2);
});

test('flag parsing', () => {
  assert.equal(groundFrameBudgetMs(''), GROUND_FRAME_BUDGET_MS);
  assert.equal(groundFrameBudgetMs('?engine=own&groundFrameBudget=0'), null);
  assert.equal(groundFrameBudgetMs('?groundFrameBudget=off'), null);
  assert.equal(groundFrameBudgetMs('?groundFrameBudget=5'), 5);
  assert.equal(groundFrameBudgetMs('?groundFrameBudget=x'), null);
});

test('no page budget without a document (the worker)', () => {
  assert.equal(pageFrameBudget(), null);
});
