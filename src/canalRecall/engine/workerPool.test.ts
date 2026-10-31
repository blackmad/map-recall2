// The one worker pool (engine/workerPool.ts): subscribers share workers, claim only their own replies, and hear
// when a worker dies. Run: node --import tsx --test src/canalRecall/engine/workerPool.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkerPool, poolWorkerUrl, sharedWorkerPool, withWorkerFlags } from './workerPool.js';

class Echo {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  terminated = false;
  postMessage(message: unknown) { setTimeout(() => this.onmessage?.({ data: structuredClone(message) })); }
  terminate() { this.terminated = true; }
}

test('pool: replies go to the subscriber that claims them; a dead worker is reported and skipped', async () => {
  const fakes: Echo[] = [];
  const pool = new WorkerPool('w.js', 3, () => { const e = new Echo(); fakes.push(e); return e as unknown as Worker; });
  assert.equal(pool.size, 3); assert.equal(pool.live, 3);
  const a: unknown[] = [], b: unknown[] = [], failed: number[] = [];
  pool.subscribe(d => (d as { to?: string }).to === 'a' && (a.push(d), true));
  pool.subscribe((d, w) => (d as { to?: string }).to === 'b' && (b.push([w, d]), true), w => failed.push(w));
  pool.post(0, { to: 'a', n: 1 }); pool.post(2, { to: 'b', n: 2 });
  await new Promise(r => setTimeout(r, 5));
  assert.deepEqual(a, [{ to: 'a', n: 1 }]);
  assert.deepEqual(b, [[2, { to: 'b', n: 2 }]]);
  fakes[1].onerror?.(new Error('boom'));
  assert.deepEqual(failed, [1]);
  assert.ok(fakes[1].terminated);
  assert.equal(pool.alive(1), false); assert.equal(pool.size, 3); assert.equal(pool.live, 2);
  assert.equal(pool.post(1, { to: 'a' }), false, 'no post to a dead worker');
  assert.equal(pool.messages, 2);
});

test('pool: worker URL next to any bundle, with the building A/B flags', () => {
  assert.equal(poolWorkerUrl('https://x/canal-drive/js/own-ground-game.bundle.js?v=3'), 'https://x/canal-drive/js/three-buildings-worker.bundle.js?v=3');
  assert.equal(poolWorkerUrl('https://x/canal-drive/js/game.js'), '');
  assert.equal(withWorkerFlags('w.js', '?modernFacades=1&world=v1'), 'w.js?modernFacades=1');
  assert.equal(withWorkerFlags('w.js?v=2', '?buurtProfiles=0'), 'w.js?v=2&buurtProfiles=0');
});

test('pool: the page shares one; none without Worker', () => {
  delete (globalThis as Record<string, unknown>).__canalRecallWorkerPool;
  assert.equal(sharedWorkerPool('w.js'), null, 'Node: no Worker');
  assert.equal(sharedWorkerPool('w.js'), null, 'remembered');
  delete (globalThis as Record<string, unknown>).__canalRecallWorkerPool;
});
