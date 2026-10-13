import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOF_CELL_SD_MAX, paintRoofCell } from './roofCells.ts';
import { ROOF_LAYERS_OFF, ROOF_TIER_FAR_M, ROOF_TIER_GLSL, ROOF_TIER_MID_M, roofTierUniform, roofTierWeights } from './roofTier.ts';

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
  assert.match(ROOF_TIER_GLSL, /textureLod\(cells, vec3\(uv, layer\), 8\.0\)/, 'the far tier is the cell mean (last mip)');
  assert.deepEqual(ROOF_LAYERS_OFF, [-1, -1]);
  assert.deepEqual(roofTierUniform(), [ROOF_TIER_MID_M, ROOF_TIER_FAR_M, 0.5]);
});
