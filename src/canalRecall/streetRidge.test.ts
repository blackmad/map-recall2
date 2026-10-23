import assert from 'node:assert/strict';
import test from 'node:test';
import { gablePiecesForOutline, planBuildingRoof, planRoof, roofPiecesForOutline, roofTrianglesForOutline, type Rect, type RoofPlan } from './roofMesh.ts';
import { FALLBACK_REACH_M, SegmentGrid, streetDistance } from './streetFronts.ts';
import type { StreetFacing } from './streetGableEnds.ts';
import { bayCount, turnRidgeToStreet, TURN_MAX_DEPTH_M } from './streetRidge.ts';

const origin = { lng: 4.9, lat: 52.37 }, KX = 111_320 * Math.cos(origin.lat * Math.PI / 180), KY = 110_540;
const dims = { bayM: 5, storeyM: 3.1, cellM: 1.2 };
const lng = 4.88, lat = 52.383, kxl = 111_320 * Math.cos(lat * Math.PI / 180);
const ox = (lng - origin.lng) * KX, oy = (lat - origin.lat) * KY;
const ll = (x: number, y: number) => [lng + x / kxl, lat + y / KY];
/** A box `front` wide along x (front wall on y = 0), `depth` deep, as lng/lat and as local metres. */
const box = (front: number, depth: number) => ({
  outer: [ll(0, 0), ll(front, 0), ll(front, depth), ll(0, depth), ll(0, 0)],
  local: [[0, 0], [front, 0], [front, depth], [0, depth], [0, 0]] as Array<[number, number]>,
});
/** The chunk's street test with one street centreline at y = -8 (in front of y = 0), plus optionally one at x = -8. */
const facingFor = (outer: number[][], corner = false): StreetFacing => {
  const segs = [ox - 60, oy - 8, ox + 120, oy - 8];
  if (corner) segs.push(ox - 8, oy - 60, ox - 8, oy + 120);
  const streets = new SegmentGrid(Float32Array.from(segs));
  const wallSegs: number[] = [], owners: number[] = [];
  for (let k = 1; k < outer.length; k++) { wallSegs.push((outer[k - 1][0] - origin.lng) * KX, (outer[k - 1][1] - origin.lat) * KY, (outer[k][0] - origin.lng) * KX, (outer[k][1] - origin.lat) * KY); owners.push(0); }
  const walls = new SegmentGrid(wallSegs, 25, owners);
  return (w, fallback) => fallback ? streetDistance(w, streets, null, 0, FALLBACK_REACH_M) : streetDistance(w, streets, walls, 0);
};
/** The first id whose plan for this footprint is the wanted kind. */
const planOf = (style: string, local: Array<[number, number]>, kind: RoofPlan['kind'], tag?: string): { id: string; plan: RoofPlan } => {
  for (let i = 0; i < 400; i++) {
    const plan = planBuildingRoof(`h${i}`, style, 14, 0, local, tag, 1880);
    if (plan?.kind === kind) return { id: `h${i}`, plan };
  }
  throw new Error(`no ${style} ${kind}`);
};
/** Ridge direction of each saddle in the mesh frame: 'across' when it runs along y (away from the street). */
const ridges = (pieces: Array<{ rect: Rect }>) => pieces.map(p => Math.abs(p.rect.uy) > 0.9 ? 'across' : 'along');

test('bay counts: one saddle up to 14 m, then saddles of about 6 m', () => {
  assert.deepEqual([8, 11.6, 14, 14.5, 18, 27.7, 40].map(bayCount), [1, 1, 1, 2, 3, 5, 7]);
  for (let f = 14.05; f < 80; f += 0.1) { const w = f / bayCount(f); assert.ok(w >= 4.9 && w <= 7.5, `${f}: ${w}`); }
});

