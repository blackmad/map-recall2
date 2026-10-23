import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RenderGovernor, governMapRender, GAP_MS } from './renderGovernor';

const feed = (g: RenderGovernor, ms: number, frames: number) => {
  const steps = [];
  for (let i = 0; i < frames; i++) { const s = g.frame(ms); if (s) steps.push(s); }
  return steps;
};

test('a fast machine never steps', () => {
  const g = new RenderGovernor({ initialPixelRatio: 2, shadows: true });
  // 60 Hz with the odd hitch: p75 stays at the display cadence.
  for (let i = 0; i < 3000; i++) g.frame(i % 10 === 0 ? 40 : 16.7);
  assert.deepEqual(g.steps, []);
  assert.equal(g.pixelRatio, 2);
});

test('needs two consecutive slow windows', () => {
  const g = new RenderGovernor({ initialPixelRatio: 2, shadows: true });
  assert.equal(feed(g, 33, 90).length, 0);
  feed(g, 16, 90); // a fast window resets the run
  assert.equal(feed(g, 33, 90).length, 0);
  assert.equal(feed(g, 33, 90).length, 1);
});

test('ladder: pixel ratio to 1, then shadows, then 0.75 only when very slow', () => {
  const g = new RenderGovernor({ initialPixelRatio: 2, shadows: true });
  const steps = feed(g, 33, 180 * 4);
  assert.deepEqual(steps.map(s => s.kind === 'pixelRatio' ? s.to : 'shadows'), [1.5, 1.13, 1, 'shadows']);
  assert.equal(feed(g, 33, 180).length, 0, '30 fps is not slow enough to go below 1x');
  assert.equal(g.exhausted, false);
  const last = feed(g, 50, 180);
  assert.deepEqual(last.map(s => s.kind === 'pixelRatio' && s.to), [0.75]);
  assert.equal(g.exhausted, true);
});

test('a fixed pixel ratio leaves only the shadow step', () => {
  const g = new RenderGovernor({ initialPixelRatio: 2, fixedPixelRatio: true, shadows: true });
  const steps = feed(g, 60, 180 * 3);
  assert.deepEqual(steps.map(s => s.kind), ['shadows']);
  assert.equal(g.pixelRatio, 2);
});

test('gaps (idle map, hidden tab) break the window', () => {
  const g = new RenderGovernor({ initialPixelRatio: 1.5, shadows: false });
  for (let i = 0; i < 400; i++) { g.frame(33); if (i % 60 === 0) g.frame(GAP_MS + 1); }
  assert.deepEqual(g.steps, []);
});

test('governMapRender applies steps to the map and stops when exhausted', () => {
  let t = 0, ratio = 1.5, shadows = true;
  const listeners = new Set<() => void>();
  const map = {
    on: (_: 'render', f: () => void) => listeners.add(f),
    off: (_: 'render', f: () => void) => listeners.delete(f),
    getPixelRatio: () => ratio,
    setPixelRatio: (r: number) => { ratio = r; },
  };
  governMapRender(map, { now: () => t, setShadows: on => { shadows = on; } });
  for (let i = 0; i < 2000 && listeners.size; i++) { t += 60; for (const f of [...listeners]) f(); }
  assert.equal(ratio, 0.75);
  assert.equal(shadows, false);
  assert.equal(listeners.size, 0);
});

test('frames outside the active state never count', () => {
  let t = 0, ratio = 2, riding = false;
  const listeners = new Set<() => void>();
  const map = { on: (_: 'render', f: () => void) => listeners.add(f), getPixelRatio: () => ratio, setPixelRatio: (r: number) => { ratio = r; } };
  const g = governMapRender(map, { now: () => t, active: () => riding });
  const run = (frames: number) => { for (let i = 0; i < frames; i++) { t += 50; for (const f of listeners) f(); } };
  run(1000);
  assert.equal(ratio, 2, 'a slow load does not step');
  // 50 ms frames: a window closes every 1.5 s (30 frames); two slow ones step.
  riding = true; run(40); riding = false; run(10); riding = true; run(40);
  assert.equal(ratio, 2, 'the run restarts after leaving the ride');
  run(40);
  assert.equal(g.steps.length, 1);
  assert.equal(ratio, 1.5);
});

test('a 2 fps machine steps within seconds, not minutes', () => {
  const g = new RenderGovernor({ initialPixelRatio: 1.5, shadows: true });
  let elapsed = 0;
  while (!g.steps.length && elapsed < 60_000) { g.frame(500); elapsed += 500; }
  assert.equal(g.steps.length, 1);
  assert.ok(elapsed <= 6000, `stepped after ${elapsed} ms`);
});
