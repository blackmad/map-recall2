import assert from 'node:assert/strict';
import test from 'node:test';
import { AERIAL_FPS, AERIAL_SCALE, AERIAL_SHADOW_EVERY, AERIAL_SHADOW_MAP, AerialPower, MOVE_HOLD_MS, NEUTRAL, aerialLeversFromQuery, type AerialPose } from './aerialPower';

const ALL = { fps: true, scale: true, shadows: true, mapSize: true };
const pose = (now: number, over: Partial<AerialPose> = {}): AerialPose => ({ now, aerial: true, detached: true, lng: 4.9, lat: 52.37, zoom: 17.3, pitch: 55, bearing: 110, ...over });
// 150 m/s east at 60 fps: 2.5 m per frame.
const east = (now: number, i: number, over: Partial<AerialPose> = {}) => pose(now, { lng: 4.9 + i * 2.5 / (111320 * Math.cos(52.37 * Math.PI / 180)), ...over });

test('aerialPower: levers from the query, each with its own flag; globals win', () => {
  assert.deepEqual(aerialLeversFromQuery(''), { ...ALL, scale: false, mapSize: false }, 'the scale and map-size levers are opt-in');
  assert.deepEqual(aerialLeversFromQuery('?aerialScale=1&aerialShadowMap=1'), ALL);
  assert.deepEqual(aerialLeversFromQuery('', { __canalRecallAerialScale: true, __canalRecallAerialShadowMap: true }), ALL);
  assert.deepEqual(aerialLeversFromQuery('?aerialFps=0&aerialScale=0&aerialShadowMap=1'), { ...ALL, fps: false, scale: false });
  assert.deepEqual(aerialLeversFromQuery('?aerialShadows=0'), { ...ALL, shadows: false, scale: false, mapSize: false });
  assert.deepEqual(aerialLeversFromQuery('?aerialFps=0&aerialScale=1&aerialShadowMap=1', { __canalRecallAerialFps: true }), ALL);
  assert.deepEqual(aerialLeversFromQuery('?aerialScale=1&aerialShadowMap=1', { __canalRecallAerialScale: false, __canalRecallAerialShadowMap: false }), { ...ALL, scale: false, mapSize: false });
});

test('aerialPower: a pan from the air paces, scales and throttles; settling restores within 300 ms', () => {
  const p = new AerialPower({ ...ALL });
  let d = p.update(pose(0));
  assert.equal(d.moving, false, 'the first frame has nothing to compare');
  assert.equal(d.frameMs, null); assert.equal(d.scale, 1); assert.equal(d.shadowEvery, 1);
  assert.equal(d.shadowMapSize, AERIAL_SHADOW_MAP, 'the aerial map size holds still or moving');
  let t = 0;
  for (let i = 1; i <= 30; i++) { t = i * 1000 / 60; d = p.update(east(t, i)); }
  assert.equal(d.moving, true);
  assert.equal(d.frameMs, 1000 / AERIAL_FPS);
  assert.equal(d.scale, AERIAL_SCALE);
  assert.equal(d.shadowEvery, AERIAL_SHADOW_EVERY);
  // Stopped: the same pose every frame. Still "moving" for MOVE_HOLD_MS, then native.
  let settledAt = -1;
  for (let k = 1; k <= 30; k++) { const now = t + k * 1000 / 60; d = p.update(east(now, 30)); if (!d.moving && settledAt < 0) settledAt = now - t; }
  assert.ok(settledAt > 0 && settledAt <= 300, `native ${settledAt} ms after the last move`);
  assert.ok(settledAt >= MOVE_HOLD_MS);
  assert.equal(d.frameMs, null); assert.equal(d.scale, 1); assert.equal(d.shadowEvery, 1);
});

test('aerialPower: street level, an attached camera, or every lever off change nothing', () => {
  const street = new AerialPower({ ...ALL });
  for (let i = 0; i < 20; i++) street.update(east(i * 16, i, { aerial: false }));
  assert.deepEqual({ ...street.decision, moving: false }, { ...NEUTRAL }, 'a low camera moving is never paced');
  const attached = new AerialPower({ ...ALL });
  let d = attached.update(east(0, 0, { detached: false }));
  for (let i = 1; i < 20; i++) d = attached.update(east(i * 16, i, { detached: false }));
  assert.equal(d.moving, true);
  assert.equal(d.frameMs, null, 'a ride is never paced'); assert.equal(d.scale, 1); assert.equal(d.shadowEvery, 1);
  assert.equal(d.shadowMapSize, AERIAL_SHADOW_MAP, 'from the air the map is smaller whatever moves it');
  const off = new AerialPower({ fps: false, scale: false, shadows: false, mapSize: false });
  assert.equal(off.any, false);
  for (let i = 0; i < 20; i++) d = off.update(east(i * 16, i));
  assert.deepEqual({ ...d, aerial: false, moving: false }, { ...NEUTRAL });
});

