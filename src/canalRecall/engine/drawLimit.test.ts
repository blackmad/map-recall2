// Draw limit and pop fade (lane P2, #325). Run: node --import tsx --test src/canalRecall/engine/drawLimit.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { clampToDrawLimit, drawLimitColour, drawLimitFlag, drawLimitFogFragment, drawLimitFogRange, drawLimitM, drawLimitWeights, packFogFar, unpackFogFar, DRAW_LIMIT_STREET_M } from './drawLimit.js';
import { LeavingFades, popFadeFlag } from './popFade.js';
import { keepReachM, pastMinDwell, RESIDENCY_MIN_DWELL_MS } from '../landmarks/landmarkResidency.js';
import { DEPTH_FADE_DETAIL_GLSL, depthFadeColour, depthFadeRange, DEPTH_FADE_DESATURATE, DEPTH_FADE_HAZE } from '../look/depthFade.js';

const withSearch = (search: string, fn: () => void) => { const g = globalThis as { location?: unknown }; const old = g.location; g.location = { search }; try { fn(); } finally { g.location = old; } };

test('flags: on by default, ?drawLimit=0 / ?popFade=0 off', () => {
  withSearch('', () => { assert.equal(drawLimitFlag(), true); assert.equal(popFadeFlag(), true); });
  withSearch('?drawLimit=0&popFade=0', () => { assert.equal(drawLimitFlag(), false); assert.equal(popFadeFlag(), false); });
});

test('the limit: fixed on the street, a clamped multiple of the eye-to-centre distance from the air', () => {
  assert.equal(drawLimitM(false, 60), DRAW_LIMIT_STREET_M);
  assert.equal(drawLimitM(true, 300), 4000);
  assert.equal(drawLimitM(true, 1000), 6000);
  assert.equal(drawLimitM(true, 5000), 9000);
});

test('fogFar packs the limit and the gentle ratio; float32 round trip within 0.5 %', () => {
  for (const [limit, ratio] of [[2000, 2], [6000, 5], [9000, 8.5], [4000, 1.3]] as const) {
    const u = unpackFogFar(packFogFar(limit, ratio));
    assert.equal(u.limitM, limit);
    assert.ok(Math.abs(u.ratio - ratio) / ratio < 0.005, `${limit} ${ratio} -> ${u.ratio}`);
  }
});

test('street: the gentle fade starts at 180 m, keeps the depth fade far edge, and is opaque at the limit', () => {
  const gentle = depthFadeRange(50, [0.8, 4], 200); // chase: near 200, far 400
  const r = drawLimitFogRange(gentle, 2000, false);
  assert.equal(r.near, 180);
  const w = drawLimitWeights(400, r.near, r.far);
  assert.ok(Math.abs(w.gentleFar - 400) < 2, `gentle far ${w.gentleFar}`);
  assert.equal(drawLimitWeights(100, r.near, r.far).gentle, 0, 'the clear band is untouched');
  assert.equal(drawLimitWeights(100, r.near, r.far).opaque, 0);
  assert.equal(drawLimitWeights(899, r.near, r.far).opaque, 0, 'the opaque ramp starts at 45 % of the limit');
  assert.equal(drawLimitWeights(2000, r.near, r.far).opaque, 1);
  const haze: [number, number, number] = [0.8, 0.85, 0.9];
  assert.deepEqual(drawLimitColour([0.2, 0.4, 0.1], haze, 2100, r.near, r.far, DEPTH_FADE_DESATURATE, DEPTH_FADE_HAZE).map(x => +x.toFixed(6)), haze, 'past the limit: the haze colour');
  // Under the opaque ramp the colour is the depth fade's own (same gentle edges).
  const own = depthFadeColour([0.2, 0.4, 0.1], haze, 350, { near: 180, far: 400 }, 1);
  const lim = drawLimitColour([0.2, 0.4, 0.1], haze, 350, r.near, r.far, DEPTH_FADE_DESATURATE, DEPTH_FADE_HAZE);
  lim.forEach((c, i) => assert.ok(Math.abs(c - own[i]) < 2e-3));
});

test('aerial: the depth fade range is kept, the limit packed on top', () => {
  const gentle = depthFadeRange(1000, [0.8, 4], 200); // 800..4000
  const r = drawLimitFogRange(gentle, drawLimitM(true, 1000), true);
  assert.equal(r.near, 800);
  const w = drawLimitWeights(3000, r.near, r.far);
  assert.ok(Math.abs(w.gentleFar - 4000) < 20);
  assert.equal(w.limitM, 6000);
});

test('the GLSL: the opaque mix, and the facade detail edge unpacked only with the limit', () => {
  assert.match(drawLimitFogFragment(0.5, 0.38), /floor\( fogFar \)/);
  assert.doesNotMatch(DEPTH_FADE_DETAIL_GLSL('d', 1, false), /fract/);
  assert.match(DEPTH_FADE_DETAIL_GLSL('d', 1, true), /fract\(fogFar\)/);
});

test('clamp: a far radius stops at the limit plus the eye offset, rounded up to the step; no limit, no change', () => {
  assert.equal(clampToDrawLimit(7000, null, 0, 1000), 7000);
  assert.equal(clampToDrawLimit(7000, { from: 900, to: 2000, aerial: false, eyeToCentreM: 60 }, 60, 1000), 3000);
  assert.equal(clampToDrawLimit(2000, { from: 900, to: 4000, aerial: true, eyeToCentreM: 600 }, 600, 1000), 2000);
});

test('landmark residency hysteresis: keep at 1.25 x the reach, 10 s minimum dwell', () => {
  assert.equal(keepReachM(2000, true), 2500);
  assert.equal(keepReachM(2000, false), 2000);
  assert.equal(keepReachM(Infinity, true), Infinity);
  assert.equal(pastMinDwell(1000, 1000 + RESIDENCY_MIN_DWELL_MS - 1, true), false);
  assert.equal(pastMinDwell(1000, 1000 + RESIDENCY_MIN_DWELL_MS, true), true);
  assert.equal(pastMinDwell(1000, 1001, false), true);
  assert.equal(pastMinDwell(undefined, 0, true), true);
});

test('leaving fades: dissolve out over the fade, then removed and released once', () => {
  const removed: unknown[] = []; let released = 0;
  const parent = { remove: (o: unknown) => removed.push(o) };
  const mesh = { material: 'shared' as unknown, parent };
  const clone = { uniforms: { cityFade: { value: 1 } }, disposed: 0, dispose() { this.disposed++; } };
  const f = new LeavingFades(600);
  assert.equal(f.leave({ material: 1, parent: null }, clone, () => {}), false, 'not in a scene: removed by the caller');
  assert.equal(f.leave(mesh, null, () => {}), false, 'no clone: removed by the caller');
  assert.equal(f.leave(mesh, clone, () => released++, 0), true);
  assert.equal(mesh.material, clone);
  assert.equal(f.step(300, 1), true);
  assert.equal(clone.uniforms.cityFade.value, 0.5);
  assert.equal(f.step(600, 1), false);
  assert.deepEqual(removed, [mesh]); assert.equal(released, 1); assert.equal(clone.disposed, 1);
  f.flush(); assert.equal(released, 1);
});
