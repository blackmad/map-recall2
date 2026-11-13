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

test('SHEL: positions to SHEL_UNIT_M from the cell origin, first-use order, bids from ranges, exact round trip', () => {
  const chunk = quadChunk(), origin: [number, number] = [1000, 2000];
  const m = shellFromChunk(chunk, origin, id => ({ a: 4, b: 9 } as Record<string, number>)[id] ?? -1);
  assert.deepEqual([...m.bids], [4, 4, 4, 4, 9, 9, 9, 9, NO_BID, NO_BID, NO_BID]);
  assert.equal(SHEL_UNIT_M, 2 ** -17);
  // Finer than a Float32 step this far from ORIGIN: the cell origin plus the decoded value is the chunk's own Float32.
  const order = [0, 1, 2, 3];
  for (const k of order) for (let c = 0; c < 2; c++) assert.equal(Math.fround(origin[c] + m.positions[k * 3 + c]), chunk.positions[k * 3 + c]);
  assert.ok(Math.abs(m.positions[8] - chunk.positions[8]) <= SHEL_UNIT_M / 2, "z within half a unit (below 128 m a Float32 step is finer)");
  for (const v of m.positions) assert.ok(Math.abs(v / SHEL_UNIT_M - Math.round(v / SHEL_UNIT_M)) < 1e-3);
  const bytes = encodeShel(m), back = decodeShel(new Reader(bytes));
  assert.deepEqual(back, m);
  // Re-encoding the decoded mesh gives the same bytes (the compiler's round-trip check).
  assert.deepEqual(encodeShel(back), bytes);
  // Damaged: a truncated payload and an index ahead of the high-water mark throw.
  assert.throws(() => decodeShel(new Reader(bytes.subarray(0, bytes.length - 2))));
  assert.throws(() => encodeShel({ ...m, indices: Uint32Array.from([1, 0, 2]) }), /skips ahead/);  // The chunk's thin pairs follow their vertices (first-use order is the identity here); none gives zeros.
  assert.deepEqual([...m.thin!], new Array(22).fill(0));
  const thin = Uint8Array.from({ length: 22 }, (_, k) => k + 1), t = shellFromChunk({ ...chunk, thin }, origin, id => ({ a: 4, b: 9 } as Record<string, number>)[id] ?? -1);
  assert.deepEqual([...t.thin!], [...thin]);
  assert.deepEqual(decodeShel(new Reader(encodeShel(t))), t);
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
/** A mesh's positions on the level 2 grid (as shellFromChunk leaves them): what a level 2 round trip gives back exactly. */
const onGrid = <T extends { positions: Float32Array }>(m: T): T => ({ ...m, positions: m.positions.map(v => Math.round(v / SHEL_UNIT_M) * SHEL_UNIT_M) });

test('SHEL level 2: quads, duplicate corners, plain triangles and the thin pairs round-trip exactly; level 0 still decodes', () => {
  // Thin pairs (look/thinFade.ts): a cornice strip on the second wall quad, a trim on one roof triangle's corners.
  const level0 = quantised(), base = onGrid(level0), thin = new Uint8Array(base.layers.length * 2);
  for (let k = 4; k < 8; k++) { thin[k * 2] = 18; thin[k * 2 + 1] = 5; }
  for (const k of [12, 13, 14]) { thin[k * 2] = 7; thin[k * 2 + 1] = 4; }
  const m = { ...base, thin }, bytes = encodeShel(m);
  assert.equal(bytes[0], 2, 'level 2');
  const back = decodeShel(new Reader(bytes));
  assert.deepEqual(back, m);
  assert.deepEqual(encodeShel(back), bytes);
  // Without thin pairs the encoder writes zeros (not a thin element): what a mesh from a chunk without them gets.
  assert.deepEqual(decodeShel(new Reader(encodeShel(base))), { ...base, thin: new Uint8Array(base.layers.length * 2) });
  // A quad whose corners disagree on thin is coded as triangles and still round-trips.
  const odd = new Uint8Array(thin); odd[1 * 2] = 9;
  assert.deepEqual(decodeShel(new Reader(encodeShel({ ...base, thin: odd }))), { ...base, thin: odd });
  // Level 0 bytes still decode (staged before lane R4-A), without thin.
  assert.deepEqual(decodeShel(new Reader(encodeShelLevel0(level0))), level0);
  assert.ok(DUP_WINDOW >= 3);
  // Damage: every truncation throws, and an index ahead of the high-water mark is refused at encode.
  for (let n = 0; n < bytes.length; n++) assert.throws(() => decodeShel(new Reader(bytes.subarray(0, n))), /./, `prefix ${n}`);
  assert.throws(() => encodeShel({ ...m, indices: Uint32Array.from([0, 2, 1, ...m.indices.subarray(3)]) }), /skips ahead/);
});

test('SHEL level 2: smaller than level 0 on a wall-heavy mesh', () => {
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
  assert.deepEqual(decodeShel(new Reader(l1)), { ...onGrid(q), thin: new Uint8Array(q.layers.length * 2) });
  assert.ok(l1.length < l0.length * 0.8, `${l1.length} vs ${l0.length}`);
});

// Lane R4-A (#243): the bake builds a group tile's chunk as the runtime does and gives each cell its own ranges.
test('shell bake: a cell takes its own ranges of a group chunk (allotment by its garden id), and parts merge in order', async () => {
  const { subsetShellChunk, mergeShellChunks } = await import('../../../scripts/world/shellBake.js');
  const chunk = { ...quadChunk(), thin: new Uint8Array(22).map((_, k) => k) };
  const a = subsetShellChunk(chunk, id => id === 'a' || id === 'x'), b = subsetShellChunk(chunk, id => id === 'b');
  assert.deepEqual(a.ranges, [{ id: 'a', start: 0, count: 4 }, { id: 'allotment-garden:x', start: 4, count: 3 }]);
  assert.deepEqual([...a.indices], [0, 1, 2, 0, 2, 3, 4, 5, 6]);
  assert.deepEqual([...a.positions.subarray(12, 15)], [...chunk.positions.subarray(24, 27)]);
  assert.deepEqual([...a.layers], [3, 3, 3, 3, 1, 1, 1]);
  assert.deepEqual([...a.thin!.subarray(8, 10)], [16, 17]);
  assert.deepEqual([...b.indices], [0, 1, 2, 0, 2, 3]);
  const m = mergeShellChunks([b, a]);
  assert.deepEqual(m.ranges.map(r => [r.id, r.start, r.count]), [['b', 0, 4], ['a', 4, 4], ['allotment-garden:x', 8, 3]]);
  assert.deepEqual([...m.indices], [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10]);
  assert.deepEqual([...m.positions.subarray(0, 3)], [...chunk.positions.subarray(12, 15)]);
  assert.equal(mergeShellChunks([a]), a);
});

// --- SHEL level 3 (F1 S2, #380): the facade-record mesh, FREC and CROW, and the legacy files untouched ---------------
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodeShel3, encodeShel3, isRoofKind, recordShellFromChunk, WALL_KINDS, WALL_UV_UNIT_M, SHEL_RECORD_LEVEL } from './shellMesh.js';
import { decodeShellCell, encodeShellCell } from './cellFormat.js';
import { CROWN_BYTES, decodeCrow, decodeFrec, encodeCrow, encodeFrec, quantiseCrown, type CrownEntry } from './facadeStreams.js';
import { bakedRecordArrays } from './bakedCellArrays.js';
import { FACADE_RECORD_VERSION, packFacadeRecordFor } from '../look/facadeRecord.js';

const recordChunk = () => {
  // Building a: one wall quad (front) and a roof triangle; building b: a party-wall quad and a quad split by a cut.
  const positions = new Float32Array([1000.04, 2000.06, 0, 1010, 2000, 0, 1010, 2000, 9.96, 1000, 2000, 10, 1000, 2000, 10, 1010, 2000, 10, 1005, 2005, 13,
    1200, 2100, 0, 1201, 2100, 0, 1201, 2100, 3, 1200, 2100, 3]);
  const walls = new Float32Array([0, 0, 10.0, 10.0, 0, 10.0, 10.0, 9.96, 10.0, 0, 10, 10.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.01, -0.5, 1, 4.01, -0.5, 1, 4.01, 2.5, 1, 3.01, 2.5, 1]);
  const recs = Uint16Array.from([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
  const wallKinds = Uint8Array.from([0, 0, 0, 0, 7, 7, 7, 3, 3, 3, 3]);
  const indices = Uint32Array.from([0, 1, 2, 0, 2, 3, 4, 5, 6, 7, 8, 9, 7, 9, 10]);
  return { positions, walls, recs, wallKinds, indices, ranges: [{ id: 'a', start: 0, count: 7 }, { id: 'b', start: 7, count: 4 }] };
};

test('SHEL level 3: wall metres, records and wall kinds round-trip exactly; quads take the quad code', () => {
  const m = recordShellFromChunk(recordChunk(), [1000, 2000], id => ({ a: 0, b: 1 } as Record<string, number>)[id] ?? -1);
  assert.equal(m.recs.length, 11);
  assert.ok(Math.abs(m.walls[2 * 3 + 1] - 9.96) < 1e-5 && Number.isInteger(Math.round(m.walls[2 * 3 + 1] / WALL_UV_UNIT_M)));
  const bytes = encodeShel3(m);
  assert.equal(bytes[0], SHEL_RECORD_LEVEL);
  const d = decodeShel3(new Reader(bytes, 't'));
  assert.deepEqual(d, m);
  assert.deepEqual([...d.wallKinds], [0, 0, 0, 0, 7, 7, 7, 3, 3, 3, 3]);
  assert.equal(WALL_KINDS.roof, 7);
  // The legacy decoder refuses level 3 (the flag-off path never reads a record shell).
  assert.throws(() => decodeShel(new Reader(bytes, 't')), /SHEL level 3/);
});

test('SHEL level 3: random meshes round-trip (dup back-references, negative wall v, long runs)', () => {
  let s = 7; const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296;
  const n = 300, positions = new Float32Array(n * 3), walls = new Float32Array(n * 3), recs = new Uint16Array(n), wallKinds = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const dup = k > 2 && rnd() < 0.2; const src = dup ? k - 1 - Math.floor(rnd() * 2) : k;
    for (let c = 0; c < 3; c++) { positions[k * 3 + c] = dup ? positions[src * 3 + c] : 900 + rnd() * 200; walls[k * 3 + c] = dup ? walls[src * 3 + c] : (rnd() - 0.2) * 40; }
    recs[k] = dup ? recs[src] : Math.floor(rnd() * 3000); wallKinds[k] = dup ? wallKinds[src] : Math.floor(rnd() * 8);
  }
  const indices = Uint32Array.from({ length: n }, (_, k) => k);
  const m = recordShellFromChunk({ positions, walls, recs, wallKinds, indices, ranges: [{ id: 'a', start: 0, count: n }] }, [1000, 1000], () => 5);
  assert.deepEqual(decodeShel3(new Reader(encodeShel3(m), 't')), m);
});

test('FREC and CROW round-trip; a record shell file carries SHEL level 3 + FREC + CROW', () => {
  const recs = [packFacadeRecordFor({ id: 'a', style: 'canal', wallHex: '#7a3e2c', heightM: 12 }), packFacadeRecordFor({ id: 'b', style: 'c19', wallHex: '#6a4a36', heightM: 15, eavesM: 13 })];
  const bytes = new Uint8Array(128); bytes.set(recs[0], 0); bytes.set(recs[1], 64);
  const set = { version: FACADE_RECORD_VERSION, count: 2, bytes };
  assert.deepEqual(decodeFrec(new Reader(encodeFrec(set), 'f')), set);
  const crown: CrownEntry = { x0: -12.34, y0: 998.76, x1: 4.5, y1: 1003.2, z: 11.37, rise: 4.21, neck: 0.4, capRise: 0.62, kind: 'neck', steps: 0, shoulder: 'ogee', cap: 'pediment', capSpan: 'medium', half: null, finial: true, depth: 0.3, rec: 1, rgb: [122, 62, 44] };
  const q = quantiseCrown(crown);
  assert.ok(Math.abs(q.x0 - crown.x0) <= 0.05 && Math.abs(q.z - crown.z) <= 0.005 && q.kind === 'neck' && q.shoulder === 'ogee' && q.cap === 'pediment' && q.finial);
  const step: CrownEntry = { ...crown, kind: 'step', steps: 5, shoulder: null, cap: null, capSpan: null, half: 'left', finial: false };
  assert.deepEqual(decodeCrow(new Reader(encodeCrow([crown, step]), 'c')), [q, quantiseCrown(step)]);
  assert.equal(CROWN_BYTES, 24);
  const rshel = recordShellFromChunk(recordChunk(), [1000, 2000], id => ({ a: 0, b: 1 } as Record<string, number>)[id] ?? -1);
  const file = encodeShellCell({ i: 0, j: 2, rshel, records: set, crowns: [q] }).bytes;
  const back = decodeShellCell(file, 'rec');
  assert.deepEqual(back.rshel, rshel); assert.deepEqual(back.records, set); assert.deepEqual(back.crowns, [q]); assert.equal(back.shel, undefined);
  assert.throws(() => encodeShellCell({ i: 0, j: 0, rshel, shel: shellFromChunk(quadChunk(), [1000, 2000], () => 0) }), /one SHEL/);
  // The GPU layout: 18 B a vertex in the accounting (6 position + 6 wall + 2 rec + 1 kind + hidden/swap/pad 3).
  const g = bakedRecordArrays(rshel, ['a', 'b'], true);
  assert.equal(g.positions.BYTES_PER_ELEMENT * 3 + g.walls.BYTES_PER_ELEMENT * 3 + g.recs.BYTES_PER_ELEMENT + g.wallKinds.BYTES_PER_ELEMENT + 3, 18);
  assert.deepEqual(g.ranges.map(r => [r.id, r.count]), [['a', 7], ['b', 4]]);
  assert.equal(g.walls[2 * 3 + 1], Math.round(9.96 / WALL_UV_UNIT_M));
});

test('the published legacy shells re-encode byte for byte (F1 adds streams, changes none)', () => {
  const dir = path.resolve(process.env.WORLD_CELLS_DIR || 'public/data/extracts/amsterdam/world-v1', 'shells');
  if (!fs.existsSync(dir)) return;
  const keys = fs.readdirSync(dir).filter(f => f.endsWith('.bin')).sort().slice(0, 6);
  for (const f of keys) {
    const raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, f)));
    const cell = decodeShellCell(raw, f);
    assert.ok(cell.shel && !cell.rshel && !cell.records);
    assert.ok(Buffer.from(encodeShellCell(cell).bytes).equals(raw), f);
  }
});