test('planRoof marks only pre-1940 street saddles as turnable', () => {
  const rect: Rect = { cx: 0, cy: 0, ux: 1, uy: 0, len: 11.6, wid: 7.2, coverage: 1, maxDev: 0 };
  for (let i = 0; i < 300; i++) {
    for (const style of ['canal', 'c19', 'school', 'postwar']) {
      const plan = planRoof(`p${i}`, style, 14, 0, rect, undefined, 1880);
      const turnable = (style === 'canal' || style === 'c19') && !!plan && ['pitched', 'mansard', 'gable'].includes(plan.kind);
      assert.equal(!!plan?.streetRidge, turnable, `${style} ${plan?.kind}`);
      if (plan?.streetRidge) assert.ok(plan.streetRidge.gables.length === 3 && !plan.streetRidge.gables.includes('spout'));
    }
    assert.ok(!planRoof(`p${i}`, 'canal', 14, 0, rect, 'hipped', 1880)?.streetRidge, 'a mapped hipped roof stays');
    assert.ok(!planRoof(`p${i}`, 'canal', 14, 0, rect, 'saltbox', 1880)?.streetRidge, 'a mapped saltbox stays');
    assert.ok(!planRoof(`p${i}`, 'canal', 14, 0, rect, undefined, 1880, 'step')?.streetRidge, 'a register gable stays');
  }
});

test('Marnixstraat 1872 row (11.6 m front, 7.2 m deep): the ridge turns across the street, crown to the street, plain rear', () => {
  const { outer, local } = box(11.6, 7.2), facing = facingFor(outer);
  for (const kind of ['pitched', 'gable', 'mansard'] as const) {
    const { plan } = planOf('c19', local, kind, kind === 'mansard' ? undefined : 'gabled');
    assert.deepEqual(ridges(roofPiecesForOutline(outer, origin, plan, KX)), ['along'], `${kind}: before, along the street`);
    const after = roofPiecesForOutline(outer, origin, plan, KX, facing);
    assert.deepEqual(ridges(after), ['across'], `${kind}: after, across`);
    const [piece] = gablePiecesForOutline(outer, origin, plan, KX, facing);
    assert.equal(piece.plan.kind, 'gable');
    // The street end is the one at y = 0 (outward normal -y).
    const streetEnd = piece.rect.uy < 0 ? 1 : 0;
    assert.ok(piece.plan.streetEnds?.[streetEnd] && !piece.plan.streetEnds?.[1 - streetEnd], `${kind}: crown on the street end only`);
    const h0 = 14 - plan.riseM, tris = roofTrianglesForOutline(outer, origin, plan, h0, dims, KX, facing);
    const top = Math.max(...tris.flatMap(t => t.p.map(p => p[2])));
    // Turned saddles keep the planned rise: the eaves stay where the tile decorator lowered the walls, and a crown
    // rises above the ridge no more than a narrow house's crown of that rise does (neck: 1.45 R + 0.7 + neck).
    const ridge = Math.max(...tris.filter(t => t.part === 'slope' && t.n[2] > 0.3 && t.n[2] < 0.99).flatMap(t => t.p.map(p => p[2])));
    assert.ok(Math.abs(ridge - 14) < 0.05, `${kind}: ridge at the planned height (${ridge.toFixed(2)})`);
    assert.ok(top <= h0 + 2.5 * plan.riseM + 2.5, `${kind}: the crown stays within a gable's envelope (${top.toFixed(2)})`);
    const y = (p: number[]) => p[1] - oy;
    const back = tris.filter(t => t.p.every(p => Math.abs(y(p) - 7.2) < 0.4) && Math.abs(t.n[1]) > 0.9);
    assert.ok(back.length && back.every(t => t.part === 'plate'), `${kind}: plain rear triangle`);
  }
});

