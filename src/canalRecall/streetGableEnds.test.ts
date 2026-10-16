// Street-only crowns on the city tier's gable roofs (user 2026-10-16: "sometimes houses have gables on both the
// street and back side, which is wrong"). streetGableEnds.ts decides the street end; roofMesh.ts draws the crown
// there and a plain saddle triangle at the rear.
import assert from 'node:assert/strict';
import test from 'node:test';
import { GABLE_SHAPES, gablePiecesForOutline, roofTriangles, roofTrianglesForOutline, type Rect, type RoofPlan, type RoofTri } from './roofMesh.ts';
import { SegmentGrid, FALLBACK_REACH_M, streetDistance } from './streetFronts.ts';
import { gableEndWalls, streetGableEnds, type StreetFacing } from './streetGableEnds.ts';

const ORNAMENTAL = GABLE_SHAPES.filter(s => s !== 'plain');
const h0 = 12, dims = { bayM: 2, storeyM: 3, cellM: 1 };
// A 6 m wide, 14 m deep canal house, ridge along x (u): the street end at +u (x = 14), the rear at -u (x = 0).
const rect: Rect = { cx: 7, cy: 3, ux: 1, uy: 0, len: 14, wid: 6, coverage: 1, maxDev: 0 };
const planFor = (gable: RoofPlan['gable'], streetEnds?: [boolean, boolean]): RoofPlan => ({ kind: 'gable', gable, riseM: 3.4, material: 'tile', tone: 0.3, dormers: false, seed: 'rear-crown', chimney: false, accents: true, trimHex: '#eeeeee', shutters: gable === 'spout', shutterHex: '#2f4a3a', ...(streetEnds ? { streetEnds } : {}) });

/** Triangles standing on an end wall (every vertex within 0.6 m of the end plane, x = 0 or x = 14). */
const atEnd = (tris: RoofTri[], x: number) => tris.filter(t => t.p.every(p => Math.abs(p[0] - x) < 0.6));
/** Height of the saddle over a point across the house (v from the ridge line). */
const saddle = (y: number, R: number) => h0 + R * (1 - Math.abs(y - 3) / 3);

test('streetGableEnds: the end that sees a street is the front; the nearer of two; fallback; unknown', () => {
  const at = (d0: number, d1: number, f0 = Infinity, f1 = Infinity): StreetFacing => (w, fallback) => (w.nx < 0 ? (fallback ? f0 : d0) : (fallback ? f1 : d1));
  assert.deepEqual(streetGableEnds(rect, at(Infinity, 6)), [false, true]);
  assert.deepEqual(streetGableEnds(rect, at(5, Infinity)), [true, false]);
  assert.deepEqual(streetGableEnds(rect, at(9, 6)), [false, true], 'a through-lot: the crown on the nearer street only');
  assert.deepEqual(streetGableEnds(rect, at(Infinity, Infinity, 40, 55)), [true, false], 'set back: the end nearest a street');
  assert.equal(streetGableEnds(rect, at(Infinity, Infinity)), undefined, 'no street known: unchanged');
  const [w0, w1] = gableEndWalls(rect);
  assert.deepEqual([w0.nx, w1.nx, w0.len], [-1, 1, 6]);
  assert.ok(Math.abs(w0.x0) < 1e-9 && Math.abs(w1.x0 - 14) < 1e-9);
});

test('every ornamental shape: the crown on the street end, a plain saddle triangle at the rear', () => {
  for (const gable of ORNAMENTAL) {
    const tris = roofTriangles(rect, planFor(gable, [false, true]), h0, dims), R = 3.4;
    const rear = atEnd(tris, 0), front = atEnd(tris, 14);
    assert.ok(rear.length > 0, `${gable}: the rear is closed`);
    assert.deepEqual([...new Set(rear.map(t => t.part))], ['plate'], `${gable}: no trim, decal, shutter or claw on the rear`);
    for (const t of rear) for (const p of t.p) assert.ok(p[2] <= saddle(p[1], R) + 1e-6, `${gable}: nothing on the rear rises above the saddle line (${p[2].toFixed(2)} at v ${p[1].toFixed(2)})`);
    assert.ok(front.some(t => t.part === 'trim' || t.part === 'decal'), `${gable}: the street front keeps its crown`);
    // Mirrored: the street at -u.
    const flipped = roofTriangles(rect, planFor(gable, [true, false]), h0, dims);
    assert.deepEqual([...new Set(atEnd(flipped, 14).map(t => t.part))], ['plate'], `${gable}: mirrored rear plain`);
  }
});

