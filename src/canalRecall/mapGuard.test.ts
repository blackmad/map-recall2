import test from 'node:test';
import assert from 'node:assert/strict';
import { guardMapRender, isDeadGpuShaderError, reportWebglUnavailable, type GuardableMap, type GraphicsFailure } from './mapGuard';

test('a dead GPU is recognised by its empty shader info log', () => {
  for (const message of [
    'Could not compile fragment shader: ',
    'Could not compile fragment shader:',
    'Could not compile vertex shader: null',
    'Program failed to link: ',
  ]) {
    assert.ok(isDeadGpuShaderError(new Error(message)), message);
  }
  assert.ok(isDeadGpuShaderError('Could not compile fragment shader: '));
});

test('a real GLSL error keeps its log and is never swallowed', () => {
  assert.equal(
    isDeadGpuShaderError(new Error("Could not compile fragment shader: ERROR: 0:12: 'foo' : undeclared identifier")),
    false,
  );
  assert.equal(isDeadGpuShaderError(new Error('Program failed to link: too many varyings')), false);
  assert.equal(isDeadGpuShaderError(new Error('something else')), false);
});

test('swallows the dead-GPU throw, holds one frame, then retries', () => {
  let clock = 0;
  let renders = 0;
  const reported: string[] = [];
  const map: GuardableMap = {
    _render() {
      renders += 1;
      throw new Error('Could not compile fragment shader: ');
    },
    triggerRepaint() {},
  };

  assert.equal(
    guardMapRender(map, {
      holdMs: 2000,
      now: () => clock,
      schedule: () => 1,
      cancel: () => {},
      report: failure => reported.push(failure.event),
      onNotice: () => {},
    }),
    true,
  );

  assert.equal(map._render!(), undefined);
  assert.equal(renders, 1);
  assert.deepEqual(reported, ['dead-gpu-shader']);

  map._render!();
  assert.equal(renders, 1, 'the next frame is held so context loss can arrive');

  clock = 2000;
  map._render!();
  assert.equal(renders, 2, 'drawing resumes after the hold');
  assert.deepEqual(reported, ['dead-gpu-shader'], 'one report per page, not one per frame');
});

test('rethrows genuine shader errors, with their log', () => {
  const map: GuardableMap = {
    _render() {
      throw new Error("Could not compile fragment shader: ERROR: 0:3: 'x' : syntax error");
    },
  };
  guardMapRender(map, { report: () => {}, onNotice: () => {} });
  assert.throws(() => map._render!(), /syntax error/);
});

test('reports a context loss once, with the device diagnostics', () => {
  const listeners: Record<string, () => void> = {};
  const reported: Array<{ event: string; heapMB: number | null; canvas: unknown; hardwareConcurrency: number | null }> = [];
  const map: GuardableMap = {
    _render() {},
    on(event, listener) {
      listeners[event] = listener;
    },
  };
  assert.equal(
    guardMapRender(map, {
      report: failure => reported.push(failure),
      onNotice: () => {},
      schedule: () => 1,
      cancel: () => {},
    }),
    true,
  );

  assert.equal(typeof listeners.webglcontextlost, 'function');
  listeners.webglcontextlost();
  listeners.webglcontextlost();

  assert.equal(reported.length, 1, 'one context-loss report per map, not one per event');
  assert.equal(reported[0].event, 'webgl-context-lost');
  assert.equal(reported[0].canvas, null, 'no canvas on the stub map');
  assert.equal(typeof reported[0].hardwareConcurrency, 'number');
});

test('a shader failure and the following context loss are reported as separate events', () => {
  const listeners: Record<string, () => void> = {};
  const events: string[] = [];
  let renders = 0;
  const map: GuardableMap = {
    _render() {
      renders += 1;
      throw new Error('Could not compile fragment shader: ');
    },
    on(event, listener) {
      listeners[event] = listener;
    },
  };
  guardMapRender(map, {
    now: () => 0,
    schedule: () => 1,
    cancel: () => {},
    report: failure => events.push(failure.event),
    onNotice: () => {},
  });

  map._render!();
  listeners.webglcontextlost();
  assert.equal(renders, 1);
  assert.deepEqual(events, ['dead-gpu-shader', 'webgl-context-lost']);
});

test('does not wrap the same map twice or a map without a render loop', () => {
  const map: GuardableMap = { _render() {} };
  assert.equal(guardMapRender(map), true);
  assert.equal(guardMapRender(map), false);
  assert.equal(guardMapRender({}), false);
  assert.equal(guardMapRender(null), false);
});

test('a browser that refuses WebGL is reported once with its reason (CANAL-RECALL-C)', () => {
  const reported: GraphicsFailure[] = [];
  const refusal = new Error('{"statusMessage":"Web page caused context loss and was blocked","type":"webglcontextcreationerror","message":"Failed to initialize WebGL"}');
  const failure = reportWebglUnavailable(null, refusal, detail => reported.push(detail));
  assert.equal(reported.length, 1);
  assert.equal(failure.event, 'webgl-unavailable');
  assert.match(String(failure.message), /caused context loss and was blocked/);
});

test('a restore whose layers did not come back keeps the reload notice up (CANAL-RECALL-7)', () => {
  const listeners: Record<string, () => void> = {};
  const reported: Array<{ event: string; restoredOk?: boolean | null; lostForMs?: number | null; probe?: unknown }> = [];
  const notices: boolean[] = [];
  const queue: Array<{ callback: () => void; ms: number }> = [];
  let clock = 1000;
  const map: GuardableMap = {
    _render() {},
    on(event, listener) {
      listeners[event] = listener;
    },
  };
  guardMapRender(map, {
    report: failure => reported.push(failure),
    onNotice: visible => notices.push(visible),
    schedule: (callback, ms) => queue.push({ callback, ms }),
    cancel: () => {},
    now: () => clock,
    restoredOk: () => false,
    probe: () => ({ programs: 12 }),
  });

  listeners.webglcontextlost();
  assert.equal(queue[0].ms, 2500, 'the loss offers a reload within a few seconds');
  assert.deepEqual(reported[0].probe, { programs: 12 });
  clock += 4000;
  listeners.webglcontextrestored();
  queue[queue.length - 1].callback();

  assert.equal(reported[1].event, 'webgl-context-restored');
  assert.equal(reported[1].restoredOk, false);
  assert.equal(reported[1].lostForMs, 4000);
  assert.deepEqual(notices, [true], 'the notice is shown and not hidden again');
});