test('P5 RATT: a record shell carries its roof vertices in the default look; walls stay zero; the file round-trips', () => {
  const c = recordChunk(), n = c.recs.length;
  const look = { uvs: Float32Array.from({ length: n * 2 }, (_, k) => k * 0.37 - 1.3), layers: Uint8Array.from({ length: n }, (_, k) => 10 + k), tints: Uint8Array.from({ length: n * 4 }, (_, k) => (k * 7) & 255),
    accents: Uint8Array.from({ length: n * 4 }, (_, k) => 255 - k), thin: Uint8Array.from({ length: n * 2 }, (_, k) => k) };
  const m = recordShellFromChunk({ ...c, look }, [1000, 2000], id => ({ a: 0, b: 1 } as Record<string, number>)[id] ?? -1);
  assert.ok(m.look);
  const roof = [...m.wallKinds].map((k, i) => [k, i] as const).filter(([k]) => isRoofKind(k)).map(([, i]) => i);
  assert.equal(roof.length, 3);
  for (let k = 0; k < m.wallKinds.length; k++) if (!isRoofKind(m.wallKinds[k])) assert.equal(m.look!.layers[k] + m.look!.tints[k * 4] + m.look!.uvs[k * 2], 0, 'a wall vertex carries no look');
  for (const k of roof) assert.ok(m.look!.layers[k] >= 10, 'a roof vertex carries its layer');
  const set = { version: FACADE_RECORD_VERSION, count: 2, bytes: new Uint8Array(128) };
  const back = decodeShellCell(encodeShellCell({ i: 0, j: 2, rshel: m, records: set }).bytes, 'ratt');
  assert.deepEqual(back.rshel, m);
  // An older record shell (no look) still writes no RATT and decodes without one.
  const plain = recordShellFromChunk(c, [1000, 2000], id => ({ a: 0, b: 1 } as Record<string, number>)[id] ?? -1);
  assert.equal(decodeShellCell(encodeShellCell({ i: 0, j: 2, rshel: plain, records: set }).bytes, 'p').rshel!.look, undefined);
  // The baked arrays regroup the look with the vertices.
  const g = bakedRecordArrays(m, ['a', 'b'], true);
  assert.ok(g.look && g.look.layers.length === g.recs.length);
  for (let v = 0; v < g.recs.length; v++) assert.equal(isRoofKind(g.wallKinds[v]), g.look!.layers[v] >= 10);
});
