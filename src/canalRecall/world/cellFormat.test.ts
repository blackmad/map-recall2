// world-v1 cell format: exact round trips on real pands, sentinels pinned by id and first vertex,
// strict rejection of damaged input, and chunk arrays identical to the default tile path.
// Run: node --import tsx --test src/canalRecall/world/cellFormat.test.ts
import '../../../scripts/world/useBrowserMath.js'; // first: the browser's Math.cos/sin (browserMath.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeCell, encodeCell, rawFeature, styledFeature, sameValue, Writer, Reader, StringTable, writeValue, readValue, WORLD_FORMAT_VERSION, type Cell, type CellBuilding } from './cellFormat.js';
import { buildingCell, cellOf, cellBounds, parseCellKey } from './cellGrid.js';
import { readWorldIndex } from './worldCells.js';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gameChain, loadTile, type Row } from '../../../scripts/world/pipeline.js';
import { buildFeatureChunk } from '../threeBuildingFeatures.js';

const TILES = ['8413/5384', '8414/5384', '8420/5385'];
let rowsPromise: Promise<Row[]> | null = null;
const rows = () => rowsPromise ??= (async () => { const chain = gameChain(), out: Row[] = []; for (const t of TILES) out.push(...await loadTile(t, chain)); return out; })();
const toBuilding = (r: Row): CellBuilding => ({ id: String(r.raw.properties.id), tile: r.tile, ordinal: r.ordinal, geometry: r.raw.geometry, attr: r.raw.properties, styled: r.styled === r.raw ? undefined : r.styled.properties });
function cellsOf(list: Row[]): Map<string, Row[]> { const m = new Map<string, Row[]>(); for (const r of list) { let l = m.get(r.cell); if (!l) m.set(r.cell, l = []); l.push(r); } return m; }
const cellFrom = (key: string, list: Row[], debug = true): Cell => { const [i, j] = parseCellKey(key); return debug ? { i, j, buildings: list.map(toBuilding), hide: [], debug } : { i, j, buildings: list.map(toBuilding), hide: [] }; };

/** Sentinels: id, cell, source tile, first vertex exactly as the tile JSON has it. */
const SENTINELS = [
  { name: 'Westerkerk (kit-covered nave)', id: 'NL.IMBAG.Pand.0363100012164998', cell: '-2_0', tile: '8414/5384', first: [4.884358, 52.374554] },
  { name: 'Bloemgracht 80', id: 'NL.IMBAG.Pand.0363100012169916', cell: '-2_0', tile: '8414/5384', first: [4.880912, 52.374989] },
  { name: 'Nassaukade 145-152 row (opposite berth 506)', id: 'NL.IMBAG.Pand.0363100012152464', cell: '-2_0', tile: '8413/5384', first: [4.873121, 52.372223] },
  { name: 'courtyard hole (Leidsegracht block)', id: 'NL.IMBAG.Pand.0363100012171813', cell: '-1_-1', tile: '8414/5384', first: [4.8883956, 52.368589], holes: 1 },
  { name: 'IJburg east edge', id: 'NL.IMBAG.Pand.0363100012254393', cell: '8_-2', tile: '8420/5385', first: [5.020292, 52.352111] },
];

test('generic values round-trip exactly, including the awkward doubles', () => {
  const values = [undefined, null, true, false, 0, -0, 1, -1, 2 ** 52, -(2 ** 52), 2 ** 53 + 2, 0.1, 9.58, 12.832327708732336, 4.8883956, 52.368589, 1e-7, 1e21, NaN, Infinity, -Infinity, '', 'ü', '#7b7b7b',
    [1, [2, [3]]], { b: 1, a: { z: [null, undefined], y: 'x' } }, { roofSlot: 'slate', roofDormer: false, k: undefined }];
  const s = new StringTable(), w = new Writer();
  for (const v of values) writeValue(w, s, v);
  const r = new Reader(w.done());
  for (const v of values) { const back = readValue(r, s.list); assert.ok(sameValue(back, v), `${String(v)} -> ${String(back)}`); }
  r.end();
  assert.throws(() => writeValue(new Writer(), new StringTable(), new Map()), /unencodable/);
});

