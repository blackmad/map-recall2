import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SharedFrame } from './sharedFrame';

/** A renderer whose `compile` returns `materials`, each ready when `ready(material)` says so. */
const host = (materials: object[], ready: (m: object) => boolean | undefined, counts: { resets: number }, parallel = true) => {
  const programs = new Map(materials.map(m => [m, { isReady: () => ready(m) }]));
  return {
    coverPaused: false, camera: {}, scene: {},
    renderer: {
      compile: () => new Set(materials),
      resetState: () => { counts.resets++; },
      extensions: { get: (name: string) => (parallel && name === 'KHR_parallel_shader_compile' ? {} : null) },
      properties: { get: (m: object) => ({ currentProgram: programs.get(m) }) },
      // three's own poll must not be used (it throws after a context loss and never stops).
      compileAsync: () => { throw Error('three compileAsync called'); },
    },
  };
};

test('compileAsync: waits for the programs, gives up after the timeout, and never blocks without a renderer', async () => {
  const compileAsync = SharedFrame.prototype.compileAsync;
  const counts = { resets: 0 };
  let done = false;
  const a = {}, b = {};
  let resolved = false;
  const waiting = compileAsync.call(host([a, b], m => m === a || done, counts) as any, {}, 1000).then(() => { resolved = true; });
  await new Promise(r => setTimeout(r, 30));
  assert.equal(resolved, false, 'still compiling');
  done = true;
  await waiting;
  assert.equal(resolved, true);
  assert.equal(counts.resets, 1, 'GL state handed back after the synchronous part');
  // A program that never reports ready: the model still shows.
  let t0 = Date.now();
  await compileAsync.call(host([a], () => false, counts) as any, {}, 20);
  assert.ok(Date.now() - t0 < 500);
  // Without the parallel-compile extension the first check waits a tick, then the same poll.
  await compileAsync.call(host([a], () => true, counts, false) as any, {}, 1000);
  await compileAsync.call({ coverPaused: false, renderer: null } as any, {});
  t0 = Date.now();
  await compileAsync.call({ ...host([a], () => false, counts), coverPaused: true } as any, {}, 60_000);
  assert.ok(Date.now() - t0 < 500, 'behind a covering card: at once');
});

test('compileAsync after a context loss: no program (reset properties) counts as ready, nothing throws, the poll ends', async () => {
  const compileAsync = SharedFrame.prototype.compileAsync;
  const counts = { resets: 0 };
  const m = {};
  const lost = host([m], () => false, counts);
  lost.renderer.properties = { get: () => ({ currentProgram: undefined }) } as any;
  const errors: unknown[] = [];
  const onError = (e: unknown) => errors.push(e);
  process.on('uncaughtException', onError);
  try {
    const t0 = Date.now();
    await compileAsync.call(lost as any, {}, 2000);
    assert.ok(Date.now() - t0 < 200, 'resolves without waiting for the timeout');
    // A program that throws on isReady (a deleted GL program) is also treated as ready.
    const throwing = host([m], () => { throw TypeError('isReady of undefined'); }, counts);
    await compileAsync.call(throwing as any, {}, 2000);
    await new Promise(r => setTimeout(r, 40));
    assert.deepEqual(errors, []);
  } finally { process.off('uncaughtException', onError); }
});
