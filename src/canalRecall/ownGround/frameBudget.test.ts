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
  assert.equal(groundFrameBudgetMs(''), GROUND_FRAME_BUDGET_MS, 'on by default since the ride-start A/B (lane E5, #218)');
  assert.equal(groundFrameBudgetMs('?groundFrameBudget=1'), GROUND_FRAME_BUDGET_MS);
  assert.equal(groundFrameBudgetMs('?groundFrameBudget=on'), GROUND_FRAME_BUDGET_MS);
  assert.equal(groundFrameBudgetMs('?engine=own&groundFrameBudget=0'), null);
  assert.equal(groundFrameBudgetMs('?groundFrameBudget=off'), null);
  assert.equal(groundFrameBudgetMs('?groundFrameBudget=5'), 5);
  assert.equal(groundFrameBudgetMs('?groundFrameBudget=x'), null);
});

test('no page budget without a document (the worker)', () => {
  assert.equal(pageFrameBudget(), null);
});

test('gate (lane E6): slices resuming after the same paint run one per frame, never starving', async () => {
  let t = 0, b: FrameBudget;
  const waiters: Array<() => void> = [];
  b = new FrameBudget({
    now: () => t,
    nextFrame: () => new Promise<void>(r => waiters.push(r)),
    yieldTask: async () => {},
  }, 8, true);
  const ran: number[][] = [];
  let frame = 0;
  // Three chains, each: 10 ms of work, yield, 10 ms of work, done.
  const chain = async (id: number) => { t += 10; (ran[frame] ??= []).push(id); await b.yield(t - 10); t += 10; (ran[frame] ??= []).push(id); await b.yield(t - 10); };
  const all = Promise.all([chain(0), chain(1), chain(2)]);
  // Paint: the frame ticks, every waiter resumes in the same gap.
  for (let i = 0; i < 12 && waiters.length; i++) {
    frame++; b.onFrame();
    const now = waiters.splice(0);
    for (const r of now) { r(); await new Promise(res => setImmediate(res)); }
  }
  await all;
  for (let f = 1; f < ran.length; f++) assert.ok((ran[f]?.length ?? 0) <= 1, `frame ${f} ran ${ran[f]?.length} slices`);
  assert.equal(ran.flat().length, 6, 'every slice ran');
  assert.ok(b.regated > 0);
});

test('gate flag', async () => {
  const { groundBudgetGate } = await import('./frameBudget');
  assert.equal(groundBudgetGate(''), true);
  assert.equal(groundBudgetGate('?groundBudgetGate=0'), false);
});
