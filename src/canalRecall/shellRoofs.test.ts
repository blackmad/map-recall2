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
  assert.deepEqual([low.dormers, low.chimney, low.accents, low.shutters, low.gable], [false, false, false, false, 'plain']);
  // The detail's cut at the walls is kept (#257): the shell roof is never wider than the detail's.
  assert.equal(low.clipToOutline, plan.clipToOutline);
  if (plan.kind === 'mansard') assert.equal(low.kind, 'hipped');
  // The roof colour the shell draws in is the detail's (measured or planned), never a grey flat-lid prior.
  const detail = meshBuildingFor(f, 'photo', false)!;
  assert.ok(detail.roof && /^#[0-9a-f]{6}$/i.test(detail.roof.roofHex));
});

// #257 (user shots 2026-11-08, Stadhouderskade by the Hobbemastraat and the Geldersekade): a planned roof whose fitted
// box hangs past the walls (a skewed end wall; an irregular block roofed from its fitted box) is cut at the walls in
// the detail chunk (roofMesh planBuildingRoof clipToOutline). shellRoofPlan used to drop that cut, so every coarse and
// baked shell drew the whole box: up to 22 m of roof over the street beside walls that stop at the eaves (one
// Stadhouderskade school roof hung 1,155 m² past its 2,566 m² footprint).
test('#257: a shell roof is cut at the walls where the detail roof is, never hanging past the footprint', () => {
  // A school block whose end wall is skewed 3 m: its fitted box overhangs the short side.
  const ring: [number, number][] = [[0, 0], [40, 0], [40, 18], [0, 21]];
  const school: Feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]].map(([x, y]) => ll(x, y))] },
    properties: { id: 'bag:school', height: 16, minHeight: 0, facade: 'school-priorBrickRed', facadeStyle: 'school', constructionYear: 1890, roofPlanned: true, roofEavesHeightM: 12, roofColour: '#594e48' } };
  const plan = roofPlanForFeature(school)!;
  assert.equal(plan.clipToOutline, true, 'the detail cuts this roof at the walls');
  assert.equal(shellRoofPlan(plan).clipToOutline, true);
  const inside = (x: number, y: number) => { let r = false; for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) if ((ring[a][1] > y) !== (ring[b][1] > y) && x < (ring[b][0] - ring[a][0]) * (y - ring[a][1]) / (ring[b][1] - ring[a][1]) + ring[a][0]) r = !r; return r; };
  const toWall = (x: number, y: number) => Math.min(...ring.map((a, i) => { const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); }));
  for (const mode of ['coarse', 'shell'] as const) {
    const c = buildFeatureChunk([school], 'photo', mode, streets, [], [], [], new Map(), { shellRoofs: true });
    let hang = 0, roofed = 0;
    for (let k = 0; k < c.positions.length; k += 3) {
      const x = c.positions[k], y = c.positions[k + 1], z = c.positions[k + 2];
      if (z > 12 + 1e-3) roofed++;
      if (z > 4 && !inside(x, y)) hang = Math.max(hang, toWall(x, y));
    }
    assert.ok(roofed > 0, `${mode}: the shell carries the roof`);
    // Before #257 the coarse shell's hipped box stood 3.3 m past the skewed wall.
    assert.ok(hang <= 0.05, `${mode}: nothing above the ground floor stands ${hang.toFixed(2)} m outside the footprint`);
  }
});

// F1 record mode (#380, docs/plans/facade-f1-design-20261112.md §2): one quad per visible wall plane, wall metres from
// the pand's base, a record per building, roofs as kind 7; absent, the chunk is byte-identical.
test('F1 record mode: off is byte-identical; on gives one quad per wall plane in wall metres, fronts on the street', () => {
  const all = [...houses, flatBlock];
  const before = buildFeatureChunk(all, 'photo', 'coarse', streets, [], [], [], new Map(), { shellRoofs: true });
  assert.deepEqual(buildFeatureChunk(all, 'photo', 'coarse', streets, [], [], [], new Map(), { shellRoofs: true, facadeRecord: false }), before);
  assert.equal(before.record, undefined);
  const rec = buildFeatureChunk(all, 'photo', 'coarse', streets, [], [], [], new Map(), { shellRoofs: true, facadeRecord: true });
  const r = rec.record!;
  assert.ok(r, 'record arrays');
  assert.equal(r.inputs.length, rec.ranges.length);
  assert.deepEqual(r.inputs.map(x => x.id), rec.ranges.map(x => x.id));
  // Walls: quads only (4 vertices each, base 0 to the wall top), v = z above the base, u in metres along the run.
  const slab = rec.ranges.find(x => x.id === 'bag:slab')!, k = rec.ranges.indexOf(slab);
  let wallVerts = 0, fronts = 0, roofs = 0;
  for (let v = slab.start; v < slab.start + slab.count; v++) {
    assert.equal(r.recs[v], k, 'every vertex draws from its building record');
    const kind = r.wallKinds[v];
    if (kind === 7) { roofs++; continue; }
    wallVerts++;
    if (kind === 0) fronts++;
    assert.ok(Math.abs(r.walls[v * 3 + 1] - rec.positions[v * 3 + 2]) < 1e-4, 'v is the height above the base');
    assert.ok(r.walls[v * 3] >= -1e-6 && r.walls[v * 3] <= r.walls[v * 3 + 2] + 1e-6, 'u inside the run');
  }
  assert.equal(wallVerts, 4 * 4, 'the slab: four walls, one quad each (legacy draws ground, door and upper pieces)');
  assert.equal(fronts, 4, 'one street front (y = 5 faces the street at y = 0)');
  assert.ok(roofs >= 3, 'the lid as kind 7');
  // The legacy coarse slab spends more wall vertices than the record one.
  const legacySlab = before.ranges.find(x => x.id === 'bag:slab')!;
  assert.ok(legacySlab.count > slab.count, `${legacySlab.count} legacy vs ${slab.count} record vertices`);
  // The packer gets the mesher's wall colour and heights.
  assert.equal(r.inputs[k].heightM, 26.8); assert.equal(r.inputs[k].style, 'modern');
});

test('F1 record mode: specFor reaches the record input of its pand only', () => {
  const spec = { d: { fronts: [{ storeys: 5 }] }, s: { 'fronts/0/storeys': 'author' } };
  const rec = buildFeatureChunk([...houses, flatBlock], 'photo', 'coarse', streets, [], [], [], new Map(), { shellRoofs: true, facadeRecord: true, specFor: id => id === 'bag:b' ? spec : undefined });
  const ids = rec.ranges.map(x => x.id);
  assert.deepEqual(rec.record!.inputs[ids.indexOf('bag:b')].spec, spec);
  assert.equal(rec.record!.inputs[ids.indexOf('bag:a')].spec, undefined);
});
