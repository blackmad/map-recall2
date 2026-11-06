// Baked shells (lane R2-B, #229): SHEL quantisation and codes, SHL1 prisms and their extrusion.
// Run: node --import tsx --test src/canalRecall/world/shellMesh.test.ts
import '../../../scripts/world/useBrowserMath.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Reader } from './cellFormat.js';
import { decodeShel, decodeShl1, encodeShel, encodeShl1, farShellMesh, firstUseOrder, quantisePrisms, shellFromChunk, shellOrigin, simplifyRing, NO_BID, SHEL_UNIT_M, type FarPrism } from './shellMesh.js';
import { CELL_GRID, cellBounds } from './cellGrid.js';

test('shellOrigin is the cell SW corner in the chunk frame (threeBuildingFeatures ORIGIN projection)', () => {
  for (const [i, j] of [[0, 0], [0, -1], [-4, 0], [8, -2]]) {
    const [w, s] = cellBounds(i, j), [x, y] = shellOrigin(i, j);
    assert.ok(Math.abs(x - (w - 4.9) * 111_320 * Math.cos(52.37 * Math.PI / 180)) < 1e-6);
    assert.ok(Math.abs(y - (s - 52.37) * 110_540) < 1e-6);
  }
  assert.equal(CELL_GRID.cellSizeM, 1000);
});

const quadChunk = () => {
  // Two buildings, one quad each, plus an allotment range the cell does not list.
  const positions = new Float32Array([1000.04, 2000.06, 0, 1010, 2000, 0, 1010, 2000, 9.96, 1000, 2000, 10, 1200, 2100, 0, 1201, 2100, 0, 1201, 2100, 3, 1200, 2100, 3, 1300, 2000, 0, 1301, 2000, 0, 1301, 2000, 1]);
  const uvs = new Float32Array(22).map((_, k) => k * 0.123456);
  const layers = Uint8Array.from([3, 3, 3, 3, 7, 7, 7, 7, 1, 1, 1]), tints = new Uint8Array(44).map((_, k) => (k * 37) & 255), accents = new Uint8Array(44).fill(255);
  const indices = Uint32Array.from([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10]);
  return { positions, uvs, layers, tints, accents, indices, ranges: [{ id: 'a', start: 0, count: 4 }, { id: 'b', start: 4, count: 4 }, { id: 'allotment-garden:x', start: 8, count: 3 }] };
};

test('SHEL: positions to 0.1 m from the cell origin, first-use order, bids from ranges, exact round trip', () => {
  const chunk = quadChunk(), origin: [number, number] = [1000, 2000];
  const m = shellFromChunk(chunk, origin, id => ({ a: 4, b: 9 } as Record<string, number>)[id] ?? -1);
  assert.deepEqual([...m.bids], [4, 4, 4, 4, 9, 9, 9, 9, NO_BID, NO_BID, NO_BID]);
  assert.ok(Math.abs(m.positions[0] - 0) < 1e-6 && Math.abs(m.positions[1] - 0.1) < 1e-6, 'rounded to the decimetre');
  assert.ok(Math.abs(m.positions[8] - 10) < 1e-5);
  for (const v of m.positions) assert.ok(Math.abs(v / SHEL_UNIT_M - Math.round(v / SHEL_UNIT_M)) < 1e-3);
  const bytes = encodeShel(m), back = decodeShel(new Reader(bytes));
  assert.deepEqual(back, m);
  // Re-encoding the decoded mesh gives the same bytes (the compiler's round-trip check).
  assert.deepEqual(encodeShel(back), bytes);
  // Damaged: a truncated payload and an index ahead of the high-water mark throw.
  assert.throws(() => decodeShel(new Reader(bytes.subarray(0, bytes.length - 2))));
  assert.throws(() => encodeShel({ ...m, indices: Uint32Array.from([1, 0, 2]) }), /skips ahead/);
});

