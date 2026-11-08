// Lane R5-E (#265): flat-roof tone and surface. Run: node --import tsx --test src/canalRecall/roofs/flatRoof.test.ts (joins test:roofs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FLAT_ROOF_BANDS, PRIOR_JITTER, flatRoofBand, flatRoofPriorHex, flatRoofToneEnabled } from './flatRoofTone.ts';
import { BOX_MIN_M2, LIP_H_M, LIP_W_M, SEAM_EVERY_M, LID_CELL_M, SURFACE_MEAN, flatRoofSurfaceEnabled, flatRoofSurfaceLayer, paintFlatRoofSurfaceCell, parapetLipTris, roofBoxTris, stairCorePoint } from './flatRoofSurface.ts';
import { applyRoofFact } from './roofFacts.ts';
import { meshBuildingFor, buildFeatureChunk, type Feature } from '../threeBuildingFeatures.ts';
import { FLAT_ROOF_GREYS, FLAT_ROOF_PERIOD_PRIORS, hexToRgb, lumaOf, type RGB } from '../look/palette.ts';
import { lookAtlasLayers } from '../look/paintLookAtlas.ts';
import { SLOT_LAYER_COUNT } from '../look/cityLook.ts';
import { CELL_PX } from '../facadeCells.ts';

function withSearch<T>(search: string, fn: () => T): T {
  const g = globalThis as { location?: unknown }, had = 'location' in g, before = g.location;
  g.location = { search };
  try { return fn(); } finally { if (had) g.location = before; else delete g.location; }
}
const OFF = '?flatRoofTone=0&flatRoofSurface=0';

// 30 m x 22 m (660 m²) and 8 m x 10 m (80 m²) boxes at the Nieuwmarkt.
const box = (w: number, h: number): Feature['geometry'] => {
  const kx = 111320 * Math.cos(52.37 * Math.PI / 180), dx = w / kx, dy = h / 110540, x = 4.901, y = 52.37;
  return { type: 'Polygon', coordinates: [[[x, y], [x + dx, y], [x + dx, y + dy], [x, y + dy], [x, y]]] };
};
const feature = (props: Record<string, unknown>, geometry = box(30, 22)): Feature => ({ type: 'Feature', properties: { id: 'NL.IMBAG.Pand.0363100012999001', height: 15, facade: 'x', facadeStyle: 'postwar', constructionYear: 1978, ...props }, geometry });

test('flags: on unless =0', () => {
  assert.equal(flatRoofToneEnabled(''), true);
  assert.equal(flatRoofToneEnabled('?flatRoofTone=0'), false);
  assert.equal(flatRoofSurfaceEnabled('?x=1'), true);
  assert.equal(flatRoofSurfaceEnabled('?flatRoofSurface=0'), false);
});

test('build-year bands', () => {
  assert.equal(flatRoofBand(null), 'unknown');
  assert.equal(flatRoofBand(1650), 'pre-1900');
  assert.equal(flatRoofBand(1944), '1900-1944');
  assert.equal(flatRoofBand(1945), '1945-1969');
  assert.equal(flatRoofBand(2009), '1990-2009');
  assert.equal(flatRoofBand(2024), '2010+');
  for (const b of [...FLAT_ROOF_BANDS.map(b => b.name), 'unknown'] as const) assert.ok(FLAT_ROOF_PERIOD_PRIORS[b], b);
});

test('priors: measured mid greys, never the light membrane; jittered per building within the band', () => {
  const membrane = lumaOf(hexToRgb(FLAT_ROOF_GREYS[1]));
  for (const hex of Object.values(FLAT_ROOF_PERIOD_PRIORS)) { const y = lumaOf(hexToRgb(hex)); assert.ok(y >= 95 && y <= 140 && y < membrane - 50, `${hex} ${y}`); }
  const base = lumaOf(hexToRgb(FLAT_ROOF_PERIOD_PRIORS['1970-1989']));
  const ys = Array.from({ length: 50 }, (_, i) => lumaOf(hexToRgb(flatRoofPriorHex(`NL.IMBAG.Pand.${i}`, 1978))));
  assert.ok(ys.every(y => Math.abs(y - base) <= base * PRIOR_JITTER + 1), 'within the jitter');
  assert.ok(new Set(ys.map(Math.round)).size > 5, 'neighbours differ');
  assert.equal(flatRoofPriorHex('a', 1978), flatRoofPriorHex('a', 1978), 'deterministic');
});

