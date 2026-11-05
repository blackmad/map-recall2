import test from 'node:test';
import assert from 'node:assert/strict';
import { RebuildCoalescer, REBUILD_MIN_GAP_MS, extrasRebuildSync, type RebuildCoalescerDeps } from './rebuildCoalescer.js';

/** A fake clock with a frame queue and timers. */
function fakeDeps() {
  let t = 0;
  let frames: Array<() => void> = [];
  let timers: Array<{ at: number; cb: () => void }> = [];
  const deps: RebuildCoalescerDeps = {
    now: () => t,
    afterFrame(cb) { frames.push(cb); return () => { frames = frames.filter(f => f !== cb); }; },
    after(ms, cb) { const e = { at: t + ms, cb }; timers.push(e); return () => { timers = timers.filter(x => x !== e); }; },
  };
  return {
    deps,
    frame(ms = 16) { t += ms; const f = frames; frames = []; for (const cb of f) cb(); },
    advance(ms: number) { t += ms; const due = timers.filter(x => x.at <= t); timers = timers.filter(x => x.at > t); for (const e of due) e.cb(); },
    get waiting() { return frames.length + timers.length; },
  };
}

test('a burst of requests is one rebuild, after the next frame, never inside the caller', () => {
  const f = fakeDeps();
  let runs = 0;
  const c = new RebuildCoalescer(() => { runs++; }, f.deps);
  c.request(); c.request(); c.request();
  assert.equal(runs, 0, 'nothing runs in the requesting task');
  assert.equal(c.pending, true);
  f.frame();
  assert.equal(runs, 1);
  assert.equal(c.pending, false);
  assert.deepEqual(c.stats, { requests: 3, runs: 1 });
  f.frame();
  assert.equal(runs, 1, 'no request, no rebuild');
});

test('rebuilds are at least the minimum gap apart; requests meanwhile share the next one', () => {
  const f = fakeDeps();
  let runs = 0;
  const c = new RebuildCoalescer(() => { runs++; }, f.deps);
  c.request(); f.frame();
  assert.equal(runs, 1);
  c.request(); f.frame(); c.request(); f.frame();
  assert.equal(runs, 1, 'within the gap');
  f.advance(REBUILD_MIN_GAP_MS);
  assert.equal(runs, 2);
  assert.equal(f.waiting, 0);
});

test('flush runs a waiting rebuild now; cancel drops it', () => {
  const f = fakeDeps();
  let runs = 0;
  const c = new RebuildCoalescer(() => { runs++; }, f.deps);
  c.flush();
  assert.equal(runs, 0, 'nothing waiting');
  c.request(); c.flush();
  assert.equal(runs, 1);
  assert.equal(f.waiting, 0, 'the scheduled run is gone');
  c.request(); c.cancel(); f.frame(); f.advance(1000);
  assert.equal(runs, 1);
});

test('sync (the flag off) rebuilds on every request, as before', () => {
  let runs = 0;
  const c = new RebuildCoalescer(() => { runs++; }, fakeDeps().deps, true);
  c.request(); c.request();
  assert.equal(runs, 2);
});

test('a request made by the rebuild itself is scheduled again, not lost', () => {
  const f = fakeDeps();
  let runs = 0;
  const c = new RebuildCoalescer(() => { runs++; if (runs === 1) c.request(); }, f.deps);
  c.request(); f.frame();
  assert.equal(runs, 1);
  f.frame(); f.advance(REBUILD_MIN_GAP_MS);
  assert.equal(runs, 2);
});

test('flag: ?extrasRebuild=sync or =0 restores the old path; Node without a document is sync', () => {
  assert.equal(extrasRebuildSync('?engine=own'), false);
  assert.equal(extrasRebuildSync('?extrasRebuild=sync'), true);
  assert.equal(extrasRebuildSync('?a=1&extrasRebuild=0'), true);
  assert.equal(extrasRebuildSync(), true, 'no document in node');
});
