import { test } from 'node:test';
import assert from 'node:assert/strict';

// A private window can leave indexedDB.open pending forever; the cache must give up and let the ride build.
// (Its own file: the module memoises its open, so this needs a fresh module instance.)
test('an open that never settles times out to a miss', async () => {
  (globalThis as { indexedDB?: unknown }).indexedDB = { open: () => ({}) };
  try {
    const { readRoadWorld, OPEN_TIMEOUT_MS } = await import('./roadWorldCache.ts');
    const t0 = Date.now();
    assert.equal(await readRoadWorld('k'), null);
    const waited = Date.now() - t0;
    assert.ok(waited >= OPEN_TIMEOUT_MS - 50 && waited < OPEN_TIMEOUT_MS + 1000, `gave up after ${waited} ms`);
  } finally {
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
  }
});

test('an open that throws is a miss', async () => {
  (globalThis as { indexedDB?: unknown }).indexedDB = { open: () => { throw new Error('SecurityError'); } };
  try {
    const mod = await import(`./roadWorldCache.ts?throws=${Date.now()}`);
    assert.equal(await mod.readRoadWorld('k'), null);
  } finally {
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
  }
});
