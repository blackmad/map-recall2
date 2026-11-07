// Baked shells (lane R2-B, #229): SHEL quantisation and codes, SHL1 prisms and their extrusion.
// Run: node --import tsx --test src/canalRecall/world/shellMesh.test.ts
import '../../../scripts/world/useBrowserMath.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Reader } from './cellFormat.js';
import { decodeShel, decodeShl1, encodeShel, encodeShelLevel0, encodeShl1, DUP_WINDOW, farCellArrays, farShellMesh, firstUseOrder, quantisePrisms, shellFromChunk, shellOrigin, simplifyRing, NO_BID, SHEL_UNIT_M, type FarPrism } from './shellMesh.js';
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
  return { rings: [ccw ? ring : [...ring].reverse()], eavesM, topM, wall: [200, 100, 50, 5], roof: [90, 80, 70, 9], tile: '8414/5384' };
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

test('farCellArrays: one vertex range per z14 tile, decimetre positions, indices inside their part', () => {
  const a = prism(0, 0, 10, 9, 9), b = { ...prism(30, 0, 10, 12, 15), tile: '8415/5384' }, c = prism(60, 0, 10, 6, 6);
  const out = farCellArrays([a, b, c]);
  assert.deepEqual(out.parts.map(p => p.tile), ['8414/5384', '8415/5384']);
  assert.equal(out.parts[0].start, 0);
  assert.equal(out.parts[1].start, out.parts[0].count);
  assert.equal(out.parts[1].start + out.parts[1].count, out.layers.length);
  assert.equal(out.positions.length, out.layers.length * 3);
  assert.equal(out.tints.length, out.layers.length * 4);
  assert.ok(out.indices instanceof Uint16Array);
  const one = farShellMesh([b], { neighbours: [a, b, c] });
  assert.equal(out.parts[1].count, one.layers.length);
  for (let k = 0; k < one.positions.length; k++) assert.equal(out.positions[out.parts[1].start * 3 + k], Math.round(one.positions[k] * 10));
  // Every triangle stays inside one part: hiding a tile's vertex range hides whole triangles.
  for (let t = 0; t < out.indices.length; t += 3) {
    const owner = (v: number) => out.parts.findIndex(p => v >= p.start && v < p.start + p.count);
    assert.equal(owner(out.indices[t]), owner(out.indices[t + 1]));
    assert.equal(owner(out.indices[t]), owner(out.indices[t + 2]));
  }
  // The pitched prism's lid sits at its roof band's mid height, (12 + 15) / 2 m: 135 dm.
  let top = 0; for (let k = 2; k < out.positions.length; k += 3) top = Math.max(top, out.positions[k]);
  assert.equal(top, 135);
});