test('a wide front splits into transverse saddles, each with its gable to the street', () => {
  const { outer, local } = box(27.7, 8.3), facing = facingFor(outer);
  const { plan } = planOf('c19', local, 'pitched');
  const pieces = gablePiecesForOutline(outer, origin, plan, KX, facing);
  assert.equal(pieces.length, 5);
  assert.deepEqual(ridges(pieces), Array(5).fill('across'));
  for (const p of pieces) { assert.ok(Math.abs(p.rect.wid - 27.7 / 5) < 0.05, `${p.rect.wid}`); assert.ok(p.plan.streetEnds?.includes(true) && p.plan.streetEnds.includes(false), 'one crowned street end, a plain rear'); }
  // The saddles tile the front exactly.
  const xs = pieces.map(p => p.rect.cx - ox).sort((a, b) => a - b);
  xs.forEach((x, i) => assert.ok(Math.abs(x - (i + 0.5) * 27.7 / 5) < 0.05, `saddle ${i} at ${x}`));
  assert.ok(new Set(pieces.map(p => p.plan.seed)).size === 5, 'each saddle its own seed');
});

test('left alone: no street, ridge already across, narrow corner house, deep block, hipped and non-canal styles', () => {
  // No street test (gallery, boat mode): byte-identical to the planned roof.
  const wide = box(11.6, 7.2), { plan } = planOf('c19', wide.local, 'pitched');
  const h0 = 14 - plan.riseM, plain = JSON.stringify(roofTrianglesForOutline(wide.outer, origin, plan, h0, dims, KX));
  assert.equal(JSON.stringify(roofTrianglesForOutline(wide.outer, origin, plan, h0, dims, KX, () => Infinity)), plain, 'no street seen');
  // A narrow deep house, its end on the street: unchanged.
  const deep = box(6, 14), deepPlan = planOf('canal', deep.local, 'gable').plan;
  assert.deepEqual(ridges(roofPiecesForOutline(deep.outer, origin, deepPlan, KX, facingFor(deep.outer))), ['across']);
  // A narrow corner house (end on the main street, long side on the side street): keeps its narrow front.
  const corner = box(6, 14), cornerPlan = planOf('canal', corner.local, 'pitched').plan;
  assert.deepEqual(ridges(roofPiecesForOutline(corner.outer, origin, cornerPlan, KX, facingFor(corner.outer, true))), ['across']);
  // The same narrow box lying along the main street with its narrow end on the side street: a corner, so the narrow
  // end stays the front and the ridge is not turned.
  const sideways = box(14, 6), sidewaysPlan = planOf('canal', sideways.local, 'pitched').plan;
  assert.deepEqual(ridges(roofPiecesForOutline(sideways.outer, origin, sidewaysPlan, KX, facingFor(sideways.outer, true))), ['along']);
  // A 19th-century block deeper than the cap keeps its roof.
  const block = box(40, TURN_MAX_DEPTH_M + 3), blockPlan = planOf('c19', block.local, 'pitched').plan;
  assert.equal(roofPiecesForOutline(block.outer, origin, blockPlan, KX, facingFor(block.outer)).length, 1);
  assert.deepEqual(ridges(roofPiecesForOutline(block.outer, origin, blockPlan, KX, facingFor(block.outer))), ['along']);
  // Hipped and mansard-hip roofs, and a postwar or school saddle: the street test changes nothing.
  for (const [style, kind] of [['c19', 'halfHipped'], ['c19', 'mansardHip'], ['postwar', 'pitched'], ['school', 'pitched']] as const) {
    const b = box(11.6, 7.2), p = planOf(style, b.local, kind).plan, z = 14 - p.riseM;
    assert.equal(JSON.stringify(roofTrianglesForOutline(b.outer, origin, p, z, dims, KX, facingFor(b.outer))), JSON.stringify(roofTrianglesForOutline(b.outer, origin, p, z, dims, KX)), `${style} ${kind}`);
  }
  // Direct: a plan without the mark is never turned.
  const rect: Rect = { cx: 0, cy: 0, ux: 1, uy: 0, len: 11.6, wid: 7.2, coverage: 1, maxDev: 0 };
  assert.equal(turnRidgeToStreet(rect, { ...plan, streetRidge: undefined }, () => 5), null);
});