test('10,000 random real pands round-trip exactly (geometry doubles, bags, key order)', async () => {
  const all = await rows();
  assert.ok(all.length > 10_000, `need >10k pands, have ${all.length}`);
  let seed = 130 >>> 0;
  const rand = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  const picked = new Set<number>(); while (picked.size < 10_000) picked.add(Math.floor(rand() * all.length));
  const sample = [...picked].sort((a, b) => a - b).map(i => all[i]);
  let checked = 0;
  for (const [key, list] of cellsOf(sample)) {
    const cell = cellFrom(key, list), { bytes } = encodeCell(cell), back = decodeCell(bytes, key);
    assert.equal(back.buildings.length, list.length);
    back.buildings.forEach((b, k) => {
      const src = list[k], raw = rawFeature(b), styled = styledFeature(b, raw);
      assert.ok(sameValue(raw.geometry, src.raw.geometry), `${b.id} geometry`);
      assert.ok(sameValue(raw.properties, src.raw.properties), `${b.id} attr`);
      assert.ok(sameValue(styled.properties, src.styled.properties), `${b.id} styled`);
      assert.equal(b.tile, src.tile); assert.equal(b.ordinal, src.ordinal);
      checked++;
    });
    assert.deepEqual(encodeCell(back).bytes, bytes, `${key}: re-encoding the decoded cell is byte-identical`);
  }
  assert.equal(checked, 10_000);
});

test('runtime cells (no ATTR) give back the styled bags, ids and geometry exactly, and are smaller', async () => {
  const all = await rows();
  let checked = 0, runtimeBytes = 0, debugBytes = 0;
  for (const [key, list] of cellsOf(all)) {
    const { bytes } = encodeCell(cellFrom(key, list, false)), back = decodeCell(bytes, key);
    assert.equal(back.debug, undefined);
    back.buildings.forEach((b, k) => {
      const src = list[k], raw = rawFeature(b), styled = styledFeature(b, raw);
      assert.equal(styled, raw, `${b.id}: a runtime cell's feature is its own styled copy`);
      assert.equal(b.id, String(src.raw.properties.id));
      assert.ok(sameValue(raw.geometry, src.raw.geometry), `${b.id} geometry`);
      assert.ok(sameValue(styled.properties, src.styled.properties), `${b.id} styled`);
      checked++;
    });
    assert.deepEqual(encodeCell(back).bytes, bytes, `${key}: runtime re-encode is byte-identical`);
    runtimeBytes += bytes.length; debugBytes += encodeCell(cellFrom(key, list)).bytes.length;
  }
  assert.ok(checked > 10_000);
  assert.ok(runtimeBytes < debugBytes, `runtime ${runtimeBytes} < debug ${debugBytes}`);
});

test('ids: numbered ids keep their leading zeros and length; others are strings; a bag id that is not the building id survives', () => {
  const ids = ['NL.IMBAG.Pand.0363100012164998', 'NL.IMBAG.Pand.0000000000000001', 'w268043846', 'w1', 'r7', 'plain', '', '0', '007', '1234567890123456789', 'NL.IMBAG.Pand.0363100012164997'];
  const g = (u: number) => u / 1e7, square = (x: number) => ({ type: 'Polygon' as const, coordinates: [[[g(48_000_000 + x * 1000), g(523_000_000)], [g(48_001_000 + x * 1000), g(523_000_000)], [g(48_001_000 + x * 1000), g(523_001_000)], [g(48_000_000 + x * 1000), g(523_000_000)]]] });
  for (const odd of [false, true]) for (const debug of [false, true]) {
    const cell: Cell = { i: 0, j: 0, hide: [], buildings: ids.map((id, k) => ({ id, tile: '8414/5384', ordinal: k, geometry: square(k), attr: { id: odd && k === 3 ? 'other' : id, height: k } })) };
    if (debug) cell.debug = true;
    const back = decodeCell(encodeCell(cell).bytes);
    assert.deepEqual(back.buildings.map(b => b.id), ids);
    back.buildings.forEach((b, k) => assert.ok(sameValue(b.attr, cell.buildings[k].attr), `${b.id} bag (odd=${odd}, debug=${debug})`));
  }
});

test('sentinel pands are pinned by id, cell and first vertex', async () => {
  const all = await rows(), cells = cellsOf(all);
  for (const s of SENTINELS) {
    const list = cells.get(s.cell); assert.ok(list, `${s.name}: cell ${s.cell} missing`);
    const back = decodeCell(encodeCell(cellFrom(s.cell, list!)).bytes);
    const b = back.buildings.find(x => x.id === s.id); assert.ok(b, `${s.name}: ${s.id} not in ${s.cell}`);
    assert.equal(b!.tile, s.tile, s.name);
    assert.equal(buildingCell(b!.geometry), s.cell, s.name);
    const rings = b!.geometry.type === 'Polygon' ? b!.geometry.coordinates : b!.geometry.coordinates[0];
    assert.deepEqual(rings[0][0], s.first, `${s.name}: first vertex`);
    if (s.holes) assert.equal(rings.length - 1, s.holes, `${s.name}: courtyard ring`);
    const [w, so, e, n] = cellBounds(...cellOf(s.first[0], s.first[1]));
    assert.ok(s.first[0] >= w && s.first[0] < e && s.first[1] >= so && s.first[1] < n);
  }
});

