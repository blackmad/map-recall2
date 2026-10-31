import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SharedFrame } from './sharedFrame';

test('compileAsync: waits for the programs, gives up after the timeout, and never blocks without a renderer', async () => {
  const compileAsync = SharedFrame.prototype.compileAsync;
  let resets = 0;
  const host = (ready: Promise<unknown>) => ({ coverPaused: false, camera: {}, scene: {}, renderer: { compileAsync: () => ready, resetState: () => { resets++; } } });
  let settle!: () => void;
  const pending = new Promise<void>(resolve => { settle = resolve; });
  let resolved = false;
  const waiting = compileAsync.call(host(pending) as any, {}, 1000).then(() => { resolved = true; });
  await new Promise(r => setTimeout(r, 5));
  assert.equal(resolved, false, 'still compiling');
  settle();
  await waiting;
  assert.equal(resolved, true);
  assert.equal(resets, 1, 'GL state handed back after the synchronous part');
  // A program that never reports ready (lost context): the model still shows.
  const t0 = Date.now();
  await compileAsync.call(host(new Promise(() => {})) as any, {}, 20);
  assert.ok(Date.now() - t0 < 500);
  await compileAsync.call({ coverPaused: false, renderer: null } as any, {});
  await compileAsync.call({ ...host(new Promise(() => {})), coverPaused: true } as any, {}, 60_000);
});