test('a low-confidence reading biases the prior toward itself; at or above MIN_CONFIDENCE it is not a prior', () => {
  const white: RGB = [230, 230, 228];
  const p0 = lumaOf(hexToRgb(flatRoofPriorHex('a', 1978)));
  const p20 = lumaOf(hexToRgb(flatRoofPriorHex('a', 1978, { rgb: white, confidence: 0.2 })));
  const p30 = lumaOf(hexToRgb(flatRoofPriorHex('a', 1978, { rgb: white, confidence: 0.3 })));
  const p10 = lumaOf(hexToRgb(flatRoofPriorHex('a', 1978, { rgb: white, confidence: 0.1 })));
  assert.equal(Math.round(p20), Math.round(p0));
  assert.equal(Math.round(p10), Math.round(p0));
  assert.ok(p30 > p0 + 40, `${p0} -> ${p30}`);
});

test('surface cell: tintable, mean of the flat cell, seams every 2 m, low amplitude', () => {
  const c = paintFlatRoofSurfaceCell();
  assert.equal(c.length, CELL_PX * CELL_PX * 4);
  let sum = 0, sq = 0; const n = CELL_PX * CELL_PX;
  for (let i = 0; i < n; i++) { assert.equal(c[i * 4 + 3], 255); sum += c[i * 4]; sq += c[i * 4] ** 2; }
  const mean = sum / n, sd = Math.sqrt(sq / n - mean * mean) / 255;
  assert.ok(Math.abs(mean - SURFACE_MEAN * 255) < 0.6, `mean ${mean}`);
  assert.ok(sd > 0.015 && sd < 0.06, `sd ${sd}`);
  const column = (x: number) => { let s = 0; for (let y = 0; y < CELL_PX; y++) s += c[(y * CELL_PX + x) * 4]; return s / CELL_PX; };
  const period = CELL_PX * SEAM_EVERY_M / LID_CELL_M;
  for (const x of [0, period]) assert.ok(column(x) < mean - 20, `seam at ${x}: ${column(x)}`);
  assert.ok(Math.abs(column(period / 2) - mean) < 6);
});

test('surface layer: after the slot layers, inside the byte range; none for the procedural set', () => {
  for (const look of ['photo', 'storybook', 'cartoon'] as const) {
    const layer = flatRoofSurfaceLayer(look)!, { layers } = withSearch(OFF, () => lookAtlasLayers(look, true));
    assert.equal(layer, layers + SLOT_LAYER_COUNT, look);
    assert.ok(layer < 256);
    assert.equal(lookAtlasLayers(look, false).total, layer + 1, 'the array holds it with or without slot layers');
  }
  assert.equal(flatRoofSurfaceLayer('procedural'), null);
  // Off: the arrays are as before.
  withSearch(OFF, () => { const { layers, total } = lookAtlasLayers('photo', true); assert.equal(total, layers + SLOT_LAYER_COUNT); });
});

