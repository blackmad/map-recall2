import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RenderGovernor, governMapRender, GAP_MS, chooseTier, retier, TIER_FRAME_MS, TIER_SETTINGS, type TierProbe } from './renderGovernor';

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
  governMapRender(map, { now: () => t, setShadows: on => { shadows = on; }, settleMs: 0 });
  for (let i = 0; i < 2000 && listeners.size; i++) { t += 60; for (const f of [...listeners]) f(); }
  assert.equal(ratio, 0.75);
  assert.equal(shadows, false);
  assert.equal(listeners.size, 0);
});

test('frames outside the active state never count', () => {
  let t = 0, ratio = 2, riding = false;
  const listeners = new Set<() => void>();
  const map = { on: (_: 'render', f: () => void) => listeners.add(f), getPixelRatio: () => ratio, setPixelRatio: (r: number) => { ratio = r; } };
  const g = governMapRender(map, { now: () => t, active: () => riding, settleMs: 0 });
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

test('the loading stretch after a start or a pause is not judged', () => {
  const g = new RenderGovernor({ initialPixelRatio: 2, shadows: true, settleMs: 12_000 });
  // 10 s of 50 ms loading frames: inside the settle period, no step.
  assert.equal(feed(g, 50, 200).length, 0);
  // Once loaded the ride holds 60 Hz: still no step.
  assert.equal(feed(g, 16.7, 600).length, 0);
  assert.deepEqual(g.steps, []);
  // A machine that stays slow past the settle period still steps (two 1.5 s windows).
  assert.equal(feed(g, 33, 92).length, 1);
  // A pause starts a fresh settle period.
  g.frame(GAP_MS + 1);
  assert.equal(feed(g, 50, 200).length, 0);
});

test('governMapRender settles 12 s by default', () => {
  let t = 0, ratio = 1.5;
  const listeners = new Set<() => void>();
  const map = { on: (_: 'render', f: () => void) => listeners.add(f), getPixelRatio: () => ratio, setPixelRatio: (r: number) => { ratio = r; } };
  governMapRender(map, { now: () => t });
  const run = (ms: number, frames: number) => { for (let i = 0; i < frames; i++) { t += ms; for (const f of listeners) f(); } };
  run(50, 230); // 11.5 s of slow loading
  assert.equal(ratio, 1.5);
  run(50, 120); // still slow 6 s later: now it steps
  assert.equal(ratio, 1.13);
});

test('a pixel-ratio step never resizes the canvas inside render, and draws right after it does (issue #64)', () => {
  // `render` fires after MapLibre drew the frame: resizing there clears the drawing buffer and the browser
  // composites the empty canvas, a one-frame white flash of the page background.
  let t = 0, ratio = 2, inRender = false;
  const calls: string[] = [];
  const deferred: Array<() => void> = [];
  const listeners = new Set<() => void>();
  const map = {
    on: (_: 'render', f: () => void) => listeners.add(f),
    getPixelRatio: () => ratio,
    setPixelRatio: (r: number) => { assert.equal(inRender, false, 'resized inside render'); ratio = r; calls.push(`resize ${r}`); },
    redraw: () => { calls.push('redraw'); },
  };
  const g = governMapRender(map, { now: () => t, settleMs: 0, defer: apply => deferred.push(apply) });
  for (let i = 0; i < 200 && !g.steps.length; i++) { t += 50; inRender = true; for (const f of listeners) f(); inRender = false; }
  assert.equal(g.steps.length, 1);
  assert.equal(ratio, 2, 'not applied inside the render event');
  assert.equal(deferred.length, 1);
  deferred.shift()!();
  assert.deepEqual(calls, ['resize 1.5', 'redraw'], 'the resized canvas is drawn in the same task');
});

test('inside a tier the pixel ratio steps back up after fast windows, never above the cap, and a bounce ends it', () => {
  const g = new RenderGovernor({ initialPixelRatio: 2, maxPixelRatio: 2, windowFrames: 10, slowWindows: 2, fastWindows: 3 });
  const windows = (ms: number, n: number) => { const steps = []; for (let i = 0; i < n * 10; i++) { const s = g.frame(ms); if (s) steps.push(s); } return steps; };
  assert.deepEqual(windows(30, 2).map(s => s.kind === 'pixelRatio' && s.to), [1.5]);
  assert.deepEqual(windows(16.7, 2), [], 'two fast windows are not enough');
  const up = windows(16.7, 1);
  assert.equal(up.length, 1);
  assert.deepEqual(up[0].kind === 'pixelRatio' && [up[0].from, up[0].to], [1.5, 2]);
  assert.deepEqual(windows(16.7, 6), [], 'already at the cap');
  assert.deepEqual(windows(30, 2).map(s => s.kind === 'pixelRatio' && s.to), [1.5], 'down again: a bounce');
  assert.deepEqual(windows(16.7, 9), [], 'no second climb after a bounce');
});

test('without a tier cap the ladder stays one-way (MapLibre path unchanged)', () => {
  const g = new RenderGovernor({ initialPixelRatio: 2, windowFrames: 10 });
  for (let i = 0; i < 20; i++) g.frame(30);
  assert.equal(g.pixelRatio, 1.5);
  for (let i = 0; i < 200; i++) assert.equal(g.frame(16.7), null);
});

test('tier choice: only a missed probe budget or a software GPU lowers it; ?tier= wins', () => {
  const fast: TierProbe = { frameMs: 1.2, gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro)', deviceMemory: 8, hardwareConcurrency: 12, dpr: 2, coarse: false };
  assert.equal(chooseTier(fast).tier, 'high');
  assert.equal(chooseTier({ ...fast, gpu: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))' }).tier, 'low');
  assert.equal(chooseTier({ ...fast, frameMs: TIER_FRAME_MS.mid + 1 }).tier, 'mid');
  assert.equal(chooseTier({ ...fast, frameMs: TIER_FRAME_MS.low + 1 }).tier, 'low');
  // Touch, small memory and few cores do not lower it by themselves (the device defaults already do).
  assert.equal(chooseTier({ ...fast, coarse: true, deviceMemory: 2, hardwareConcurrency: 2 }).tier, 'high');
  assert.equal(chooseTier({ ...fast, frameMs: null }).tier, 'high');
  assert.deepEqual(chooseTier({ ...fast, gpu: 'llvmpipe' }, 'high'), { tier: 'high', reasons: ['asked'] });
  // high is the frame before tiers: native ratio, 2048² ceiling, device facade and ground levels.
  assert.deepEqual({ ...TIER_SETTINGS.high }, { shadows: true, shadowMapSize: 2048, standIns: true, facadeDetail: null, dprCap: Infinity, ground: null });
  assert.equal(TIER_SETTINGS.mid.ground, null);
  assert.deepEqual(TIER_SETTINGS.low.ground, { detail: 'touch', near: 'all', ring: 'view' });
  assert.equal(TIER_SETTINGS.mid.dprCap, 1.5);
  assert.equal(TIER_SETTINGS.low.dprCap, 1);
});

// Named regression (lane LS, 2026-11-13, reviewer on "?engine=own SUPER jerky", machine load 30-48): the tier was
// chosen once from a boot probe and the governor never left it, so a start on a busy machine held a retina screen at
// 1x/1.5x with touch detail for the session. A start under load must end at the idle machine's tier.
test('tier re-probe: a start under load ends at the idle machine\'s tier', () => {
  const idle: TierProbe = { frameMs: 1.9, gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro)', deviceMemory: 8, hardwareConcurrency: 14, dpr: 2, coarse: false };
  const busy = { ...idle, frameMs: TIER_FRAME_MS.low + 5 };
  const idleTier = chooseTier(idle).tier;
  for (const boot of [busy, { ...idle, frameMs: TIER_FRAME_MS.mid + 1 }]) {
    const started = chooseTier(boot);
    assert.notEqual(started.tier, idleTier);
    const raised = retier(started, idle);
    assert.equal(raised?.tier, idleTier);
    assert.match(raised!.reasons.at(-1)!, /re-probe 1\.9 ms raised (low|mid)/);
    // The governor's ceiling follows: straight to the new cap. A machine still slow there steps down from it, and that
    // down straight after the raise is a bounce like any other: it stays down.
    const g = new RenderGovernor({ initialPixelRatio: 1, maxPixelRatio: TIER_SETTINGS[started.tier].dprCap, settleMs: 0 });
    assert.deepEqual(g.raiseCeiling(Math.min(2, TIER_SETTINGS[raised!.tier].dprCap)), { kind: 'pixelRatio', from: 1, to: 2, p75Ms: 0 });
    assert.equal(g.pixelRatio, 2);
    feed(g, 30, 180);
    assert.ok(g.pixelRatio < 2);
    g.frame(0);
    const down = g.pixelRatio;
    feed(g, 10, 90 * 8);
    assert.equal(g.pixelRatio, down);
  }
  // Only upwards, and never for an asked tier, a software renderer, or a still-slow machine.
  assert.equal(retier({ tier: 'mid', reasons: ['probe 9 ms > 8'] }, busy), null);
  assert.equal(retier(chooseTier(idle, 'low'), idle), null);
  assert.equal(retier({ tier: 'low', reasons: ['software renderer'] }, idle), null);
  assert.equal(retier({ tier: 'high', reasons: [] }, idle), null);
  // A fixed ?dpr= never moves.
  assert.equal(new RenderGovernor({ initialPixelRatio: 1, fixedPixelRatio: true, maxPixelRatio: 1 }).raiseCeiling(2), null);
});