test("aerialPower: the user's fan pose (eye ~100 m, not isAerialView) flies when detached; the chase camera never does", () => {
  const p = new AerialPower({ ...ALL });
  let d = p.update(east(0, 0, { aerial: false, high: true }));
  for (let i = 1; i < 10; i++) d = p.update(east(i * 16, i, { aerial: false, high: true }));
  assert.equal(d.frameMs, 1000 / AERIAL_FPS); assert.equal(d.scale, AERIAL_SCALE); assert.equal(d.shadowEvery, AERIAL_SHADOW_EVERY);
  assert.equal(d.shadowMapSize, null, 'the map size follows isAerialView only');
  const chase = new AerialPower({ ...ALL });
  for (let i = 0; i < 10; i++) d = chase.update(east(i * 16, i, { aerial: false, high: true, detached: false }));
  assert.equal(d.frameMs, null); assert.equal(d.scale, 1);
});

test('aerialPower: zoom, rotate and tilt are motion too; slow drift is not', () => {
  for (const change of [(i: number) => ({ zoom: 17.3 + i * 0.01 }), (i: number) => ({ bearing: (110 + i * 0.5) % 360 }), (i: number) => ({ pitch: 55 + i * 0.1 })]) {
    const p = new AerialPower({ ...ALL });
    let d = p.update(pose(0));
    for (let i = 1; i < 10; i++) d = p.update(pose(i * 16, change(i)));
    assert.equal(d.moving, true);
  }
  const drift = new AerialPower({ ...ALL });
  let d = drift.update(pose(0));
  // 1 m/s: an easing tail.
  for (let i = 1; i < 30; i++) d = drift.update(east(i * 1000 / 60, i / 150));
  assert.equal(d.moving, false);
  // Bearing across north: 359 → 1 is 2°, not 358°.
  const wrap = new AerialPower({ ...ALL });
  wrap.update(pose(0, { bearing: 359.9 }));
  d = wrap.update(pose(1000, { bearing: 0.1 }));
  assert.equal(d.moving, false, '0.2° in a second');
});

test('FrameHost: minFrameMs paces renders on the animation-frame clock; lifting it draws the kept frame at once', async () => {
  const { FrameHost, PACE_SLACK_MS } = await import('./frameHost');
  const canvas: any = { style: {}, width: 0, height: 0, addEventListener() {}, remove() {} };
  const container: any = { clientWidth: 400, clientHeight: 300, ownerDocument: { createElement: () => canvas }, appendChild() {} };
  const createRenderer = () => ({ getContext: () => ({ isContextLost: () => false }), clear() {}, setViewport() {}, setRenderTarget() {}, dispose() {} });
  let frames: Array<(t: number) => void> = [], renders = 0;
  const host = new FrameHost({}, container, { render: () => { renders++; } }, { createRenderer, pixelRatio: 1, requestFrame: cb => { frames.push(cb); return frames.length; }, cancelFrame() {} });
  host.start();
  const step = (t: number) => { const f = frames; frames = []; for (const cb of f) cb(t); };
  step(0); assert.equal(renders, 1);
  host.minFrameMs = 1000 / 30;
  // 120 Hz, dirty every frame: one render in four.
  for (let i = 1; i <= 24; i++) { host.triggerRepaint(); step(i * 1000 / 120); }
  assert.equal(renders, 1 + 6, '30 fps at 120 Hz');
  assert.equal(host.stats.pacedSkips, 18);
  // 60 Hz with jitter: every other frame.
  const r0 = renders, t0 = 24 * 1000 / 120;
  for (let i = 1; i <= 20; i++) { host.triggerRepaint(); step(t0 + i * 1000 / 60 + (i % 2 ? 1.5 : -1.5)); }
  assert.equal(renders - r0, 10, '30 fps at 60 Hz with ±1.5 ms jitter');
  assert.ok(PACE_SLACK_MS > 1.5);
  // Not dirty: no render and no paced skip counted.
  const skips = host.stats.pacedSkips; step(t0 + 21 * 1000 / 60);
  assert.equal(host.stats.pacedSkips, skips);
  // A skipped dirty frame draws as soon as the pace is lifted.
  const t1 = t0 + 22 * 1000 / 60;
  host.triggerRepaint(); step(t1); const r1 = renders;
  host.triggerRepaint(); step(t1 + 1000 / 120); assert.equal(renders, r1, 'paced');
  host.minFrameMs = null; step(t1 + 2 * 1000 / 120); assert.equal(renders, r1 + 1, 'unpaced: the kept dirty frame');
  host.stop();
});
