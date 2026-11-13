// Lane FD 2026-11-13: street faces from data. Synthetic rows on a street along the x axis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetGrid, buildFaces, singleReasons, cornerCount, distribution, frontageAxis, signatureOf, streetFront, type FacePand, type Ring, type Segment } from './faces.ts';

const street: Segment[] = [{ name: 'Teststraat', x0: -50, y0: 0, x1: 150, y1: 0 }, { name: 'Zijstraat', x0: 0, y0: 0, x1: 0, y1: 100 }];
const box = (x: number, w: number, d = 11, y0 = 8): Ring => [[x, y0], [x + w, y0], [x + w, y0 + d], [x, y0 + d], [x, y0]];
const grid = new StreetGrid(street);
const pand = (id: string, ring: Ring, year: number | null): FacePand => {
  const f = streetFront(ring, grid)!;
  return { id, ring, year, street: f.street, side: f.side, sig: signatureOf(ring, frontageAxis(ring, f.dir)) };
};

test('signature measures frontage and depth on the street axis, rotation free', () => {
  const s = signatureOf(box(10, 16), [1, 0]);
  assert.ok(Math.abs(s.frontM - 16) < 1e-9 && Math.abs(s.depthM - 11) < 1e-9);
  assert.equal(s.corners, 4); assert.equal(s.points, 4);
  const withNode: Ring = [[10, 8], [18, 8], [26, 8], [26, 19], [10, 19], [10, 8]];
  assert.equal(signatureOf(withNode, [1, 0]).corners, 4); assert.equal(signatureOf(withNode, [1, 0]).points, 5);
  assert.equal(cornerCount(box(0, 5)), 4);
});

test('a row of identical touching pands of one year is one face; the street and side come from the centreline', () => {
  const row = [10, 20, 30, 40, 50].map((x, i) => pand(`p${i}`, box(x, 10), 1905));
  assert.ok(row.every(p => p.street === 'Teststraat' && p.side === 'N'));
  const faces = buildFaces(row);
  assert.equal(faces.length, 1);
  assert.equal(faces[0].pands.length, 5); assert.equal(faces[0].frontageM, 50);
});

test('a different year (beyond +-3), a gap, a deeper pand or the other side of the street break the face', () => {
  const faces = buildFaces([pand('a', box(10, 10), 1905), pand('b', box(20, 10), 1908), pand('c', box(30, 10), 1925), pand('d', box(45, 10), 1925), pand('e', box(60, 10, 20), 1925)]);
  const sizes = faces.map(f => f.pands.length).sort();
  assert.deepEqual(sizes, [1, 1, 1, 2]);
  const south = pand('s', box(10, 10, 11, -19), 1905);
  assert.equal(south.side, 'S');
  assert.equal(buildFaces([pand('a', box(10, 10), 1905), south]).length, 2);
});

test('match modes: strict needs equal corners, shape does not, year ignores shape; unknown years never join', () => {
  const l: Ring = [[20, 8], [30, 8], [30, 14], [25, 14], [25, 19], [20, 19], [20, 8]];
  const row = [pand('a', box(10, 10), 1905), pand('b', l, 1905)];
  assert.equal(buildFaces(row, 'strict').length, 2);
  assert.equal(buildFaces(row, 'shape').length, 1);
  assert.equal(buildFaces([pand('a', box(10, 10), 1905), pand('b', box(20, 25, 5), 1905)], 'year').length, 1);
  assert.equal(buildFaces([pand('a', box(10, 10), null), pand('b', box(20, 10), null)]).length, 2);
});

test('a corner pand is flagged when a second street is near', () => {
  assert.equal(streetFront(box(3, 10), grid)!.corner, true);
  assert.equal(streetFront(box(60, 10), grid)!.corner, false);
});

test('distribution: faces to cover shares, mean, median and the single-pand share', () => {
  const mk = (n: number) => ({ street: 'x', side: 'N', pands: Array.from({ length: n }, (_, i) => `p${i}`), frontageM: n * 6, year: 1900, yearMin: 1900, yearMax: 1900, signature: '' });
  const d = distribution([mk(8), mk(1), mk(1)]);
  assert.equal(d.pands, 10); assert.equal(d.facesFor.p50, 1); assert.equal(d.facesFor.p80, 1); assert.equal(d.facesFor.p95, 3);
  assert.ok(Math.abs(d.singleFaceShare - 2 / 3) < 1e-9); assert.equal(d.medianSize, 1);
});

test('single-pand reasons: isolated, year, shape and an already-described neighbour', () => {
  const r = singleReasons([pand('iso', box(10, 10), 1905), pand('y1', box(40, 10), 1905), pand('y2', box(50, 10), 1930), pand('s1', box(80, 10), 1905), pand('s2', box(90, 10, 20), 1905), pand('d', box(120, 10), 1905)], [pand('fixed', box(130, 10), 1905)]);
  assert.equal(r.get('iso'), 'no-neighbour'); assert.equal(r.get('y1'), 'year-differs'); assert.equal(r.get('s2'), 'shape-differs');
  assert.equal(r.get('d'), 'described-neighbour'); assert.equal(r.has('fixed'), false);
});