test('chunk arrays from decoded cells are identical to the default tile path at the sentinels', async () => {
  const all = await rows(), cells = cellsOf(all);
  for (const s of SENTINELS) {
    const list = cells.get(s.cell)!, back = decodeCell(encodeCell(cellFrom(s.cell, list)).bytes);
    // The sentinel's neighbourhood (150 m box), in the same order, from both paths.
    const near = (g: any) => { const [x, y] = (g.type === 'Polygon' ? g.coordinates : g.coordinates[0])[0][0]; return Math.abs(x - s.first[0]) < 0.0022 && Math.abs(y - s.first[1]) < 0.00135; };
    const fromTiles = list.filter(r => near(r.raw.geometry)).map(r => r.styled);
    const fromCell = back.buildings.filter(b => near(b.geometry)).map(b => styledFeature(b));
    assert.ok(fromTiles.length > 3, `${s.name}: ${fromTiles.length} buildings nearby`);
    for (const mode of ['walls', 'coarse', 'extras'] as const) {
      const a = buildFeatureChunk(fromTiles, 'photo', mode), b = buildFeatureChunk(fromCell, 'photo', mode);
      for (const k of ['positions', 'uvs', 'layers', 'tints', 'accents', 'indices'] as const) {
        assert.equal((a as any)[k].length, (b as any)[k].length, `${s.name} ${mode} ${k} length`);
        assert.ok(Buffer.from((a as any)[k].buffer, (a as any)[k].byteOffset, (a as any)[k].byteLength).equals(Buffer.from((b as any)[k].buffer, (b as any)[k].byteOffset, (b as any)[k].byteLength)), `${s.name} ${mode} ${k} bytes`);
      }
      assert.ok((a as any).positions.length > 0, `${s.name} ${mode}: empty chunk proves nothing`);
    }
  }
});

test('damaged input is rejected: truncation, magic, version, flags, tags, trailing bytes, varints', async () => {
  const all = await rows(), [key, list] = [...cellsOf(all.slice(0, 400))][0];
  const { bytes, streams } = encodeCell(cellFrom(key, list));
  assert.ok(decodeCell(bytes));
  for (let n = 0; n < bytes.length; n += Math.max(1, Math.floor(bytes.length / 997))) assert.throws(() => decodeCell(bytes.subarray(0, n)), /./, `prefix ${n}`);
  assert.throws(() => decodeCell(bytes.subarray(0, bytes.length - 1)));
  const mut = (at: number, v: number) => { const c = bytes.slice(); c[at] = v; return c; };
  assert.throws(() => decodeCell(mut(0, 'X'.charCodeAt(0))), /bad magic/);
  assert.throws(() => decodeCell(mut(4, WORLD_FORMAT_VERSION + 1)), /unsupported version/);
  assert.throws(() => decodeCell(mut(5, 2)), /unknown flags/);
  assert.throws(() => decodeCell(mut(5, 0)), /stream|expected/, 'a DEBUG cell read as a runtime cell');
  const trailing = new Uint8Array(bytes.length + 1); trailing.set(bytes); assert.throws(() => decodeCell(trailing), /trailing/);
  // A stream tag renamed in the table.
  const tagAt = bytes.indexOf('F'.charCodeAt(0), 6); assert.throws(() => decodeCell(mut(tagAt, 'G'.charCodeAt(0))), /stream/);
  // Each stream with one extra byte appended (and its length bumped) leaves trailing bytes in that stream.
  for (const s of streams) {
    const r = new Writer(); r.bytes(bytes.subarray(0, 6)); // magic, version, flags
    const head = new Reader(bytes); head.pos = 6; r.zvar(head.zvar()); r.zvar(head.zvar()); r.uvar(head.uvar());
    for (const t of streams) { r.bytes(new TextEncoder().encode(t.tag)); head.take(4); head.uvar(); r.uvar(t.bytes + (t === s ? 1 : 0)); }
    for (const t of streams) { r.bytes(bytes.subarray(t.offset, t.offset + t.bytes)); if (t === s) r.byte(0); }
    assert.throws(() => decodeCell(r.done()), new RegExp(`${s.tag.trim()}|trailing|bad|expected|index`), `stream ${s.tag} + 1 byte`);
  }
  const overlong = new Reader(new Uint8Array([0x80, 0x00])); assert.throws(() => overlong.uvar(), /overlong/);
  const long = new Reader(new Uint8Array(9).fill(0xff)); assert.throws(() => long.uvar(), /too long|overflow/);
});

