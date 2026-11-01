import { test } from 'node:test';
import assert from 'node:assert/strict';
import { awaitWorkerPool } from './workerPool';

const KEY = '__canalRecallWorkerPool';
const g = globalThis as unknown as Record<string, unknown>;

// 2026-11-01: the engine overview asked `existingWorkerPool()` while the facades layer, which starts the pool, was
// still loading in parallel; "pool" or "main" was a race. The overview now waits for the pool's decision.
test('awaitWorkerPool resolves when the pool is decided, null on decline, null on timeout', async () => {
  delete g[KEY];
  const late = awaitWorkerPool(1000, 5);
  setTimeout(() => { g[KEY] = { size: 1 }; }, 30);
  assert.deepEqual(await late, { size: 1 });
  g[KEY] = null;
  assert.equal(await awaitWorkerPool(1000, 5), null, 'declined pool answers null at once');
  delete g[KEY];
  const t0 = Date.now();
  assert.equal(await awaitWorkerPool(60, 5), null);
  assert.ok(Date.now() - t0 >= 55, 'waits the timeout when nobody decides');
  delete g[KEY];
});
