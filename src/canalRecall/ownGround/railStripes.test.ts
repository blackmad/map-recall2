import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installRailStripes, railStripeCentres, railStripeGlsl, sleeperFade, stripeCoverage, RAIL_MIN_PX, RAIL_STRIPE_CONTRAST } from './railStripes.ts';
import { RAIL_STRIPE } from './railTracks.ts';

test('the stripes sit at least 60 luma under the ballast (brief: survives the mips as a dark line)', () => {
  assert.ok(RAIL_STRIPE_CONTRAST >= 60, String(RAIL_STRIPE_CONTRAST));
});

test('near: physical stripes, full tone at the centre and none between the rails', () => {
  const [c0, c1] = railStripeCentres();
  for (const minPx of [false, true]) {
    assert.equal(stripeCoverage(c0, 0.01, minPx), 1);
    assert.equal(stripeCoverage(c1, 0.01, minPx), 1);
    assert.equal(stripeCoverage((c0 + c1) / 2, 0.01, minPx), 0);
    assert.equal(stripeCoverage(c0 + RAIL_STRIPE.half + 0.05, 0.01, minPx), 0);
  }
});

test('far: with railMinPx the stripe keeps its full tone at >= 1.25 px; without it the pixel only partly covers', () => {
  const [c0] = railStripeCentres();
  // 0.6 m a pixel across the track (a far LOD 1 bed from the air): the 0.24 m stripe is 0.4 px.
  const fu = 0.6;
  assert.ok(stripeCoverage(c0, fu, false) < 0.95);
  assert.equal(stripeCoverage(c0, fu, true), 1);
  // Its covered width in pixels (samples across, coverage summed) is at least RAIL_MIN_PX.
  let px = 0; for (let u = c0 - 1; u <= c0 + 1; u += fu / 50) px += stripeCoverage(u, fu, true) / 50;
  assert.ok(px >= RAIL_MIN_PX - 0.05, String(px));
});

test('sleepers fade out by distance instead of averaging into a hatch', () => {
  assert.equal(sleeperFade(0.01), 1, 'near: full sleepers');
  assert.equal(sleeperFade(0.62 / 2), 0, 'two pixels a sleeper period: gone');
  assert.ok(sleeperFade(0.62 / 4) > 0 && sleeperFade(0.62 / 4) < 1);
});

test('install: after the ground program, its own cache key, nothing when off', () => {
  const calls: string[] = [];
  const m = { onBeforeCompile: (s: { fragmentShader: string }) => { calls.push('ground'); s.fragmentShader = s.fragmentShader.replace('X', 'Y'); }, customProgramCacheKey: () => 'ownGround-ground4-MeshStandardMaterial-blend' };
  const off = { ...m }; installRailStripes(off, { stripes: false, minPx: true });
  assert.equal(off.onBeforeCompile, m.onBeforeCompile); assert.equal(off.customProgramCacheKey(), 'ownGround-ground4-MeshStandardMaterial-blend');
  installRailStripes(m, { stripes: true, minPx: true });
  const shader = { fragmentShader: 'X\n#include <map_fragment>\n' };
  m.onBeforeCompile(shader);
  assert.deepEqual(calls, ['ground']);
  assert.ok(shader.fragmentShader.startsWith('Y') && shader.fragmentShader.includes('railHalf'));
  assert.equal(m.customProgramCacheKey(), 'ownGround-ground4-MeshStandardMaterial-blend-railsMin1');
  assert.ok(!railStripeGlsl({ stripes: true, minPx: false }).includes('railFu))'), 'physical width only');
});
