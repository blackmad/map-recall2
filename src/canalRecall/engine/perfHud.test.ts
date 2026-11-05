import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameRing, perfHudForcedOff, perfHudLine, perfHudWanted, type PerfSnapshot } from './perfHud';

const snap: PerfSnapshot = { tier: 'high', dpr: 2, heapMB: 312.4, gpuMB: 480.2, geometries: 1500, textures: 46, cells: 14, chunks: 26, models: 70, p99Ms: 18.3 };

test('the HUD line names tier, ratio, heap, GPU, residents and p99', () => {
  assert.equal(perfHudLine(snap), 'high 2.0× · heap 312 MB · GPU 480 MB · cells 14 · chunks 26 · models 70 · p99 18 ms');
});

test('without the GPU tracker the line shows geometry and texture counts; unknowns are dashes', () => {
  const line = perfHudLine({ ...snap, gpuMB: null, tier: null, p99Ms: null, models: null });
  assert.equal(line, '– 2.0× · heap 312 MB · GPU – (geo 1500 tex 46) · cells 14 · chunks 26 · models – · p99 – ms');
});

test('wanted: the URL wins, then the live switch, then the saved preference; off by default', () => {
  assert.equal(perfHudWanted('', undefined, null), false);
  assert.equal(perfHudWanted('?perfHud=1', false, null), true);
  assert.equal(perfHudWanted('?ride=free&perfHud=0', true, '{"perfHud":true}'), false);
  assert.equal(perfHudWanted('', true, null), true);
  assert.equal(perfHudWanted('', false, '{"perfHud":true}'), false, 'the live switch beats the saved value');
  assert.equal(perfHudWanted('', undefined, '{"perfHud":true}'), true);
  assert.equal(perfHudWanted('', undefined, 'not json'), false);
  assert.equal(perfHudForcedOff('?perfHud=0'), true);
  assert.equal(perfHudForcedOff('?perfHud=1'), false);
  assert.equal(perfHudForcedOff(''), false);
});

test('frame ring: p99 over the last 5 s only, null under 10 frames', () => {
  const r = new FrameRing(100, 5000);
  for (let i = 0; i < 9; i++) r.push(i * 16, 16);
  assert.equal(r.p99(150), null);
  r.push(160, 16);
  assert.equal(r.p99(160), 16);
  // A stall long ago leaves the window; the ring wraps without growing.
  r.push(200, 900);
  for (let i = 0; i < 200; i++) r.push(6000 + i * 16, 17);
  assert.equal(r.p99(6000 + 199 * 16), 17);
});
