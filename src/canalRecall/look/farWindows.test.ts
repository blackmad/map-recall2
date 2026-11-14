// Far windows (lane far-windows-20261114, user note 8f03bc60): the analytic windows outlast the depth fade's detail
// blend and leave only with the screen-footprint tier. Flags, defines, program keys, the GLSL, and the weight at the
// user's pose (z17.86, pitch 75, 1326 x 761 CSS at DPR 2, chase over the Westerdok towards the IJ).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cityProgramKey, variantDefines, type CityVariant } from './cityLook.ts';
import { createLitFacadeMaterial } from '../rendererShared/litFacadeMaterial.ts';
import { FAR_WINDOWS_DESKTOP_DEFAULT, FAR_WINDOWS_TOUCH_DEFAULT, farWindowWeight, farWindowsEnabled } from './windowSdf.ts';
import { createWindowTableTexture } from './windowTable.ts';
import { FACADE_TIER_GLSL, facadeTierUniform, facadeTierWeights } from '../roofTier.ts';
import { depthFadeDetail, depthFadeRange } from './depthFade.ts';

const withGlobal = <T>(key: string, value: unknown, fn: () => T): T => {
  const g = globalThis as Record<string, unknown>, had = key in g, prev = g[key];
  g[key] = value;
  try { return fn(); } finally { if (had) g[key] = prev; else delete g[key]; }
};

test('flags: desktop on, touch off; ?farWindows=0|1 and the global win', () => {
  assert.equal(FAR_WINDOWS_DESKTOP_DEFAULT, true);
  assert.equal(FAR_WINDOWS_TOUCH_DEFAULT, false, 'touch has no analytic windows by default and is unmeasured');
  assert.equal(farWindowsEnabled(false), true);
  assert.equal(farWindowsEnabled(true), false);
  assert.equal(withGlobal('location', { search: '?farWindows=0' }, () => farWindowsEnabled(false)), false);
  assert.equal(withGlobal('location', { search: '?farWindows=1' }, () => farWindowsEnabled(true)), true);
  assert.equal(withGlobal('__canalRecallFarWindows', false, () => farWindowsEnabled(false)), false);
});

test('defines and keys: FAR_WINDOWS on facade chunks when asked (analytic or painted windows); flag-off programs unchanged', () => {
  const v: CityVariant = { lit: true, kind: 'chunk', swap: true, windows: true };
  assert.equal(cityProgramKey(v), 'city-look-v4|lit|chunk|swap|wsdf2');
  assert.equal(cityProgramKey({ ...v, farWindows: true }), 'city-look-v4|lit|chunk|swap|wsdf2|fwin');
  assert.ok('FAR_WINDOWS' in variantDefines({ ...v, farWindows: true }));
  assert.ok(!('FAR_WINDOWS' in variantDefines(v)));
  assert.ok('FAR_WINDOWS' in variantDefines({ ...v, windows: false, farWindows: true }), 'storybook / cartoon: the painted windows');
  assert.equal(cityProgramKey({ lit: true, kind: 'chunk', swap: true }), 'city-look-v4|lit|chunk|swap', 'flag off: the key of before');
  assert.ok(!('FAR_WINDOWS' in variantDefines({ lit: true, kind: 'slot', windows: true, farWindows: true })));
  const table = createWindowTableTexture(THREE, 'photo');
  const on = createLitFacadeMaterial(THREE, undefined, { windowTable: table, farWindows: true });
  const off = createLitFacadeMaterial(THREE, undefined, { windowTable: table });
  assert.equal(on.customProgramCacheKey(), 'shared-frame-facade-v7-wsdf2-fwin');
  assert.equal(off.customProgramCacheKey(), 'shared-frame-facade-v7-wsdf2');
  assert.ok('FAR_WINDOWS' in on.defines && !('FAR_WINDOWS' in off.defines));
  const painted = createLitFacadeMaterial(THREE, undefined, { farWindows: true });
  assert.ok('FAR_WINDOWS' in painted.defines && !('CITY_WINDOW_SDF' in painted.defines));
  assert.equal(painted.customProgramCacheKey(), 'shared-frame-facade-v7-fwin');
  assert.equal(createLitFacadeMaterial(THREE).customProgramCacheKey(), 'shared-frame-facade-v7');
});

test('GLSL: painted looks drop the depth-fade detail from the cell, analytic windows read the footprint tier; UV-less faces keep it', () => {
  const g = FACADE_TIER_GLSL;
  // Painted (no CITY_WINDOW_SDF): the depth-fade detail only where the UVs have no footprint.
  assert.match(g, /#if defined\( FAR_WINDOWS \) && ! defined\( CITY_WINDOW_SDF \)\n(\s*\/\/.*\n)*\s*float farWinUv = max\(length\(dFdx\(p\.xy\)\), length\(dFdy\(p\.xy\)\)\);\n\s*if \(farWinUv <= 0\.0\) far = max\(far, /);
  // The flag-off branch is the line of before.
  assert.match(g, /#else\n\s*far = max\(far, [^\n]*smoothstep[^\n]*\);\n#endif\n#endif/);
  // Analytic: after the depth-fade cellFar, the windows' weight takes the footprint tier.
  const at = g.indexOf('#if defined( FAR_WINDOWS ) && defined( CITY_WINDOW_SDF )');
  assert.ok(at > g.indexOf('cellFar = far;'));
  assert.match(g.slice(at), /^#if defined\( FAR_WINDOWS \) && defined\( CITY_WINDOW_SDF \)\n(\s*\/\/.*\n)*\s*if \(cellRho > 0\.0\) cellFar = cellFarTier;\n#endif/);
});

test('user pose 8f03bc60: the IJ-side slabs (~800 m) lose their windows to the depth fade, keep them with farWindows', () => {
  // Eye 229 m from the view centre (1.5 x 761 CSS px x 0.2009 m/px at z17.86): detail blend 250 -> 600 m.
  const range = depthFadeRange(229);
  assert.deepEqual([Math.round(range.near), Math.round(range.far)], [200, 916]);
  const tier = facadeTierUniform(2);
  // Focal 2283 device px; a storey cell ~85 texels a metre (roofTier.ts): rho = 85 / (2283 / d).
  const rhoAt = (d: number) => 85 / (2283 / d);
  for (const [d, off, on] of [[300, 0.94, 1], [500, 0.2, 1], [800, 0, 1], [1200, 0, 0.57]] as const) {
    const rho = rhoAt(d), w = facadeTierWeights(rho, rho * 0.5, tier, null), detail = depthFadeDetail(d, range, 1);
    assert.ok(Math.abs(farWindowWeight(w.far, detail, rho, false) - off) < 0.06, `${d} m off ${farWindowWeight(w.far, detail, rho, false)}`);
    assert.ok(Math.abs(farWindowWeight(w.far, detail, rho, true) - on) < 0.06, `${d} m on ${farWindowWeight(w.far, detail, rho, true)}`);
  }
  // The footprint tier still removes them once a window is ~1-2 device px (no stipple).
  const far = rhoAt(2200), wFar = facadeTierWeights(far, far * 0.5, tier, null);
  assert.equal(farWindowWeight(wFar.far, 1, far, true), 0);
  // A far prism (UV 0, rho 0) keeps the depth-fade weight.
  assert.equal(farWindowWeight(0, 1, 0, true), 0);
});
