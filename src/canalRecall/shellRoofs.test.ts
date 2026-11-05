import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFeatureChunk, meshBuildingFor, shellRoofPlan, ORIGIN, type Feature } from './threeBuildingFeatures.js';
import { roofPlanForFeature } from './roofMesh.js';

// Shell roofs (lane R1-A, #223): the coarse (desktop) and touch shells two to five blocks out carry the detail
// chunk's planned roof, low-poly, so the swap to detail no longer turns a grey flat lid into a pitched coloured roof
// in one frame (the user's S1 shot at the Hoftuin). Without the option every shell is byte-identical to before.

const kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const ll = (x: number, y: number): [number, number] => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
const house = (id: string, x: number, w: number, extra: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[ll(x, 5), ll(x + w, 5), ll(x + w, 18), ll(x, 18), ll(x, 5)]] },
  properties: { id, height: 14, minHeight: 0, facade: 'canal-priorBrickRed', facadeStyle: 'canal', constructionYear: 1680, roofPlanned: true, roofShapeTag: 'gabled', roofEavesHeightM: 10, roofColour: '#594e48', ...extra },
});
const flatBlock: Feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[ll(40, 5), ll(70, 5), ll(70, 25), ll(40, 25), ll(40, 5)]] }, properties: { id: 'bag:slab', height: 26.8, minHeight: 0, facade: 'modern-white', facadeStyle: 'modern', constructionYear: 1962 } };
const streets = new Float32Array([-10, 0, 90, 0]);
const houses = [house('bag:a', 0, 6), house('bag:b', 6, 7), house('bag:c', 13, 5)];
const zs = (c: { positions: Float32Array }, from = 0, to = c.positions.length / 3) => Array.from(c.positions.slice(from * 3, to * 3)).filter((_, i) => i % 3 === 2);
const tris = (c: { indices: Uint32Array }) => c.indices.length / 3;

test('off (the default): coarse and touch shells are byte-identical to the flat-lid build', () => {
  for (const mode of ['coarse', 'shell'] as const) {
    const before = buildFeatureChunk([...houses, flatBlock], 'photo', mode, streets);
    assert.deepEqual(buildFeatureChunk([...houses, flatBlock], 'photo', mode, streets, [], [], [], new Map(), {}), before);
    assert.deepEqual(buildFeatureChunk([...houses, flatBlock], 'photo', mode, streets, [], [], [], new Map(), { shellRoofs: false }), before);
  }
});

test('on: shells under a planned roof stop at the eaves and carry its ridge; flat blocks keep their lid', () => {
  for (const mode of ['coarse', 'shell'] as const) {
    const flat = buildFeatureChunk([...houses, flatBlock], 'photo', mode, streets);
    const roofed = buildFeatureChunk([...houses, flatBlock], 'photo', mode, streets, [], [], [], new Map(), { shellRoofs: true });
    const detail = buildFeatureChunk([...houses, flatBlock], 'photo', 'walls', streets);
    for (const id of ['bag:a', 'bag:b', 'bag:c']) {
      const r = roofed.ranges.find(r => r.id === id)!, f = flat.ranges.find(r => r.id === id)!, d = detail.ranges.find(r => r.id === id)!;
      assert.equal(Math.max(...zs(flat, f.start, f.start + f.count)), 14, `${mode} ${id}: the flat shell is a 14 m box`);
      // The ridge stands where the detail's planned roof puts it (its rise over the 10 m eaves), not at a flat 14 m
      // lid; the detail's ornamental crown (neck, spout, clock gable) may stand above it.
      const plan = meshBuildingFor(houses.find(h => h.properties.id === id)!, 'photo', false)!.roof!.plan;
      const top = Math.max(...zs(roofed, r.start, r.start + r.count));
      assert.ok(Math.abs(top - (10 + plan.riseM)) < 0.05, `${mode} ${id}: ridge ${top} at the eaves + ${plan.riseM}`);
      assert.ok(top <= Math.max(...zs(detail, d.start, d.start + d.count)) + 1e-3, `${mode} ${id}: never above the detail`);
      const levels = new Set(zs(roofed, r.start, r.start + r.count).map(z => z.toFixed(2)));
      assert.ok(levels.has('10.00'), `${mode} ${id}: walls end at the eaves`);
    }
    const s = roofed.ranges.find(r => r.id === 'bag:slab')!, s0 = flat.ranges.find(r => r.id === 'bag:slab')!;
    assert.deepEqual(zs(roofed, s.start, s.start + s.count), zs(flat, s0.start, s0.start + s0.count), `${mode}: the flat 1962 slab is unchanged`);
    // Low-poly: a canal house's shell roof costs a handful of triangles (a touch shell's walls are one quad each, so
    // there it doubles a three-house fixture; scripts/world/shell-roof-cost.ts measures real tiles: +0.3 % / +19 %).
    assert.ok(tris(roofed) <= tris(flat) * (mode === 'coarse' ? 1.25 : 2), `${mode}: ${tris(flat)} → ${tris(roofed)} triangles`);
  }
});

test('the shell roof is the detail roof simplified: same rise, material and tone; no dormers, chimney, trim or crown', () => {
  const f = house('bag:a', 0, 6, { roofShapeTag: 'mansard' });
  const plan = roofPlanForFeature(f)!;
  const low = shellRoofPlan({ ...plan, dormers: true, chimney: true, accents: true, shutters: true });
  assert.equal(low.riseM, plan.riseM);
  assert.equal(low.material, plan.material);
  assert.equal(low.tone, plan.tone);
  assert.deepEqual([low.dormers, low.chimney, low.accents, low.shutters, low.gable, low.clipToOutline], [false, false, false, false, 'plain', false]);
  if (plan.kind === 'mansard') assert.equal(low.kind, 'hipped');
  // The roof colour the shell draws in is the detail's (measured or planned), never a grey flat-lid prior.
  const detail = meshBuildingFor(f, 'photo', false)!;
  assert.ok(detail.roof && /^#[0-9a-f]{6}$/i.test(detail.roof.roofHex));
});