// Lane R4-A (#243): SHEL level 1 codes wall quads as quads, duplicated roof corners as back-references, records split.
const wallsAndRoof = () => {
  // A building of two stacked wall quads, a second building's quad sharing an XY corner, a roof plane as two
  // triangles with duplicated corners (fresh 0..2, then a duplicate of 0, a duplicate of 2, one new), and a quad whose
  // corners break the quad pattern (a sheared top) that must stay triangles.
  const P: number[] = [], UV: number[] = [], L: number[] = [], T: number[] = [], A: number[] = [], B: number[] = [], I: number[] = [];
  const v = (x: number, y: number, z: number, u: number, w: number, layer: number, tint: number[], accent: number[], bid: number) => { P.push(x, y, z); UV.push(u, w); L.push(layer); T.push(...tint); A.push(...accent, 255); B.push(bid); return B.length - 1; };
  const quad = (x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, u0: number, u1: number, v0: number, v1: number, layer: number, tint: number[], bid: number) => {
    const a = v(x0, y0, z0, u0, v0, layer, tint, [9, 8, 7], bid), b = v(x1, y1, z0, u1, v0, layer, tint, [9, 8, 7], bid), c = v(x1, y1, z1, u1, v1, layer, tint, [9, 8, 7], bid), d = v(x0, y0, z1, u0, v1, layer, tint, [9, 8, 7], bid);
    I.push(a, b, c, a, c, d);
  };
  quad(0, 0, 4.2, 0.1, 0, 3.9, 0, 1, 0, 1, 140, [199, 195, 186, 217], 3);
  quad(0, 0, 4.2, 0.1, 3.9, 9, 0, 1, 0, 2, 141, [199, 195, 186, 217], 3);
  quad(4.2, 0.1, 8.3, -0.2, 0, 9, 1, 3, 0, 2, 141, [199, 195, 186, 230], 7);
  const r0 = v(0, 0, 9, -6.7896, -0.3081, 122, [168, 72, 47, 249], [9, 8, 7], 3), r1 = v(4.2, 0.1, 9, 6.7896, -0.3081, 122, [168, 72, 47, 249], [9, 8, 7], 3), r2 = v(4.2, 4, 11.5, 6.7896, 5.9333, 122, [168, 72, 47, 249], [9, 8, 7], 3);
  const r3 = v(0, 0, 9, -6.7896, -0.3081, 122, [168, 72, 47, 249], [9, 8, 7], 3), r4 = v(4.2, 4, 11.5, 6.7896, 5.9333, 122, [168, 72, 47, 249], [9, 8, 7], 3), r5 = v(0, 3.9, 11.5, -6.7896, 5.9333, 122, [168, 72, 47, 249], [9, 8, 7], 3);
  I.push(r0, r1, r2, r3, r4, r5);
  const s0 = v(10, 10, 0, 0, 0, 5, [1, 2, 3, 4], [5, 6, 7], NO_BID), s1 = v(11, 10, 0, 1, 0, 5, [1, 2, 3, 4], [5, 6, 7], NO_BID), s2 = v(11, 10, 3.1, 1, 1, 5, [1, 2, 3, 4], [5, 6, 7], NO_BID), s3 = v(10, 10, 3, 0, 1, 5, [1, 2, 3, 4], [5, 6, 7], NO_BID);
  I.push(s0, s1, s2, s0, s2, s3, s1, s2, s0);
  return { positions: Float32Array.from(P), uvs: Float32Array.from(UV), layers: Uint8Array.from(L), tints: Uint8Array.from(T), accents: Uint8Array.from(A), bids: Uint16Array.from(B), indices: Uint32Array.from(I) };
};
const quantised = () => { const m = wallsAndRoof(); return decodeShel(new Reader(encodeShelLevel0(m))); };

test('SHEL level 1: quads, duplicate corners and plain triangles round-trip exactly, and decode as level 0 does', () => {
  const m = quantised(), bytes = encodeShel(m);
  assert.equal(bytes[0], 1, 'level 1');
  const back = decodeShel(new Reader(bytes));
  assert.deepEqual(back, m);
  assert.deepEqual(encodeShel(back), bytes);
  // Level 0 bytes still decode (staged before lane R4-A).
  assert.deepEqual(decodeShel(new Reader(encodeShelLevel0(m))), m);
  assert.ok(DUP_WINDOW >= 3);
  // Damage: every truncation throws, and an index ahead of the high-water mark is refused at encode.
  for (let n = 0; n < bytes.length; n++) assert.throws(() => decodeShel(new Reader(bytes.subarray(0, n))), /./, `prefix ${n}`);
  assert.throws(() => encodeShel({ ...m, indices: Uint32Array.from([0, 2, 1, ...m.indices.subarray(3)]) }), /skips ahead/);
});

test('SHEL level 1: smaller than level 0 on a wall-heavy mesh', () => {
  const big = quantised();
  // Many copies of the mesh side by side (a street): the quad and record codes pay off.
  const reps = 50, n = big.layers.length, ni = big.indices.length;
  const m = { positions: new Float32Array(n * 3 * reps), uvs: new Float32Array(n * 2 * reps), layers: new Uint8Array(n * reps), tints: new Uint8Array(n * 4 * reps), accents: new Uint8Array(n * 4 * reps), bids: new Uint16Array(n * reps), indices: new Uint32Array(ni * reps) };
  for (let r = 0; r < reps; r++) {
    for (let k = 0; k < n * 3; k++) m.positions[r * n * 3 + k] = big.positions[k] + (k % 3 === 0 ? Math.round(r * 83) / 10 : 0);
    m.uvs.set(big.uvs, r * n * 2); m.layers.set(big.layers, r * n); m.tints.set(big.tints, r * n * 4); m.accents.set(big.accents, r * n * 4); m.bids.set(big.bids, r * n);
    for (let k = 0; k < ni; k++) m.indices[r * ni + k] = big.indices[k] + r * n;
  }
  const q = decodeShel(new Reader(encodeShelLevel0(m)));
  const l1 = encodeShel(q), l0 = encodeShelLevel0(q);
  assert.deepEqual(decodeShel(new Reader(l1)), q);
  assert.ok(l1.length < l0.length * 0.8, `${l1.length} vs ${l0.length}`);
});