test('parapet lip: 6 triangles an edge, faces outward/up/inward, the inner edge LIP_W_M in', () => {
  const sq: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  for (const ring of [sq, [...sq].reverse()]) {
    const tris = parapetLipTris([ring], 20, '#806050');
    assert.equal(tris.length, 24);
    for (const t of tris) {
      const [a, b, c] = t.p, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      assert.ok(cr[0] * t.n[0] + cr[1] * t.n[1] + cr[2] * t.n[2] > 0, 'winding faces n');
      assert.ok(t.p.every(p => p[2] >= 20 - 1e-9 && p[2] <= 20 + LIP_H_M + 1e-9));
    }
    const tops = tris.filter(t => t.n[2] === 1).flatMap(t => t.p);
    assert.ok(tops.some(p => Math.abs(p[0] - LIP_W_M) < 1e-9 && Math.abs(p[1] - LIP_W_M) < 1e-9), 'mitred inner corner');
    // Outer faces point away from the square's centre.
    for (const t of tris.filter(t => t.n[2] === 0)) {
      const mx = (t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3 - 5, my = (t.p[0][1] + t.p[1][1] + t.p[2][1]) / 3 - 5;
      const onWall = Math.max(Math.abs(mx), Math.abs(my)) > 5 - 1e-6;
      assert.equal(mx * t.n[0] + my * t.n[1] > 0, onWall, 'outer faces out, inner faces in');
    }
  }
  // A courtyard: its lip faces into the courtyard on the outside, toward the roof on the inside.
  const court: [number, number][] = [[4, 4], [6, 4], [6, 6], [4, 6]];
  const tris = parapetLipTris([sq, court], 0, '#806050');
  assert.equal(tris.length, 48);
  const courtOuter = tris.filter(t => t.n[2] === 0 && t.p.every(p => p[0] >= 4 - 1e-9 && p[0] <= 6 + 1e-9 && p[1] >= 4 - 1e-9 && p[1] <= 6 + 1e-9) && t.p.some(p => p[0] === 4 || p[0] === 6) && t.p.every(p => [4, 6].includes(p[0]) || [4, 6].includes(p[1])));
  assert.ok(courtOuter.length >= 8);
  for (const t of courtOuter) { const mx = (t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3 - 5, my = (t.p[0][1] + t.p[1][1] + t.p[2][1]) / 3 - 5; assert.ok(mx * t.n[0] + my * t.n[1] < 0, 'courtyard wall faces the courtyard'); }
});

test('roof box: 10 triangles, closed above the roof; the stair core sits on the spine, clear of the edges', () => {
  assert.equal(roofBoxTris(0, 0, 1, 0, 3, 2, 10, 12, '#a7a49c').length, 10);
  const ring: [number, number][] = [[0, 0], [40, 0], [40, 12], [0, 12]];
  const at = stairCorePoint([ring], 1, { cx: 20, cy: 6, ux: 1, uy: 0, len: 40 })!;
  assert.ok(at && Math.abs(at[1] - 6) < 1e-9 && Math.abs(at[0] - 20) < 1e-9);
  // A ring whose centre is a courtyard: the box moves along the spine.
  const court: [number, number][] = [[14, 2], [26, 2], [26, 10], [14, 10]];
  const moved = stairCorePoint([ring, court], 1, { cx: 20, cy: 6, ux: 1, uy: 0, len: 40 })!;
  assert.ok(moved && (moved[0] < 14 - 2 || moved[0] > 26 + 2), `${moved}`);
});

test('meshBuildingFor: an unmeasured flat roof takes the period prior, its surface layer, a lip and a box; measured and mapped keep theirs', () => {
  const b = meshBuildingFor(feature({}), 'photo')!;
  const prior = lumaOf(hexToRgb(FLAT_ROOF_PERIOD_PRIORS['1970-1989'])), y = lumaOf(hexToRgb(b.lid!.hex));
  assert.ok(Math.abs(y - prior) < prior * PRIOR_JITTER + 8, `lid ${b.lid!.hex} ${y} vs prior ${prior}`);
  assert.equal(b.lid!.surfaceLayer, flatRoofSurfaceLayer('photo'));
  assert.deepEqual(b.flatRoof, { lip: true, box: true });
  const small = meshBuildingFor(feature({}, box(8, 10)), 'photo')!;
  assert.deepEqual(small.flatRoof, { lip: false, box: false });
  const mapped = meshBuildingFor(feature({ roofColour: '#3a3a3a', colour: '#aa8866' }), 'photo')!;
  assert.equal(mapped.lid!.hex, withSearch(OFF, () => meshBuildingFor(feature({ roofColour: '#3a3a3a', colour: '#aa8866' }), 'photo')!).lid!.hex, 'a mapped roof colour keeps it');
  const p: Record<string, unknown> = {};
  applyRoofFact(p, { slot: 'gravel', rgb: [140, 135, 120], confidence: 0.9, solarShare: 0, terrace: false, furniture: [{ kind: 'hvac', e: 5, n: 5, w: 1.2, l: 2, yawDeg: 0 }] });
  const measured = meshBuildingFor(feature(p), 'photo')!;
  const off = withSearch(OFF, () => meshBuildingFor(feature(p), 'photo')!);
  assert.equal(measured.lid!.hex, off.lid!.hex, 'a measured lid keeps its colour');
  assert.deepEqual(measured.flatRoof, { lip: true, box: false }, 'measured furniture: no generic box');
  // A planned pitched roof is not a flat roof.
  const pitched = meshBuildingFor(feature({ roofPlanned: true, roofShape: 'gable', facadeStyle: 'canal' }), 'photo')!;
  assert.equal(pitched.flatRoof, undefined);
});

test('flags off: the building is as before (no surface layer, no lip or box, the hashed grey)', () => {
  withSearch(OFF, () => {
    const b = meshBuildingFor(feature({}), 'photo')!;
    assert.ok(FLAT_ROOF_GREYS.includes(b.lid!.hex));
    assert.equal(b.lid!.surfaceLayer, undefined);
    assert.equal(b.flatRoof, undefined);
    assert.deepEqual(Object.keys(b.lid!), ['hex', 'flatLayer']);
  });
});

test('chunks: the lip and box join the walls chunk; measured furniture moves there from the extras chunk', () => {
  const on = buildFeatureChunk([feature({})], 'photo', 'walls'), off = withSearch(OFF, () => buildFeatureChunk([feature({})], 'photo', 'walls'));
  const tris = (c: { indices: ArrayLike<number> }) => c.indices.length / 3;
  assert.equal(tris(on) - tris(off), 4 * 6 + 10, 'a 4-edge lip and one box');
  assert.equal(on.kinds!['roof-trim'] ?? 0, (off.kinds!['roof-trim'] ?? 0) + 34);
  const coarseOn = buildFeatureChunk([feature({})], 'photo', 'coarse'), coarseOff = withSearch(OFF, () => buildFeatureChunk([feature({})], 'photo', 'coarse'));
  assert.equal(tris(coarseOn) - tris(coarseOff), 34, 'the coarse chunk (and the baked shell) too');
  const shellOn = buildFeatureChunk([feature({})], 'photo', 'shell'), shellOff = withSearch(OFF, () => buildFeatureChunk([feature({})], 'photo', 'shell'));
  assert.equal(tris(shellOn), tris(shellOff), 'the touch shell stays one quad a wall and a lid');
  const p: Record<string, unknown> = {};
  applyRoofFact(p, { slot: 'gravel', rgb: [140, 135, 120], confidence: 0.9, solarShare: 0, terrace: false, furniture: [{ kind: 'hvac', e: 5, n: 5, w: 1.2, l: 2, yawDeg: 0 }, { kind: 'overrun', e: 12, n: 8, w: 3, l: 3, yawDeg: 0 }] });
  const wallsOn = buildFeatureChunk([feature(p)], 'photo', 'walls'), wallsOff = withSearch(OFF, () => buildFeatureChunk([feature(p)], 'photo', 'walls'));
  assert.equal(tris(wallsOn) - tris(wallsOff), 24 + 2 * 10, 'lip + two measured boxes');
  const extrasOn = buildFeatureChunk([feature(p)], 'photo', 'extras'), extrasOff = withSearch(OFF, () => buildFeatureChunk([feature(p)], 'photo', 'extras'));
  // Not drawn twice. (Off, the extras sink drops the last measured item: measuredRoofFurniture widens the budget by 10
  // triangles an item while ExtraSink.box asks room for 12. Kept as it was with the flag off.)
  assert.ok(tris(extrasOff) - tris(extrasOn) >= 10, 'not drawn twice');
  assert.equal((extrasOn.kinds!.extras ?? 0) + 20, (extrasOff.kinds!.extras ?? 0) + 20 - (tris(extrasOff) - tris(extrasOn)));
  // The lid samples the surface layer.
  const surface = flatRoofSurfaceLayer('photo')!;
  assert.ok([...on.layers].includes(surface) && ![...off.layers].includes(surface));
});

test('the box threshold: no box under BOX_MIN_M2', () => {
  const b = meshBuildingFor(feature({}, box(15, 20)), 'photo')!;
  assert.ok(15 * 20 < BOX_MIN_M2);
  assert.deepEqual(b.flatRoof, { lip: true, box: false });
});
