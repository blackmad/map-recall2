import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOF_CELL_SD_MAX, paintRoofCell } from './roofCells.ts';
import { FACADE_TIER_FROM_TEXELS, FACADE_TIER_GLSL, FACADE_TIER_OFF, FACADE_TIER_TO_TEXELS, FACADE_TIER_UNDER_BAND, facadeTierAnisoEnabled, facadeTierAnisoUniform, facadeTierUniform, facadeTierWeights, footprintAxes, ROOF_LAYERS_OFF, ROOF_TIER_FAR_M, ROOF_TIER_GLSL, ROOF_TIER_MID_M, roofTierUniform, roofTierWeights } from './roofTier.ts';

const stats = (data: Uint8ClampedArray) => {
  let n = 0, s = 0, s2 = 0;
  for (let i = 0; i < data.length; i += 4) { n++; s += data[i]; s2 += data[i] * data[i]; }
  const mean = s / n;
  return { mean: mean / 255, sd: Math.sqrt(s2 / n - mean * mean) / 255 };
};

test('pantile and slate cells sit inside the roof band; the mean is unchanged and cartoon cells keep their ink', () => {
  for (const kind of ['tile', 'slate'] as const) {
    const { sd, mean } = stats(paintRoofCell(kind, false));
    assert.ok(sd <= ROOF_CELL_SD_MAX, `${kind} sd ${sd.toFixed(3)} <= ${ROOF_CELL_SD_MAX}`);
    assert.ok(mean > 0.78 && mean < 0.84, `${kind} mean ${mean.toFixed(3)} stays where the palette was tuned`);
    const toon = paintRoofCell(kind, true);
    assert.ok(Array.from({ length: toon.length / 4 }, (_, i) => toon[i * 4]).some(v => v < 0.35 * 255), `${kind} toon keeps its dark ink lines`);
  }
});

test('the roof tiers are 1x near, crossfade to 0.5x, then to the flat mean', () => {
  const near = roofTierWeights(20), mid = roofTierWeights(ROOF_TIER_MID_M + 40), far = roofTierWeights(ROOF_TIER_FAR_M + 80);
  assert.deepEqual([near.fine, near.mid, near.far], [1, 0, 0]);
  assert.ok(mid.mid > 0.95 && mid.fine < 0.05, 'mid tier is the half-frequency cell');
  assert.ok(far.far > 0.95, 'far tier is flat colour');
  for (let d = 0; d < 400; d += 7) {
    const w = roofTierWeights(d);
    assert.ok(Math.abs(w.fine + w.mid + w.far - 1) < 1e-9, `weights sum to 1 at ${d} m`);
  }
  assert.equal(roofTierWeights(ROOF_TIER_MID_M).fine > 0.4 && roofTierWeights(ROOF_TIER_MID_M).fine < 0.6, true, 'half faded at the tier distance');
});

test('the shader function leaves other layers alone and the uniforms default to off', () => {
  assert.match(ROOF_TIER_GLSL, /uniform vec2 roofLayers/);
  assert.match(ROOF_TIER_GLSL, /roofLayers\.x < 0\.0/, 'lo < 0 returns the cell untouched');
  assert.match(ROOF_TIER_GLSL, /textureLod\(cells, vec3\(uv, layer\), 12\.0\)/, 'the far tier is the cell mean (last mip)');
  assert.deepEqual(ROOF_LAYERS_OFF, [-1, -1]);
  assert.deepEqual(roofTierUniform(), [ROOF_TIER_MID_M, ROOF_TIER_FAR_M, 0.5]);
});

test('the facade tier is per CSS pixel: unchanged at ratio 1, scaled on a Retina canvas', () => {
  assert.deepEqual(facadeTierUniform(), [FACADE_TIER_FROM_TEXELS, FACADE_TIER_TO_TEXELS]);
  assert.deepEqual(facadeTierUniform(1), [FACADE_TIER_FROM_TEXELS, FACADE_TIER_TO_TEXELS]);
  assert.deepEqual(facadeTierUniform(2), [FACADE_TIER_FROM_TEXELS * 2, FACADE_TIER_TO_TEXELS * 2]);
  assert.deepEqual(facadeTierUniform(1.25), [FACADE_TIER_FROM_TEXELS * 1.25, FACADE_TIER_TO_TEXELS * 1.25]);
  // Below 1 or nonsense never flattens earlier than the desktop tier.
  assert.deepEqual(facadeTierUniform(0.5), [FACADE_TIER_FROM_TEXELS, FACADE_TIER_TO_TEXELS]);
  assert.deepEqual(facadeTierUniform(NaN), [FACADE_TIER_FROM_TEXELS, FACADE_TIER_TO_TEXELS]);
});

// Lane R3-D (#233): the anisotropy-aware facade tier's CPU twin. `major`/`minor` are the footprint axes in texels per
// pixel (|dFdx|, |dFdy| x cell size); the DPR 2 tier is [32, 60], the DPR 1 tier [16, 30].
test('anisotropy-aware tier: a grazing wall keeps its grid where the filter covers it and fades where it undersamples', () => {
  const dpr1 = facadeTierUniform(1), dpr2 = facadeTierUniform(2);
  // Grazing: major 24, minor 0.5 at 16x. The major-axis rule flattens it at DPR 1 (the blank wall); rhoEff 1.5 does not.
  const old = facadeTierWeights(24, 0.5, dpr1, null), g = facadeTierWeights(24, 0.5, dpr1, 16);
  assert.ok(old.far > 0.5, `major-axis rule flattens the grazing wall (${old.far.toFixed(2)})`);
  assert.equal(g.rhoEff, 1.5);
  assert.equal(g.flat, 0, 'not flattened on the effective footprint');
  // under = 24 / (16 x max(0.5, 1)) = 1.5: half way through the [1, 2] fade (the brief's 3.0 is 24 / (16 x 0.5), without the max).
  assert.equal(g.under, 1.5);
  assert.ok(g.fade > 0.4 && g.fade < 0.6, `faded where the probes undersample (${g.fade.toFixed(2)})`);
  const steep = facadeTierWeights(48, 0.5, dpr2, 16);
  assert.equal(steep.under, 3);
  assert.equal(steep.fade, 1, 'under 3 is fully the mean colour');
  assert.equal(steep.flat, 0);
});