test('a field a building does not carry costs no bytes (content-lane rule)', async () => {
  const all = await rows(), [key, list] = [...cellsOf(all.slice(0, 300))][0];
  const base = cellFrom(key, list), before = encodeCell(base).bytes;
  assert.deepEqual(encodeCell(cellFrom(key, list)).bytes, before, 'encoding is deterministic');
  const withField = cellFrom(key, list); const b = withField.buildings[0];
  b.styled = { ...(b.styled ?? b.attr), kitNewAttribute: 3 };
  const after = encodeCell(withField).bytes;
  assert.notDeepEqual(after, before);
  delete b.styled.kitNewAttribute;
  assert.deepEqual(encodeCell(withField).bytes, before, 'removing the field restores the exact bytes');
});

// --- v3 (P2 bytes gate): the same decoded cells as v2, from the published world-v1 cells -----------------
// The published cells carry what the synthetic cells above do not: party-wall neighbours (local and in other
// cells), coarse groups, hidden ids. Whatever version they are published in, v2 and v3 must decode alike.
const PUBLISHED = path.resolve('public/data/extracts/amsterdam/world-v1/cells');
const published = (key: string): Cell => decodeCell(zlib.gunzipSync(fs.readFileSync(path.join(PUBLISHED, `${key}.bin`))), key);
const keepOnly = (cell: Cell, keep: Set<number>): Cell => {
  // A sub-cell of the picked buildings; neighbours re-indexed, a dropped local neighbour kept as its id.
  const order = [...keep].sort((a, b) => a - b), at = new Map(order.map((k, n) => [k, n]));
  const buildings = order.map(k => { const b = cell.buildings[k]; return { ...b, neighbours: b.neighbours?.map(n => typeof n === 'number' ? (at.get(n) ?? cell.buildings[n].id) : n) }; });
  return { ...cell, buildings };
};
const sameCell = (a: Cell, b: Cell, what: string) => {
  assert.equal(a.buildings.length, b.buildings.length, `${what}: buildings`);
  a.buildings.forEach((x, k) => assert.ok(sameValue(x, b.buildings[k]), `${what}: ${x.id}`));
  assert.ok(sameValue(a.hide, b.hide), `${what}: hide`);
  assert.ok(sameValue(a, b), `${what}: cell`);
};

test('v3: 10,000 random published pands decode exactly as v2 (neighbours, groups, hidden ids), and v3 is smaller', () => {
  const keys = fs.readdirSync(PUBLISHED).filter(f => f.endsWith('.bin')).map(f => f.slice(0, -4)).sort();
  const cells = keys.map(published), total = cells.reduce((s, c) => s + c.buildings.length, 0);
  let seed = 3130 >>> 0;
  const rand = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  const picked = new Map<number, Set<number>>(); let n = 0;
  while (n < 10_000) { let g = Math.floor(rand() * total), c = 0; while (g >= cells[c].buildings.length) g -= cells[c++].buildings.length; const s = picked.get(c) ?? new Set(); if (!s.has(g)) { s.add(g); n++; } picked.set(c, s); }
  let v2 = 0, v3 = 0, checked = 0;
  for (const [c, keep] of picked) {
    const cell = keepOnly(cells[c], keep), a = encodeCell(cell, 2).bytes, b = encodeCell(cell, 3).bytes;
    const fromV2 = decodeCell(a, keys[c]), fromV3 = decodeCell(b, keys[c]);
    sameCell(fromV3, fromV2, keys[c]); sameCell(fromV3, cell, keys[c]);
    assert.equal(a[4], 2); assert.equal(b[4], 3);
    assert.deepEqual(encodeCell(fromV3, 3).bytes, b, `${keys[c]}: v3 re-encode is byte-identical`);
    v2 += zlib.gzipSync(a).length; v3 += zlib.gzipSync(b).length; checked += keep.size;
  }
  assert.equal(checked, 10_000);
  assert.ok(v3 < v2, `v3 ${v3} B gzip < v2 ${v2} B`);
});