test('firstUseOrder renumbers by first use and drops unused vertices', () => {
  const { order, indices } = firstUseOrder([2, 0, 3, 3, 0, 2], 5);
  assert.deepEqual([...order], [2, 0, 3]); assert.deepEqual([...indices], [0, 1, 2, 2, 1, 0]);
});

test('simplifyRing drops collinear points within the tolerance and keeps a triangle', () => {
  const square = [[0, 0], [5, 0.2], [10, 0], [10, 10], [0, 10]];
  assert.deepEqual(simplifyRing(square, 1), [[0, 0], [10, 0], [10, 10], [0, 10]]);
  assert.equal(simplifyRing([[0, 0], [1, 0], [0, 1]], 5).length, 3);
});

const prism = (x: number, y: number, w: number, eavesM: number, topM: number, ccw = true): FarPrism => {
  const ring = [[x, y], [x + w, y], [x + w, y + w], [x, y + w]];
  return { rings: [ccw ? ring : [...ring].reverse()], eavesM, topM, wall: [200, 100, 50, 5], roof: [90, 80, 70, 9] };
};

test('SHL1: prisms quantise to the 0.5 m grid and decimetres and round-trip exactly', () => {
  const ps = quantisePrisms([prism(0.26, 0.74, 10.1, 9.04, 14.96), { ...prism(20, 20, 5, 3, 3), rings: [[[20, 20], [30, 20], [30, 30], [20, 30]], [[22, 22], [22, 24], [24, 24], [24, 22]]] }]);
  assert.deepEqual(ps[0].rings[0][0], [0.5, 0.5]); assert.equal(ps[0].eavesM, 9); assert.equal(ps[0].topM, 15);
  const back = decodeShl1(new Reader(encodeShl1(ps)));
  assert.deepEqual(back, ps);
  assert.throws(() => decodeShl1(new Reader(encodeShl1(ps).subarray(0, 10))));
});

test('farShellMesh: walls face out, lids face up, a pitched roof gets its band, party walls under a taller neighbour are culled', () => {
  const normalOf = (m: ReturnType<typeof farShellMesh>, t: number) => {
    const [a, b, c] = [m.indices[t * 3], m.indices[t * 3 + 1], m.indices[t * 3 + 2]].map(i => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return { n: [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], centre: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] };
  };
  for (const ccw of [true, false]) {
    const flat = farShellMesh([prism(0, 0, 10, 9, 9, ccw)]);
    assert.equal(flat.indices.length / 3, 4 * 2 + 2, 'four walls and a two-triangle lid');
    for (let t = 0; t < flat.indices.length / 3; t++) {
      const { n, centre } = normalOf(flat, t);
      if (Math.abs(n[2]) > 1e-9) { assert.ok(n[2] > 0, 'lid faces up'); continue; }
      assert.ok(n[0] * (centre[0] - 5) + n[1] * (centre[1] - 5) > 0, `wall ${t} faces out (ccw ${ccw})`);
    }
  }
  const pitched = farShellMesh([prism(0, 0, 10, 9, 15)]);
  assert.equal(pitched.indices.length / 3, 4 * 4 + 2, 'walls, roof bands and the lid');
  assert.equal(Math.max(...[...pitched.positions].filter((_, k) => k % 3 === 2)), 12, 'the lid at the roof mid height');
  // A taller neighbour sharing the east wall: this prism's east wall goes; the neighbour's west wall stays (it stands above).
  const pair = [prism(0, 0, 10, 9, 9), prism(10, 0, 10, 15, 15)];
  assert.equal(farShellMesh(pair).indices.length / 3, (3 + 4) * 2 + 4);
  assert.equal(farShellMesh(pair, { partyWalls: true }).indices.length / 3, (4 + 4) * 2 + 4);
  // Shades: tint alpha is the baked shade (0.84..1 walls), layer from the prism.
  assert.ok([...pitched.tints].filter((_, k) => k % 4 === 3).every(a => a >= 0.5 * 255 - 1));
  assert.ok([...pitched.layers].every(l => l === 5 || l === 9));
});