test('anisotropy-aware tier: a perpendicular wall is untouched by both parts; aniso 4 flattens where 16 does not', () => {
  for (const tier of [facadeTierUniform(1), facadeTierUniform(2)]) {
    const p = facadeTierWeights(6, 5, tier, 16);
    assert.deepEqual([p.flat, p.fade, p.far], [0, 0, 0]);
    assert.equal(facadeTierWeights(6, 5, tier, null).far, 0);
  }
  // A far grazing wall: major 120, minor 3 at DPR 1. At 16x the footprint is 7.5 texels (windows kept, the under fade
  // takes it: 120 / 48 = 2.5); at the phone's 4x it is 30 (flat), as is the major-axis rule.
  const a16 = facadeTierWeights(120, 3, facadeTierUniform(1), 16), a4 = facadeTierWeights(120, 3, facadeTierUniform(1), 4);
  assert.equal(a16.flat, 0);
  assert.equal(a4.rhoEff, 30);
  assert.equal(a4.flat, 1);
  // At 4x the under fade starts earlier: major 6, minor 1 is 1.5 at 4x and 0.375 at 16x.
  assert.ok(facadeTierWeights(6, 1, facadeTierUniform(2), 4).fade > 0.4);
  assert.equal(facadeTierWeights(6, 1, facadeTierUniform(2), 16).fade, 0);
  // Axis order does not matter; the tier off (-1) turns both parts off.
  assert.deepEqual(facadeTierWeights(0.5, 24, facadeTierUniform(1), 16), g16());
  assert.equal(facadeTierWeights(48, 0.5, FACADE_TIER_OFF, 16).far, 0);
  function g16() { return facadeTierWeights(24, 0.5, facadeTierUniform(1), 16); }
});

test('anisotropy-aware tier: the shader carries both rules; without CELL_TIER_ANISO it is the major-axis rule as before', () => {
  // The define-off text: drop the CELL_TIER_ANISO blocks (their #else body stays) and the rule is the old two lines.
  const off = FACADE_TIER_GLSL.replace(/#ifdef CELL_TIER_ANISO\n[\s\S]*?#endif\n#endif\n/, '').replace(/#ifdef CELL_TIER_ANISO\n[\s\S]*?#else\n([\s\S]*?)#endif\n/, '$1');
  assert.ok(!/cellAniso|CELL_TIER_ANISO|rhoEff/.test(off), 'nothing of the new rule is left with the define off');
  assert.match(off, /  if \(cellTier\.x >= 0\.0\) \{\n    float rho = max\(length\(dFdx\(p\.xy\)\), length\(dFdy\(p\.xy\)\)\) \* float\(textureSize\(cells, 0\)\.x\);\n    far = smoothstep\(cellTier\.x, cellTier\.y, rho\);\n  \}\n/);
  assert.match(FACADE_TIER_GLSL, /float rhoEff = cellAniso > 0\.0 && cellAnisoRule\.x > 0\.5 \? max\(minor, major \/ cellAniso\) : major;/);
  assert.match(FACADE_TIER_GLSL, /else under = major \/ \(cellAniso \* max\(minor, 1\.0\)\);/);
  assert.match(FACADE_TIER_GLSL, /under = s1 \/ \(cellAniso \* max\(det \/ max\(s1, 1e-6\), 1\.0\)\);/);
  assert.match(FACADE_TIER_GLSL, /far = max\(farFlat, farUnder\);/);
  assert.deepEqual(facadeTierAnisoUniform(16), { cellAniso: 16, cellAnisoRule: [1, 1, FACADE_TIER_UNDER_BAND[0], FACADE_TIER_UNDER_BAND[1]] });
  assert.equal(facadeTierAnisoUniform(0).cellAniso, 1);
});

test('anisotropy-aware tier: off by default (measured, #233), ?cellTierAniso=1 on, =0 off', () => {
  const g = globalThis as Record<string, unknown>, had = g.location;
  try {
    assert.equal(facadeTierAnisoEnabled(), false);
    g.location = { search: '?cellTierAniso=0' };
    assert.equal(facadeTierAnisoEnabled(), false);
    g.location = { search: '?cellTierAniso=1' };
    assert.equal(facadeTierAnisoEnabled(), true);
  } finally { if (had === undefined) delete g.location; else g.location = had; }
});

test('footprint ellipse axes: a wall receding diagonally is thin although both derivatives are long', () => {
  // Axis-aligned: the axes are the derivative lengths.
  const a = footprintAxes([24, 0], [0, 0.5]);
  assert.ok(Math.abs(a.major - 24) < 1e-9 && Math.abs(a.minor - 0.5) < 1e-9);
  // The same footprint turned 45° on screen: |dFdx| = |dFdy| ~ 17, so min(|dFdx|, |dFdy|) reads it as nearly isotropic.
  const c = Math.SQRT1_2, d = footprintAxes([24 * c, 0.5 * c], [-24 * c, 0.5 * c]);
  assert.ok(Math.abs(d.major - 24) < 1e-6 && Math.abs(d.minor - 0.5) < 1e-6, `${d.major} ${d.minor}`);
  // A degenerate footprint has no minor axis.
  assert.equal(footprintAxes([3, 4], [6, 8]).minor, 0);
});