test('v3: whole published sentinel cells decode exactly as v2; sentinels pinned with their party walls', () => {
  for (const key of [...new Set(SENTINELS.map(s => s.cell))]) {
    const cell = published(key), v3 = decodeCell(encodeCell(cell, 3).bytes, key);
    sameCell(v3, decodeCell(encodeCell(cell, 2).bytes, key), key);
    for (const s of SENTINELS.filter(x => x.cell === key)) {
      const b = v3.buildings.find(x => x.id === s.id); assert.ok(b, `${s.name}: ${s.id} not in published ${key}`);
      const rings = b!.geometry.type === 'Polygon' ? b!.geometry.coordinates : b!.geometry.coordinates[0];
      assert.deepEqual(rings[0][0], s.first, `${s.name}: first vertex`);
      if (s.holes) assert.equal(rings.length - 1, s.holes, `${s.name}: courtyard ring`);
      assert.ok(sameValue(b!.neighbours, cell.buildings.find(x => x.id === s.id)!.neighbours), `${s.name}: party walls`);
    }
  }
  const westerkerk = published('-2_0').buildings.find(b => b.id === SENTINELS[0].id)!;
  assert.ok((westerkerk.neighbours ?? []).length > 0, 'Westerkerk has party-wall neighbours to pin');
});

test('v3: asymmetric, unsorted, self and cross-cell neighbours, odd coordinates and columns survive', () => {
  const sq = (x: number, fine: boolean) => { const o = fine ? 3 : 0; const g = (u: number) => u / 1e7; return { type: 'Polygon' as const, coordinates: [[[g(48_000_000 + x * 1000 + o), g(523_000_000)], [g(48_001_000 + x * 1000), g(523_000_000)], [g(48_001_000 + x * 1000), g(523_001_000 - o)], [g(48_000_000 + x * 1000 + o), g(523_000_000)]], [], [[g(48_000_500 + x * 1000), g(523_000_500)]]] }; };
  const neighbours = [[1, 2], [0], [5, 0, 'NL.IMBAG.Pand.0363100012000001'], [3], ['w1', 4], [2], [], [0, 1, 2]];
  const cell: Cell = { i: -3, j: 4, buildings: neighbours.map((ns, k) => ({ id: `NL.IMBAG.Pand.03631000120000${10 + k}`, tile: k === 6 ? '8413/5384' : '8414/5384', ordinal: [5, 6, 2, 0, 9, 10, 0, 7][k], geometry: sq(k, k % 2 === 1),
    attr: { colour: ['#a1b2c3', '#000000', '#ffffff', '#123456', '#abcdef', '#fedcba', '#0a0b0c', '#A1B2C3'][k], year: 1600 + k * 37, h: [3.5, 7.25, 1e-7, -2, 12.832327708732336, 0.1, 5, 6][k], flat: k % 3 === 0, mixed: k % 2 ? 'x' : 1, ...(k === 4 ? { only: [1, { a: null }] } : {}) },
    group: k === 7 ? undefined : k === 5 ? '8413/5384' : k === 6 ? '8413/5384' : '8414/5384', neighbours: k === 7 ? undefined : ns as (number | string)[] })), hide: [{ id: 'w1', reasons: 3, models: ['m'] }] };
  delete cell.buildings[7].neighbours; delete cell.buildings[7].group; // ungrouped: neither key, as the decoder gives back
  const back = decodeCell(encodeCell(cell, 3).bytes);
  sameCell(back, decodeCell(encodeCell(cell, 2).bytes), 'synthetic');
  sameCell(back, cell, 'synthetic');
});

test('v3: every single-byte change is rejected or decodes without crashing; v2 still decodes; index accepts both', () => {
  const cell = published('8_-2'), small = keepOnly(cell, new Set(cell.buildings.slice(0, 60).map((_, k) => k)));
  const bytes = encodeCell(small, 3).bytes;
  for (let at = 0; at < bytes.length; at++) for (const v of [0, 1, 0x7f, 0x80, 0xff]) {
    if (bytes[at] === v) continue;
    const c = bytes.slice(); c[at] = v;
    try { decodeCell(c); } catch (e) { assert.ok(e instanceof Error && /^world cell/.test(e.message), `byte ${at}=${v}: ${String(e)}`); }
  }
  assert.ok(decodeCell(encodeCell(small, 2).bytes));
  assert.throws(() => encodeCell(small, 1), /cannot encode/);
  for (const format of [2, 3]) assert.ok(readWorldIndex({ version: 1, format, tileCells: {}, cells: {} }), `index format ${format}`);
  assert.equal(readWorldIndex({ version: 1, format: 4, tileCells: {}, cells: {} }), null);
});