test('no street ends known: byte-identical to the old two-crown roof', () => {
  for (const gable of ORNAMENTAL) {
    const old = JSON.stringify(roofTriangles(rect, planFor(gable), h0, dims));
    assert.equal(JSON.stringify(roofTriangles(rect, { ...planFor(gable), streetEnds: undefined }, h0, dims)), old);
  }
  // A plain gable or a pitched roof never consults the street.
  const pitched: RoofPlan = { ...planFor('plain'), kind: 'pitched' };
  assert.equal(JSON.stringify(roofTriangles(rect, { ...pitched, streetEnds: [false, true] }, h0, dims)), JSON.stringify(roofTriangles(rect, pitched, h0, dims)));
});

test('a terrace on a street: each house crowns its street front, never its back (outline path with the chunk street test)', () => {
  const lng = 4.88, lat = 52.374, kx = 111_320 * Math.cos(lat * Math.PI / 180), KY = 110_540;
  const ll = (x: number, y: number) => [lng + x / kx, lat + y / KY];
  // Three 6 m houses, 14 m deep, fronts on y = 0, a street centreline at y = -8; gardens behind (y > 14).
  const rings = [0, 6, 12].map(x0 => [ll(x0, 0), ll(x0 + 6, 0), ll(x0 + 6, 14), ll(x0, 14), ll(x0, 0)]);
  const origin = { lng: 4.9, lat: 52.37 }, ox = (lng - origin.lng) * kx, oy = (lat - origin.lat) * KY;
  const streets = new SegmentGrid(Float32Array.from([ox - 50, oy - 8, ox + 70, oy - 8]));
  const segs: number[] = [], owners: number[] = [];
  rings.forEach((r, i) => { for (let k = 1; k < r.length; k++) { segs.push((r[k - 1][0] - origin.lng) * kx, (r[k - 1][1] - origin.lat) * KY, (r[k][0] - origin.lng) * kx, (r[k][1] - origin.lat) * KY); owners.push(i); } });
  const walls = new SegmentGrid(segs, 25, owners);
  for (const [i, ring] of rings.entries()) {
    const facing: StreetFacing = (w, fallback) => fallback ? streetDistance(w, streets, null, i, FALLBACK_REACH_M) : streetDistance(w, streets, walls, i);
    for (const gable of ORNAMENTAL) {
      const plan = planFor(gable), kxo = 111_320 * Math.cos(origin.lat * Math.PI / 180);
      const [piece] = gablePiecesForOutline(ring, origin, plan, kxo, facing);
      assert.ok(piece?.plan.streetEnds, `${gable}: street ends decided`);
      const tris = roofTrianglesForOutline(ring, origin, plan, h0, dims, kxo, facing);
      const y = (p: number[]) => p[1] - oy;
      const back = tris.filter(t => t.p.every(p => Math.abs(y(p) - 14) < 0.6)), street = tris.filter(t => t.p.every(p => Math.abs(y(p)) < 0.6));
      assert.deepEqual([...new Set(back.map(t => t.part))], ['plate'], `house ${i} ${gable}: plain back`);
      assert.ok(street.some(t => t.part === 'trim' || t.part === 'decal'), `house ${i} ${gable}: decorated street front`);
      // Without the street test the old roof is drawn unchanged (gallery, no street data).
      assert.equal(JSON.stringify(roofTrianglesForOutline(ring, origin, plan, h0, dims, kxo)), JSON.stringify(roofTrianglesForOutline(ring, origin, plan, h0, dims, kxo, () => Infinity)));
    }
  }
});
