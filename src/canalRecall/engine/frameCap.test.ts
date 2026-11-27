import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_FPS_CAP, FrameCap, fpsCap, fpsCapFromQuery } from './frameCap';

/** Runs per second of a display at `hz` (with ± `jitter` ms on each stamp) under `cap`. */
function runsPerSecond(hz: number, cap: number | null, jitter = 0, seconds = 4): number {
  const c = new FrameCap();
  let runs = 0, t = 1000;
  for (let i = 0; i < hz * seconds; i++) {
    t += 1000 / hz;
    const j = jitter ? (i % 2 ? jitter : -jitter) : 0;
    if (c.admit(t + j, cap)) runs++;
  }
  return runs / seconds;
}

test('FrameCap: 120 Hz runs an even 60, slower displays run every frame, faster ones about 60', () => {
  assert.equal(runsPerSecond(120, 60), 60);
  assert.equal(runsPerSecond(120, 60, 0.6), 60, '120 Hz stamps jitter by ~half a ms');
  assert.equal(runsPerSecond(60, 60), 60);
  assert.equal(runsPerSecond(60, 60, 0.6), 60, 'a 60 Hz display is never halved');
  assert.equal(runsPerSecond(30, 60), 30);
  const at90 = runsPerSecond(90, 60), at144 = runsPerSecond(144, 60);
  assert.ok(at90 >= 58 && at90 <= 62, `90 Hz ran ${at90}, not 45`);
  assert.ok(at144 >= 58 && at144 <= 62, `144 Hz ran ${at144}`);
  assert.equal(runsPerSecond(120, null), 120, 'no cap: every frame');
  assert.equal(runsPerSecond(120, 0), 120);
});

test('FrameCap: 120 Hz alternates run / skip (no two runs in a row, no two skips)', () => {
  const c = new FrameCap(), seq: boolean[] = [];
  for (let i = 0; i < 40; i++) seq.push(c.admit(i * 1000 / 120 + (i % 3 ? 0.4 : -0.4), 60));
  for (let i = 3; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `frame ${i}: ${seq.map(b => (b ? 'R' : '.')).join('')}`);
});

test('FrameCap: a stall or a first frame runs at once', () => {
  const c = new FrameCap();
  assert.ok(c.admit(0, 60));
  assert.ok(c.admit(400, 60), 'after a 400 ms stall');
});

test('fpsCap: query wins, then the player setting, else 60', () => {
  assert.equal(fpsCapFromQuery(''), undefined);
  assert.equal(fpsCapFromQuery('?fpsCap=0'), null);
  assert.equal(fpsCapFromQuery('?fpsCap=off'), null);
  assert.equal(fpsCapFromQuery('?fpsCap=90'), 90);
  assert.equal(fpsCapFromQuery('?fpsCap=x'), undefined);
  assert.equal(fpsCap(undefined, undefined), DEFAULT_FPS_CAP);
  assert.equal(fpsCap(undefined, 0), null, '"Full frame rate" on');
  assert.equal(fpsCap(undefined, 60), 60);
  assert.equal(fpsCap(null, 60), null, '?fpsCap=0 beats the setting');
  assert.equal(fpsCap(30, 0), 30);
});

test('FrameHost: maxFps skips whole frames at 120 Hz and the fixed steps still keep real time', async () => {
  const { FrameHost } = await import('./frameHost');
  const canvas: any = { style: {}, width: 0, height: 0, addEventListener() {}, remove() {} };
  const container: any = { clientWidth: 400, clientHeight: 300, ownerDocument: { createElement: () => canvas }, appendChild() {} };
  const createRenderer = () => ({ getContext: () => ({ isContextLost: () => false }), clear() {}, setViewport() {}, setRenderTarget() {}, dispose() {} });
  let frames: Array<(t: number) => void> = [];
  let ticks = 0, renders = 0, gameFrames = 0;
  const host = new FrameHost({}, container, { tick: () => { ticks++; }, render: () => { renders++; } },
    { createRenderer, maxFps: 60, requestFrame: cb => { frames.push(cb); return 1; }, cancelFrame() {} });
  host.setSimulation({ frame: () => { gameFrames++; } });
  host.start();
  const step = (t: number) => { const f = frames; frames = []; for (const cb of f) cb(t); };
  for (let i = 0; i <= 240; i++) step(i * 1000 / 120);
  assert.equal(renders, 121, 'two seconds at 120 Hz drew 60 a second (+ the first)');
  assert.equal(gameFrames, 121, 'skipped frames run no game frame');
  assert.equal(host.stats.capSkips, 120);
  assert.ok(Math.abs(ticks - 240) <= 1, `fixed 1/120 s steps keep real time: ${ticks}`);
  host.maxFps = null;
  for (let i = 241; i <= 360; i++) step(i * 1000 / 120);
  assert.equal(renders, 241, 'uncapped: every frame');
  host.stop();
});
