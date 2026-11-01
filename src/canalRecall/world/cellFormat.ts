/**
 * `world-v1` cell format: one file per 1 km own-ground cell (`i_j`, the elevation-v1 / roads-v1 grid),
 * carrying the buildings of that cell already enriched and decorated at build time, so the runtime
 * reads them instead of parsing GeoJSON tiles and re-running the decorator chain on the main thread.
 *
 * RULE FOR CONTENT LANES. A new kit or building attribute is a STYL field: it rides in the decorated
 * property bag, so it needs (1) the compiler run (`npm run world:compile -- --changed`), (2) a
 * `WORLD_FORMAT_VERSION` bump when the encoding of a stream changes, and (3) a decoder test in
 * `cellFormat.test.ts`. Output must be byte-identical when the field is absent: the encoder writes
 * nothing for a key a building does not carry, and `cellFormat.test.ts` pins that.
 *
 * Layout (all integers LEB128 varints unless noted; signed values zigzag):
 *   "WRLD" u8 version u8 flags  zz(i) zz(j)  streamCount  { tag[4] byteLength }*  payload*
 * The payloads follow the table in order and must use every remaining byte (trailing bytes throw).
 * Flags (v2): bit 0 = DEBUG, the cell carries ATTR. A runtime cell (the default) has no ATTR: its STYL
 * holds the full styled bag of every building, which is all the runtime reads, and the enriched source
 * bags (what the decorators started from) are written only by `world:compile -- --debug`, for
 * diagnosis. v2 dropped ATTR from the runtime read path (lane L4, 2026-10-30): the fetched bytes went
 * from FOOT + STRS + ATTR + STYL(delta) + GRP + HIDE to FOOT + STRS + STYL(full) + GRP + HIDE.
 * Streams (ATTR only in a DEBUG cell):
 *   STRS  string table: count { len utf8 }*; every other stream refers to strings by index.
 *   FOOT  footprints: tiles (source z14 tile list), per building id (v2: prefix string + digit count +
 *         zigzag delta of the number, e.g. "NL.IMBAG.Pand.0" + 15 digits; else a string index), source tile + ordinal,
 *         geometry kind and ring structure; then the X block and Y block of coordinates as zigzag
 *         deltas running across ring and building boundaries, in units of 1e-7 degree. The source
 *         tiles carry at most 7 decimals, and integer/1e7 is correctly rounded, so this grid is
 *         exact: decoded coordinates are the same doubles JSON.parse gave the default path.
 *   ATTR  per building, the enriched source property bag (tile properties + building-facts year +
 *         roof facts): what the streamer adopts before decorating.
 *   STYL  runtime cell: the styled bags (columnar, as ATTR). DEBUG cell: per building, how the default
 *         decorator chain changed the ATTR bag: 0 = unchanged, 1 = delta (set keys in order, then
 *         removed keys), 2 = full bag (key order changed).
 *   ROOF  per building, `roofPlanForFeature(decorated)` (a RoofPlan or null) as a generic value.
 *   GRP   per building, the coarse group (index into FOOT's tile list, by first vertex, as
 *         `setFeatures` keys it) and party-wall neighbours from `BuildingContextIndex`
 *         (local index + 1, or 0 + string index for a neighbour in another cell).
 *   HIDE  ids standing in this cell that installed models hide: id, reason bits, model names.
 * Bags (ATTR, runtime STYL) are columnar; an `id` column that equals the buildings' ids is not written (v2), which
 * took the 350 k id strings out of STRS.
 * Generic values (ATTR/STYL/ROOF): tag byte, then undefined | null | false | true | int (zz) |
 * decimal (u8 places 1..7, zz mantissa; only when mantissa / 10^places reproduces the double) |
 * float64 LE | string (index) | array (n values) | object (n {key index, value}).
 * Decoders are strict: magic, version, flags, stream table, count bounds, varint length, string
 * indices, tags and leftover bytes all throw.
 */

export const WORLD_FORMAT_VERSION = 5;
// v5 (2026-10-31, #130 census): v4 plus an integer-list bag column (C_INTS: roofFurniture, 363 KB of near-unique
// strings in STRS) and a run symbol in FOOT refs (a party wall shares vertex runs: continue the last reference).
// v4 (2026-10-31): v3 plus an optional shared string table (FLAG_GLOBAL, strings.bin), fetched once per page.
// v3 (P2 bytes gate, 2026-10-31): the same decoded cell as v2, laid out for gzip: FOOT in columns with
// per-building 1e-6 units, vertex back-references and per-tile ordinal deltas; typed bag columns (no
// per-value tag, column dictionaries, numeric deltas, packed colours and booleans); GRP with symmetric
// party walls written once. City total 13.46 MB -> 10.37 MB gzip; see the "v3 streams" section.
/** Versions `decodeCell` reads: v2 cells (published before the v3 bytes gate) stay readable until world-v1 is recompiled. */
export const WORLD_FORMAT_VERSIONS: readonly number[] = [2, 3, 4, 5];
/** Flag bit: the cell carries ATTR (a `--debug` compile). */
export const FLAG_DEBUG = 1;
/** Flag bit (v4): the cell's string indices start with the shared table (strings.bin). */
export const FLAG_GLOBAL = 2;
export const WORLD_MAGIC = 'WRLD';
/** Units per degree of FOOT coordinates (exact for sources with <= 7 decimals). */
export const COORD_SCALE = 1e7;
/** A 1 km cell holds at most a few thousand buildings (max 2,453 in elevation-v1); this bounds hostile counts. */
export const MAX_BUILDINGS = 200_000;
const MAX_COUNT = 10_000_000;
const MAX_VARINT_BYTES = 8; // 2^56 > Number.MAX_SAFE_INTEGER
export const STREAM_TAGS = ['STRS', 'FOOT', 'ATTR', 'STYL', 'ROOF', 'GRP ', 'HIDE'] as const;
export type StreamTag = typeof STREAM_TAGS[number];

export type Geometry = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
export type Props = Record<string, unknown>;
export type HideEntry = { id: string; reasons: number; models: string[] };
export const HIDE_KIT = 1, HIDE_COVER_PAND = 2, HIDE_COVER_OSM = 4;
export type Neighbour = number | string; // local index in this cell, or an id in another cell

export type CellBuilding = {
  id: string;
  /** Source z14 tile `x/y` and position in that tile after dropNestedDuplicates (the default path's order). */
  tile: string; ordinal: number;
  geometry: Geometry;
  /** The enriched source bag. Decoded from a runtime cell (no ATTR) this is the styled bag itself and
   *  `styled` is undefined, so `rawFeature` and `styledFeature` give the same object. */
  attr: Props;
  /** The decorated bag; undefined means the chain returned the bag unchanged. */
  styled?: Props;
  roof?: unknown;
  /** Coarse group tile (`x/y`) and party-wall neighbours. */
  group?: string; neighbours?: Neighbour[];
};
/** `debug`: decoded from (or to be encoded as) a DEBUG cell, so `attr` is the enriched source bag. */
export type Cell = { i: number; j: number; buildings: CellBuilding[]; hide: HideEntry[]; debug?: boolean };

// --- bytes -----------------------------------------------------------------

export class Writer {
  private buf = new Uint8Array(1024); length = 0;
  private ensure(n: number) { if (this.length + n <= this.buf.length) return; let size = this.buf.length * 2; while (size < this.length + n) size *= 2; const next = new Uint8Array(size); next.set(this.buf.subarray(0, this.length)); this.buf = next; }
  byte(v: number) { this.ensure(1); this.buf[this.length++] = v & 255; }
  bytes(b: Uint8Array) { this.ensure(b.length); this.buf.set(b, this.length); this.length += b.length; }
  uvar(v: number) {
    if (!Number.isSafeInteger(v) || v < 0) throw Error(`uvar out of range: ${v}`);
    this.ensure(MAX_VARINT_BYTES);
    while (v >= 128) { this.buf[this.length++] = (v % 128) | 128; v = Math.floor(v / 128); }
    this.buf[this.length++] = v;
  }
  zvar(v: number) { if (!Number.isSafeInteger(v) || Math.abs(v) >= 2 ** 52) throw Error(`zvar out of range: ${v}`); this.uvar(v >= 0 ? v * 2 : -v * 2 - 1); }
  f64(v: number) { this.ensure(8); new DataView(this.buf.buffer, this.buf.byteOffset + this.length, 8).setFloat64(0, v, true); this.length += 8; }
  done(): Uint8Array { return this.buf.slice(0, this.length); }
}

export class Reader {
  pos = 0;
  constructor(readonly buf: Uint8Array, readonly what = 'world cell') {}
  fail(message: string): never { throw Error(`${this.what}: ${message} at byte ${this.pos}`); }
  byte(): number { if (this.pos >= this.buf.length) this.fail('truncated'); return this.buf[this.pos++]; }
  take(n: number): Uint8Array { if (n < 0 || this.pos + n > this.buf.length) this.fail('truncated'); const out = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return out; }
  uvar(): number {
    let v = 0, mul = 1;
    for (let i = 0; i < MAX_VARINT_BYTES; i++) {
      const b = this.byte();
      v += (b & 127) * mul;
      if (b < 128) { if (i > 0 && b === 0) this.fail('overlong varint'); if (!Number.isSafeInteger(v)) this.fail('varint overflow'); return v; }
      mul *= 128;
    }
    return this.fail('varint too long');
  }
  zvar(): number { const u = this.uvar(); return u % 2 === 0 ? u / 2 : -(u + 1) / 2; }
  count(max = MAX_COUNT, what = 'count'): number { const n = this.uvar(); if (n > max) this.fail(`${what} ${n} exceeds ${max}`); return n; }
  f64(): number { const b = this.take(8); return new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, true); }
  end() { if (this.pos !== this.buf.length) this.fail(`${this.buf.length - this.pos} trailing bytes`); }
}

// --- strings ---------------------------------------------------------------

/** A cell's strings. With `globals` (v4), a string in the shared table is its global index, any other string
 *  global count + its index in `list` (the cell's own STRS). */
export class StringTable {
  readonly list: string[] = []; private readonly index = new Map<string, number>();
  constructor(readonly globals?: GlobalStrings) {}
  ref(s: string): number {
    const g = this.globals?.index.get(s); if (g !== undefined) return g;
    let i = this.index.get(s); if (i === undefined) { i = this.list.length; this.list.push(s); this.index.set(s, i); }
    return i + (this.globals?.list.length ?? 0);
  }
  at(k: number): string { const n = this.globals?.list.length ?? 0; return k < n ? this.globals!.list[k] : this.list[k - n]; }
}

// --- shared string table (v4) ----------------------------------------------
// world-v1/strings.bin: the strings many cells use (bag keys, palette values, style sources, tile-independent
// ids), fetched once per page instead of once per cell. Layout (gzip): "WSTR" u8 version count { len utf8 }*.
// A v4 cell that uses it carries FLAG_GLOBAL and, after i/j, the table's count and FNV-1a 32 hash: a cell is
// never decoded against a different table.
export const GLOBAL_MAGIC = 'WSTR';
export const GLOBAL_STRINGS_FILE = 'strings.bin';
export type GlobalStrings = { list: readonly string[]; index: Map<string, number>; hash: number };
const fnv1a = (b: Uint8Array): number => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
export function encodeGlobalStrings(list: readonly string[]): { bytes: Uint8Array; table: GlobalStrings } {
  const w = new Writer(); w.bytes(encoder.encode(GLOBAL_MAGIC)); w.byte(1); w.uvar(list.length);
  const index = new Map<string, number>();
  list.forEach((s, i) => { if (index.has(s)) throw Error(`duplicate global string ${JSON.stringify(s)}`); index.set(s, i); const b = encoder.encode(s); w.uvar(b.length); w.bytes(b); });
  const bytes = w.done();
  return { bytes, table: { list, index, hash: fnv1a(bytes) } };
}
export function decodeGlobalStrings(bytes: Uint8Array, what = 'world strings'): GlobalStrings {
  const r = new Reader(bytes, what);
  if (String.fromCharCode(...r.take(4)) !== GLOBAL_MAGIC) r.fail('bad magic');
  const v = r.byte(); if (v !== 1) r.fail(`unsupported version ${v}`);
  const list = readStrings(r), index = new Map<string, number>();
  list.forEach((s, i) => { if (index.has(s)) r.fail(`duplicate string ${JSON.stringify(s)}`); index.set(s, i); });
  return { list, index, hash: fnv1a(bytes) };
}
/** The shared table a cell needs (count + hash), or null: lets a reader fetch strings.bin only when needed. */
export function cellGlobalRef(bytes: Uint8Array): { count: number; hash: number } | null {
  const r = new Reader(bytes, 'world cell header');
  if (String.fromCharCode(...r.take(4)) !== WORLD_MAGIC) r.fail('bad magic');
  const version = r.byte(), flags = r.byte();
  if (version < 4 || !(flags & FLAG_GLOBAL)) return null;
  r.zvar(); r.zvar();
  const count = r.uvar(), b = r.take(4);
  return { count, hash: (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0 };
}
/** Strings used by at least `minCells` of the cells, most used first (ties by string): the shared table. */
export function chooseGlobalStrings(cellLists: Iterable<readonly string[]>, minCells = 2): string[] {
  const cells = new Map<string, number>();
  for (const list of cellLists) for (const s of new Set(list)) cells.set(s, (cells.get(s) ?? 0) + 1);
  return [...cells].filter(([, n]) => n >= minCells).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([s]) => s);
}
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
function writeStrings(table: StringTable): Uint8Array {
  const w = new Writer(); w.uvar(table.list.length);
  for (const s of table.list) { const b = encoder.encode(s); w.uvar(b.length); w.bytes(b); }
  return w.done();
}
function readStrings(r: Reader): string[] {
  const n = r.count(MAX_COUNT, 'strings'), out: string[] = new Array(n);
  for (let i = 0; i < n; i++) { const len = r.count(r.buf.length, 'string length'); try { out[i] = decoder.decode(r.take(len)); } catch (e) { if (e instanceof Error && e.message.startsWith(r.what)) throw e; r.fail('bad utf-8'); } }
  r.end();
  return out;
}
const str = (r: Reader, strings: readonly string[]): string => { const i = r.uvar(); if (i >= strings.length) r.fail(`string index ${i} >= ${strings.length}`); return strings[i]; };

// --- generic values --------------------------------------------------------

const T_UNDEF = 0, T_NULL = 1, T_FALSE = 2, T_TRUE = 3, T_INT = 4, T_DEC = 5, T_F64 = 6, T_STR = 7, T_ARR = 8, T_OBJ = 9;
const POW10 = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7];
const MAX_DEPTH = 32;

export function writeValue(w: Writer, s: StringTable, v: unknown, depth = 0): void {
  if (depth > MAX_DEPTH) throw Error('value nested too deep');
  if (v === undefined) return w.byte(T_UNDEF);
  if (v === null) return w.byte(T_NULL);
  if (v === false) return w.byte(T_FALSE);
  if (v === true) return w.byte(T_TRUE);
  if (typeof v === 'number') {
    if (Number.isSafeInteger(v) && !Object.is(v, -0) && Math.abs(v) < 2 ** 52) { w.byte(T_INT); w.zvar(v); return; }
    if (Number.isFinite(v) && !Object.is(v, -0)) for (let k = 1; k < POW10.length; k++) {
      const m = Math.round(v * POW10[k]);
      if (Math.abs(m) < 2 ** 52 && m / POW10[k] === v) { w.byte(T_DEC); w.byte(k); w.zvar(m); return; }
    }
    w.byte(T_F64); w.f64(v); return;
  }
  if (typeof v === 'string') { w.byte(T_STR); w.uvar(s.ref(v)); return; }
  if (Array.isArray(v)) { w.byte(T_ARR); w.uvar(v.length); for (const x of v) writeValue(w, s, x, depth + 1); return; }
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const keys = Object.keys(v as object);
    w.byte(T_OBJ); w.uvar(keys.length);
    for (const k of keys) { w.uvar(s.ref(k)); writeValue(w, s, (v as Record<string, unknown>)[k], depth + 1); }
    return;
  }
  throw Error(`unencodable value of type ${typeof v}`);
}

export function readValue(r: Reader, strings: readonly string[], depth = 0): unknown {
  if (depth > MAX_DEPTH) r.fail('value nested too deep');
  const tag = r.byte();
  switch (tag) {
    case T_UNDEF: return undefined;
    case T_NULL: return null;
    case T_FALSE: return false;
    case T_TRUE: return true;
    case T_INT: return r.zvar();
    case T_DEC: { const k = r.byte(); if (k < 1 || k >= POW10.length) r.fail(`decimal places ${k}`); return r.zvar() / POW10[k]; }
    case T_F64: return r.f64();
    case T_STR: return str(r, strings);
    case T_ARR: { const n = r.count(r.buf.length - r.pos, 'array length'), out = new Array(n); for (let i = 0; i < n; i++) out[i] = readValue(r, strings, depth + 1); return out; }
    case T_OBJ: return readBag(r, strings, depth);
    default: return r.fail(`bad value tag ${tag}`);
  }
}
function readBag(r: Reader, strings: readonly string[], depth = 0): Props {
  const n = r.count(r.buf.length - r.pos, 'object size'), out: Props = {};
  for (let i = 0; i < n; i++) { const k = str(r, strings); if (Object.prototype.hasOwnProperty.call(out, k)) r.fail(`duplicate key ${k}`); out[k] = readValue(r, strings, depth + 1); }
  return out;
}

// --- columnar bags -------------------------------------------------------
// A cell's bags share a few key orders ("shapes"); each bag stores its shape index, then every key's
// values follow as one column (bags in order). Neighbouring values of one key compress far better than
// row-wise bags, and key order is reproduced exactly.

/** `ids` (the buildings' ids, row for row): when every bag's `id` is its building's id, the `id` column is
 *  written as one key reference instead of 350 k repeated strings (a third of the styled bytes before v2). */
function writeBags(w: Writer, s: StringTable, bags: readonly Props[], ids: readonly string[] | undefined, ver: number): void {
  const v3 = ver >= 3, v4 = ver >= 4;
  const shapes: number[][] = [], shapeIndex = new Map<string, number>(), rows: number[] = [];
  const columns = new Map<number, unknown[]>();
  const selfId = !!ids && bags.some(b => Object.prototype.hasOwnProperty.call(b, 'id')) && bags.every((b, i) => !Object.prototype.hasOwnProperty.call(b, 'id') || b.id === ids[i]);
  const selfKey = selfId ? s.ref('id') : -1;
  for (const bag of bags) {
    const keys = Object.keys(bag).map(k => s.ref(k)), sig = keys.join(',');
    let si = shapeIndex.get(sig);
    if (si === undefined) { si = shapes.length; shapes.push(keys); shapeIndex.set(sig, si); }
    rows.push(si);
    for (const k of keys) { if (k === selfKey) continue; let c = columns.get(k); if (!c) columns.set(k, c = []); c.push(bag[s.at(k)]); }
  }
  w.uvar(shapes.length);
  for (const keys of shapes) { w.uvar(keys.length); for (const k of keys) w.uvar(k); }
  w.uvar(rows.length); for (const si of rows) w.uvar(si);
  if (ids) w.uvar(selfKey + 1);
  // Columns in ascending key index so the decoder knows the order without a table.
  const order = [...columns.keys()].sort((a, b) => a - b), same = v4 ? sameColumns(bags, s, order, selfKey) : new Map<number, number>();
  for (const k of order) {
    const col = columns.get(k)!, ref = same.get(k);
    if (ref !== undefined) {
      // C_SAME: per row, whether the value equals the row's `ref` value; then the other values as a column.
      const refName = s.at(ref), name = s.at(k), flags: boolean[] = [], rest: unknown[] = [];
      for (const bag of bags) if (Object.prototype.hasOwnProperty.call(bag, name)) { const eq = isPrimitive(bag[name]) && Object.prototype.hasOwnProperty.call(bag, refName) && Object.is(bag[name], bag[refName]); flags.push(eq); if (!eq) rest.push(bag[name]); }
      w.byte(C_SAME); w.uvar(ref); writeBits(w, flags);
      if (rest.length) writeColumn(w, s, rest, ver);
      continue;
    }
    if (v3) writeColumn(w, s, col, ver); else for (const v of col) writeValue(w, s, v, 1);
  }
}

const isPrimitive = (v: unknown): boolean => typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && !Number.isNaN(v));
/** v4: columns that mostly repeat another key of the same row (groundColour = sideColour in 99.8% of the city),
 *  each with the key it repeats. A reference is never itself a C_SAME column, and never the implied id. */
function sameColumns(bags: readonly Props[], s: StringTable, order: readonly number[], selfKey: number): Map<number, number> {
  const names = order.map(k => s.at(k)), has = Object.prototype.hasOwnProperty, out = new Map<number, number>();
  const rowsOf = new Map<string, number>();
  for (const bag of bags) for (const k of names) if (has.call(bag, k)) rowsOf.set(k, (rowsOf.get(k) ?? 0) + 1);
  const best = new Map<number, [number, number]>();
  for (let a = 0; a < order.length; a++) {
    const n = rowsOf.get(names[a]) ?? 0; if (n < 8) continue;
    for (let b = 0; b < order.length; b++) {
      if (a === b || order[b] === selfKey) continue;
      let eq = 0;
      for (const bag of bags) if (has.call(bag, names[a]) && has.call(bag, names[b]) && isPrimitive(bag[names[a]]) && Object.is(bag[names[a]], bag[names[b]])) eq++;
      if (eq * 2 >= n && eq > (best.get(order[a])?.[1] ?? 0)) best.set(order[a], [order[b], eq]);
    }
  }
  for (const k of order) { const hit = best.get(k); if (hit && !out.has(hit[0])) out.set(k, hit[0]); }
  for (const [k, ref] of [...out]) if (out.has(ref)) out.delete(k);
  return out;
}
function writeBits(w: Writer, bits: readonly boolean[]): void { for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let k = 0; k < 8 && i + k < bits.length; k++) if (bits[i + k]) b |= 1 << k; w.byte(b); } }
function readBits(r: Reader, n: number): boolean[] { const out = new Array<boolean>(n); for (let i = 0; i < n; i += 8) { const b = r.byte(), m = Math.min(8, n - i); if (b >> m) r.fail('bit padding'); for (let k = 0; k < m; k++) out[i + k] = ((b >> k) & 1) === 1; } return out; }

function readBags(r: Reader, strings: readonly string[], expected: number, ids: readonly string[] | undefined, ver: number): Props[] {
  const v3 = ver >= 3, v4 = ver >= 4;
  const shapeCount = r.count(expected + 1, 'shapes'), shapes: number[][] = [];
  for (let i = 0; i < shapeCount; i++) {
    const n = r.count(4096, 'shape size'), keys: number[] = [], seen = new Set<number>();
    for (let k = 0; k < n; k++) { const key = r.uvar(); if (key >= strings.length) r.fail(`key index ${key}`); if (seen.has(key)) r.fail(`duplicate key ${strings[key]}`); seen.add(key); keys.push(key); }
    shapes.push(keys);
  }
  const n = r.count(MAX_BUILDINGS, 'bags'); if (n !== expected) r.fail(`expected ${expected} bags, got ${n}`);
  const rows = new Array<number>(n), counts = new Uint32Array(strings.length);
  for (let i = 0; i < n; i++) { const si = r.uvar(); if (si >= shapes.length) r.fail(`shape index ${si}`); rows[i] = si; for (const k of shapes[si]) counts[k]++; }
  const selfKey = ids ? r.uvar() - 1 : -1;
  if (selfKey >= strings.length || (selfKey >= 0 && strings[selfKey] !== 'id')) r.fail(`self id key ${selfKey}`);
  if (selfKey >= 0) counts[selfKey] = 0;
  const columns: unknown[][] = new Array(strings.length);
  const same = new Map<number, { ref: number; flags: boolean[]; rest: unknown[] }>();
  for (let k = 0; k < strings.length; k++) {
    const c = counts[k]; if (!c) continue;
    if (v4 && r.buf[r.pos] === C_SAME) {
      r.byte(); const ref = r.uvar();
      if (ref >= strings.length || ref === k || ref === selfKey) r.fail(`same-as key ${ref}`);
      const flags = readBits(r, c), m = flags.reduce((x, f) => x + (f ? 0 : 1), 0);
      same.set(k, { ref, flags, rest: m ? readColumn(r, strings, m, ver) : [] });
      continue;
    }
    if (v3) { columns[k] = readColumn(r, strings, c, ver); continue; }
    const col = new Array(c); for (let i = 0; i < c; i++) col[i] = readValue(r, strings, 1); columns[k] = col;
  }
  for (const { ref } of same.values()) if (same.has(ref) || !counts[ref] && ref !== selfKey) r.fail(`same-as key ${ref} is not a plain column`);
  const cursor = new Uint32Array(strings.length), restAt = new Uint32Array(strings.length), out = new Array<Props>(n);
  for (let i = 0; i < n; i++) {
    const bag: Props = {}, keys = shapes[rows[i]];
    let patch = false;
    for (const k of keys) {
      if (k === selfKey) { bag[strings[k]] = ids![i]; continue; }
      const sm = same.get(k);
      if (!sm) { bag[strings[k]] = columns[k][cursor[k]++]; continue; }
      if (sm.flags[cursor[k]++]) { bag[strings[k]] = undefined; patch = true; } else bag[strings[k]] = sm.rest[restAt[k]++];
    }
    if (patch) for (const k of keys) {
      const sm = same.get(k); if (!sm || !sm.flags[cursor[k] - 1]) continue;
      if (!keys.includes(sm.ref)) r.fail(`same-as ${strings[sm.ref]} missing from the row`);
      const v = bag[strings[sm.ref]]; if (!isPrimitive(v)) r.fail('same-as a non-primitive value');
      bag[strings[k]] = v;
    }
    out[i] = bag;
  }
  return out;
}

/** Same keys, same order, same values (NaN equal, -0 distinct), recursively: what the encoder must reproduce. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameValue((a as Props)[k], (b as Props)[k]));
  }
  return false;
}

// --- STYL ------------------------------------------------------------------

const S_SAME = 0, S_DELTA = 1, S_FULL = 2;
/** Apply a delta: base keys in order (minus removed, set values replacing), then new set keys in order.
 *  Built by plain assignment in final order (no spread + delete, which leaves slow dictionary objects). */
function applyDelta(base: Props, set: Props, removed: readonly string[]): Props {
  const out: Props = {}, has = Object.prototype.hasOwnProperty;
  for (const k in base) { if (removed.length && removed.includes(k)) continue; out[k] = has.call(set, k) ? set[k] : base[k]; }
  for (const k in set) if (!has.call(base, k)) out[k] = set[k];
  return out;
}
type Style = { mode: number; set?: Props; removed?: string[]; full?: Props };
function styleOf(attr: Props, styled: Props | undefined): Style {
  if (!styled || styled === attr || sameValue(attr, styled)) return { mode: S_SAME };
  const set: Props = {}, removed: string[] = [];
  for (const k of Object.keys(styled)) if (!Object.prototype.hasOwnProperty.call(attr, k) || !sameValue(attr[k], styled[k])) set[k] = styled[k];
  for (const k of Object.keys(attr)) if (!Object.prototype.hasOwnProperty.call(styled, k)) removed.push(k);
  return sameValue(applyDelta(attr, set, removed), styled) ? { mode: S_DELTA, set, removed } : { mode: S_FULL, full: styled };
}
function writeStyles(w: Writer, s: StringTable, attrs: readonly Props[], styled: readonly (Props | undefined)[], ver: number): void {
  const styles = attrs.map((a, i) => styleOf(a, styled[i]));
  for (const st of styles) w.byte(st.mode);
  const deltas = styles.filter(st => st.mode === S_DELTA), fulls = styles.filter(st => st.mode === S_FULL);
  writeBags(w, s, deltas.map(st => st.set!), undefined, ver);
  for (const st of deltas) { w.uvar(st.removed!.length); for (const k of st.removed!) w.uvar(s.ref(k)); }
  writeBags(w, s, fulls.map(st => st.full!), undefined, ver);
}
function readStyles(r: Reader, strings: readonly string[], attrs: readonly Props[], ver: number): (Props | undefined)[] {
  const modes: number[] = [];
  for (let i = 0; i < attrs.length; i++) { const m = r.byte(); if (m > S_FULL) r.fail(`bad style mode ${m}`); modes.push(m); }
  const deltaCount = modes.filter(m => m === S_DELTA).length, fullCount = modes.filter(m => m === S_FULL).length;
  const sets = readBags(r, strings, deltaCount, undefined, ver), removed: string[][] = [];
  for (let i = 0; i < deltaCount; i++) { const n = r.count(4096, 'removed keys'), list: string[] = []; for (let k = 0; k < n; k++) list.push(str(r, strings)); removed.push(list); }
  const fulls = readBags(r, strings, fullCount, undefined, ver);
  let d = 0, f = 0;
  return modes.map((m, i) => m === S_SAME ? undefined : m === S_DELTA ? (d++, applyDelta(attrs[i], sets[d - 1], removed[d - 1])) : fulls[f++]);
}

// --- FOOT ------------------------------------------------------------------

const G_POLYGON = 0, G_MULTI = 1;
const polygonsOf = (g: Geometry): number[][][][] => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
const toUnits = (v: number, what: string): number => {
  const u = Math.round(v * COORD_SCALE);
  if (u / COORD_SCALE !== v) throw Error(`${what}: coordinate ${v} is not on the 1e-7 degree grid`);
  return u;
};

// Ids: "NL.IMBAG.Pand.0363100012164998", "w268043846". A prefix (string index), the digit count, and the
// number as a delta from the previous numbered id; anything else is a plain string index.
const ID_STRING = 0, ID_NUMBERED = 1, ID_DIGITS = /^(.*?)(\d{1,15})$/;
class IdWriter { prev = 0; write(w: Writer, s: StringTable, id: string) {
  const m = ID_DIGITS.exec(id);
  if (!m) { w.byte(ID_STRING); w.uvar(s.ref(id)); return; }
  const n = Number(m[2]);
  w.byte(ID_NUMBERED); w.uvar(s.ref(m[1])); w.uvar(m[2].length); w.zvar(n - this.prev); this.prev = n;
} }
class IdReader { prev = 0; read(r: Reader, strings: readonly string[]): string {
  const kind = r.byte();
  if (kind === ID_STRING) return str(r, strings);
  if (kind !== ID_NUMBERED) r.fail(`bad id kind ${kind}`);
  const prefix = str(r, strings), len = r.uvar(); if (len < 1 || len > 15) r.fail(`id digits ${len}`);
  const n = this.prev + r.zvar(); if (n < 0 || !Number.isSafeInteger(n)) r.fail(`id number ${n}`);
  this.prev = n;
  const digits = String(n); if (digits.length > len) r.fail(`id ${n} longer than ${len} digits`);
  return prefix + digits.padStart(len, '0');
} }

function writeFoot(w: Writer, s: StringTable, buildings: readonly CellBuilding[], tiles: StringTable): void {
  w.uvar(buildings.length);
  const xs = new Writer(), ys = new Writer(), ids = new IdWriter();
  let px = 0, py = 0;
  for (const b of buildings) {
    ids.write(w, s, b.id); w.uvar(tiles.ref(b.tile)); w.uvar(b.ordinal);
    const polys = polygonsOf(b.geometry);
    w.byte(b.geometry.type === 'Polygon' ? G_POLYGON : G_MULTI);
    if (b.geometry.type === 'MultiPolygon') w.uvar(polys.length);
    else if (polys.length !== 1) throw Error(`${b.id}: polygon`);
    for (const rings of polys) {
      w.uvar(rings.length);
      for (const ring of rings) {
        const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] && ring[0].length === 2 && ring[ring.length - 1].length === 2;
        const stored = closed ? ring.length - 1 : ring.length;
        w.uvar(stored * 2 + (closed ? 1 : 0));
        for (let k = 0; k < stored; k++) {
          const c = ring[k];
          if (c.length !== 2) throw Error(`${b.id}: position with ${c.length} values`);
          const x = toUnits(c[0], b.id), y = toUnits(c[1], b.id);
          xs.zvar(x - px); ys.zvar(y - py); px = x; py = y;
        }
      }
    }
  }
  const xb = xs.done(), yb = ys.done();
  w.uvar(xb.length); w.bytes(xb); w.uvar(yb.length); w.bytes(yb);
}

type FootRow = { id: string; tile: string; ordinal: number; geometry: Geometry };
function readFoot(r: Reader, strings: readonly string[], tiles: readonly string[]): FootRow[] {
  const n = r.count(MAX_BUILDINGS, 'buildings');
  const shapes: { id: string; tile: string; ordinal: number; multi: boolean; rings: { n: number; closed: boolean }[][] }[] = [];
  let vertices = 0;
  const ids = new IdReader();
  for (let i = 0; i < n; i++) {
    const id = ids.read(r, strings), ti = r.uvar(); if (ti >= tiles.length) r.fail(`tile index ${ti}`);
    const ordinal = r.count(MAX_COUNT, 'ordinal'), kind = r.byte();
    if (kind !== G_POLYGON && kind !== G_MULTI) r.fail(`bad geometry kind ${kind}`);
    const polyCount = kind === G_MULTI ? r.count(10_000, 'polygons') : 1, polys: { n: number; closed: boolean }[][] = [];
    for (let p = 0; p < polyCount; p++) {
      const ringCount = r.count(10_000, 'rings'), rings: { n: number; closed: boolean }[] = [];
      for (let k = 0; k < ringCount; k++) { const v = r.count(2 * 1_000_000 + 1, 'ring size'); rings.push({ n: Math.floor(v / 2), closed: v % 2 === 1 }); vertices += Math.floor(v / 2); }
      polys.push(rings);
    }
    if (vertices > MAX_COUNT) r.fail('too many vertices');
    shapes.push({ id, tile: tiles[ti], ordinal, multi: kind === G_MULTI, rings: polys });
  }
  const xr = new Reader(r.take(r.count(r.buf.length, 'x block')), `${r.what} FOOT x`);
  const yr = new Reader(r.take(r.count(r.buf.length, 'y block')), `${r.what} FOOT y`);
  let px = 0, py = 0;
  const out: FootRow[] = shapes.map(shape => {
    const polys = shape.rings.map(rings => rings.map(({ n: count, closed }) => {
      const ring: number[][] = new Array(count + (closed ? 1 : 0));
      for (let k = 0; k < count; k++) { px += xr.zvar(); py += yr.zvar(); ring[k] = [px / COORD_SCALE, py / COORD_SCALE]; }
      if (closed) ring[count] = count ? [ring[0][0], ring[0][1]] : [px / COORD_SCALE, py / COORD_SCALE];
      return ring;
    }));
    const geometry: Geometry = shape.multi ? { type: 'MultiPolygon', coordinates: polys } : { type: 'Polygon', coordinates: polys[0] };
    return { id: shape.id, tile: shape.tile, ordinal: shape.ordinal, geometry };
  });
  xr.end(); yr.end();
  return out;
}

// --- v3 streams ------------------------------------------------------------
// The bytes gate (P2, 2026-10-31): v3 keeps every decoded value identical to v2 (the staging compiler
// asserts it) and only changes how the bytes are laid out, so gzip finds more to share.

// Typed columns (STYL/ATTR). A column whose values all share one kind skips the per-value tag byte:
//   C_GEN  generic values (as v2)
//   C_STR  all strings: a column dictionary (count, string indices, first-appearance order), then per value
//          its dictionary index (nothing when the dictionary has one entry)
//   C_NUM  all numbers exact at one decimal scale: u8 places 0..7, then zigzag mantissas
//   C_NUM_DELTA  as C_NUM, each mantissa a delta from the previous one (chosen when fewer varint bytes)
//   C_BOOL all booleans: bits, least significant first, zero padding
//   C_HEX  all "#rrggbb" (lowercase) with many distinct values (> 1 in 8 rows): three bytes each instead of
//          a dictionary (measured roof colours); C_STR wins for the palette colours, which repeat
const C_GEN = 0, C_STR = 1, C_NUM = 2, C_BOOL = 3, C_HEX = 4, C_NUM_DELTA = 5, C_SAME = 6, C_INTS = 7;
// C_INTS (v5): strings that are comma-joined integer lists ("2,41,7,5,9,34": roofFurniture), mostly distinct, as
// per row uvar(count) then zigzag integers. Only for lists that print back exactly (no "-0", "+1", "01" or spaces).
const INT_ITEM = /^-?(0|[1-9][0-9]{0,14})$/;
function intList(v: string): number[] | null {
  if (!v) return null;
  const parts = v.split(','), out: number[] = [];
  for (const p of parts) { if (!INT_ITEM.test(p) || p === '-0') return null; const n = Number(p); if (!Number.isSafeInteger(n) || Math.abs(n) >= 2 ** 52) return null; out.push(n); }
  return out;
}
const varintBytes = (xs: readonly number[]): number => { let n = 0; for (const x of xs) { let u = x >= 0 ? x * 2 : -x * 2 - 1; n++; while (u >= 128) { n++; u = Math.floor(u / 128); } } return n; };
const HEX = /^#[0-9a-f]{6}$/;
const HEX_DISTINCT = 8;
const isPlainNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && !Object.is(v, -0);
/** Smallest decimal places k (0..7) at which v round-trips as mantissa / 10^k, or -1. */
function placesOf(v: number): number {
  if (Number.isSafeInteger(v) && Math.abs(v) < 2 ** 52) return 0;
  for (let k = 1; k < POW10.length; k++) { const m = Math.round(v * POW10[k]); if (Math.abs(m) < 2 ** 52 && m / POW10[k] === v) return k; }
  return -1;
}
function writeColumn(w: Writer, s: StringTable, col: readonly unknown[], ver: number): void {
  if (col.every(v => typeof v === 'string')) {
    const dict = new Map<string, number>();
    for (const v of col as string[]) if (!dict.has(v)) dict.set(v, dict.size);
    // Mostly distinct integer lists: the dictionary would put each one in STRS.
    if (ver >= 5 && dict.size * 4 > col.length) {
      const lists = (col as string[]).map(intList);
      if (lists.every(l => l !== null)) { w.byte(C_INTS); for (const l of lists as number[][]) { w.uvar(l.length); for (const x of l) w.zvar(x); } return; }
    }
    if (dict.size * HEX_DISTINCT > col.length && (col as string[]).every(v => HEX.test(v))) {
      w.byte(C_HEX); for (const v of col as string[]) { const x = parseInt(v.slice(1), 16); w.byte(x >> 16); w.byte(x >> 8); w.byte(x); }
      return;
    }
    w.byte(C_STR); w.uvar(dict.size); for (const v of dict.keys()) w.uvar(s.ref(v));
    if (dict.size > 1) for (const v of col as string[]) w.uvar(dict.get(v)!);
    return;
  }
  if (col.every(v => typeof v === 'boolean')) {
    w.byte(C_BOOL);
    for (let i = 0; i < col.length; i += 8) { let b = 0; for (let k = 0; k < 8 && i + k < col.length; k++) if (col[i + k]) b |= 1 << k; w.byte(b); }
    return;
  }
  if (col.every(isPlainNumber)) {
    let places = 0;
    for (const v of col as number[]) { const k = placesOf(v); if (k < 0) { places = -1; break; } places = Math.max(places, k); }
    const scale = places >= 0 ? POW10[places] : 0;
    if (places >= 0 && (col as number[]).every(v => { const m = Math.round(v * scale); return Math.abs(m) < 2 ** 52 && m / scale === v; })) {
      // Mantissas as they are, or as deltas from the previous row when that is fewer varint bytes (heights and
      // years of a terrace run together).
      const ms = (col as number[]).map(v => Math.round(v * scale)), ds = ms.map((m, i) => m - (i ? ms[i - 1] : 0));
      const delta = varintBytes(ds) < varintBytes(ms) && ds.every(d => Math.abs(d) < 2 ** 52);
      w.byte(delta ? C_NUM_DELTA : C_NUM); w.byte(places);
      for (const m of delta ? ds : ms) w.zvar(m);
      return;
    }
  }
  w.byte(C_GEN); for (const v of col) writeValue(w, s, v, 1);
}
function readColumn(r: Reader, strings: readonly string[], n: number, ver: number): unknown[] {
  const kind = r.byte(), col = new Array<unknown>(n);
  switch (kind) {
    case C_INTS: {
      if (ver < 5) r.fail(`bad column kind ${kind}`);
      for (let i = 0; i < n; i++) { const m = r.count(1_000_000, 'integer list'); if (m < 1) r.fail('empty integer list'); const xs = new Array<number>(m); for (let k = 0; k < m; k++) xs[k] = r.zvar(); col[i] = xs.join(','); }
      return col;
    }
    case C_STR: {
      const size = r.count(n, 'column dictionary'); if (size < 1) r.fail('empty column dictionary');
      const dict: string[] = [], seen = new Set<number>();
      for (let k = 0; k < size; k++) { const i = r.uvar(); if (i >= strings.length) r.fail(`string index ${i} >= ${strings.length}`); if (seen.has(i)) r.fail('duplicate column dictionary entry'); seen.add(i); dict.push(strings[i]); }
      if (size === 1) { col.fill(dict[0]); return col; }
      // First-appearance order: entry k may appear only after entries 0..k-1 have (what the encoder writes).
      let next = 0;
      for (let i = 0; i < n; i++) { const d = r.uvar(); if (d > next || d >= size) r.fail(`column dictionary index ${d}`); if (d === next) next++; col[i] = dict[d]; }
      if (next !== size) r.fail('unused column dictionary entries');
      return col;
    }
    case C_BOOL: {
      for (let i = 0; i < n; i += 8) { const b = r.byte(), m = Math.min(8, n - i); if (b >> m) r.fail('bool padding'); for (let k = 0; k < m; k++) col[i + k] = ((b >> k) & 1) === 1; }
      return col;
    }
    case C_NUM: case C_NUM_DELTA: {
      const places = r.byte(); if (places >= POW10.length) r.fail(`decimal places ${places}`);
      let m = 0;
      for (let i = 0; i < n; i++) { m = kind === C_NUM_DELTA ? m + r.zvar() : r.zvar(); if (!Number.isSafeInteger(m) || Math.abs(m) >= 2 ** 52) r.fail(`mantissa ${m}`); col[i] = m / POW10[places]; }
      return col;
    }
    case C_HEX: for (let i = 0; i < n; i++) { const b = r.take(3); col[i] = '#' + ((b[0] << 16) | (b[1] << 8) | b[2]).toString(16).padStart(6, '0'); } return col;
    case C_GEN: for (let i = 0; i < n; i++) col[i] = readValue(r, strings, 1); return col;
    default: return r.fail(`bad column kind ${kind}`);
  }
}

// FOOT v3. Columns, each a length-prefixed block: ids, source (tile index + ordinal), shape (geometry kind,
// polygon/ring counts), vertex references (per stored vertex: 0, or how many vertices back in this cell
// the same position was last stored: a party-wall corner, ~20% of vertices), then for the vertices that
// are not references: the first vertex of each building as X and Y deltas from the previous building's
// first vertex (1e-7 degree), and the remaining vertices as X and Y deltas within the building, in the
// building's unit: 1e-6 degree when every in-building delta is a multiple of ten (about 96% of the
// city's coordinates sit on the 1e-6 grid), else 1e-7 (geometry kind bit FOOT_FINE). Exact either way.
// Ordinals are a delta from the previous building of the same tile (+1 is the common step).
const FOOT_FINE = 2;
// FOOT v5 refs: 0 = a new vertex; 1 / 2 = the reference continues the previous vertex's reference one vertex
// back / forward in the earlier ring (a shared wall run, traversed against / with it); else distance back + 2.
// The run symbols are canonical: a distance that a run symbol could say is rejected.
const REF_NEW = 0, REF_RUN_BACK = 1, REF_RUN_FORWARD = 2, REF_DISTANCE = 2;
function writeFootV3(w: Writer, s: StringTable, buildings: readonly CellBuilding[], tiles: StringTable, ver: number): void {
  const interleave = ver >= 4, runs = ver >= 5;
  let runAt = -2, runVertex = -2;
  w.uvar(buildings.length);
  // v4 interleaves X and Y (one first-vertex block, one delta block): -80 KB gzip city-wide.
  const idw = new Writer(), src = new Writer(), shape = new Writer(), refs = new Writer(), x0 = new Writer(), y0 = interleave ? x0 : new Writer(), xd = new Writer(), yd = interleave ? xd : new Writer();
  const ids = new IdWriter(), lastOrdinal = new Map<number, number>(), seen = new Map<string, number>();
  let fx = 0, fy = 0, vertex = 0;
  for (const b of buildings) {
    ids.write(idw, s, b.id);
    const ti = tiles.ref(b.tile);
    if (!Number.isSafeInteger(b.ordinal) || b.ordinal < 0) throw Error(`${b.id}: ordinal ${b.ordinal}`);
    src.uvar(ti); src.zvar(b.ordinal - (lastOrdinal.get(ti) ?? -1) - 1); lastOrdinal.set(ti, b.ordinal);
    const polys = polygonsOf(b.geometry);
    if (b.geometry.type === 'Polygon' && polys.length !== 1) throw Error(`${b.id}: polygon`);
    const units: number[] = [];
    for (const rings of polys) for (const ring of rings) {
      const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] && ring[0].length === 2 && ring[ring.length - 1].length === 2;
      const stored = closed ? ring.length - 1 : ring.length;
      for (let k = 0; k < stored; k++) {
        const c = ring[k];
        if (c.length !== 2) throw Error(`${b.id}: position with ${c.length} values`);
        units.push(toUnits(c[0], b.id), toUnits(c[1], b.id));
      }
    }
    let fine = false;
    for (let k = 2; k < units.length; k++) if ((units[k] - units[k - 2]) % 10 !== 0) { fine = true; break; }
    shape.byte((b.geometry.type === 'Polygon' ? G_POLYGON : G_MULTI) | (fine ? FOOT_FINE : 0));
    if (b.geometry.type === 'MultiPolygon') shape.uvar(polys.length);
    for (const rings of polys) {
      shape.uvar(rings.length);
      for (const ring of rings) {
        const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] && ring[0].length === 2 && ring[ring.length - 1].length === 2;
        shape.uvar((closed ? ring.length - 1 : ring.length) * 2 + (closed ? 1 : 0));
      }
    }
    const unit = fine ? 1 : 10;
    for (let k = 0; k < units.length; k += 2, vertex++) {
      const key = `${units[k]},${units[k + 1]}`, at = seen.get(key); seen.set(key, vertex);
      if (at !== undefined) {
        if (!runs) refs.uvar(vertex - at);
        else if (runVertex === vertex - 1 && at === runAt - 1) refs.uvar(REF_RUN_BACK);
        else if (runVertex === vertex - 1 && at === runAt + 1) refs.uvar(REF_RUN_FORWARD);
        else refs.uvar(vertex - at + REF_DISTANCE);
        runAt = at; runVertex = vertex;
        if (k === 0) { fx = units[0]; fy = units[1]; }
        continue;
      }
      refs.uvar(REF_NEW);
      if (k === 0) { x0.zvar(units[0] - fx); y0.zvar(units[1] - fy); fx = units[0]; fy = units[1]; }
      else { xd.zvar((units[k] - units[k - 2]) / unit); yd.zvar((units[k + 1] - units[k - 1]) / unit); }
    }
  }
  for (const block of interleave ? [idw, src, shape, refs, x0, xd] : [idw, src, shape, refs, x0, y0, xd, yd]) { const b = block.done(); w.uvar(b.length); w.bytes(b); }
}
function readFootV3(r: Reader, strings: readonly string[], tiles: readonly string[], ver: number): FootRow[] {
  const interleave = ver >= 4, runs = ver >= 5;
  let runAt = -2, runVertex = -2;
  const n = r.count(MAX_BUILDINGS, 'buildings');
  const block = (name: string) => new Reader(r.take(r.count(r.buf.length, `${name} block`)), `${r.what} FOOT ${name}`);
  const idr = block('ids'), src = block('source'), shr = block('shape'), refs = block('refs');
  const x0 = block(interleave ? 'xy0' : 'x0'), y0 = interleave ? x0 : block('y0'), xd = block(interleave ? 'xy' : 'x'), yd = interleave ? xd : block('y');
  const ids = new IdReader(), lastOrdinal = new Map<number, number>(), out: FootRow[] = new Array(n);
  let fx = 0, fy = 0, vertices = 0;
  const hx: number[] = [], hy: number[] = [];
  for (let i = 0; i < n; i++) {
    const id = ids.read(idr, strings), ti = src.uvar(); if (ti >= tiles.length) src.fail(`tile index ${ti}`);
    const ordinal = (lastOrdinal.get(ti) ?? -1) + 1 + src.zvar(); if (ordinal < 0 || ordinal > MAX_COUNT) src.fail(`ordinal ${ordinal}`); lastOrdinal.set(ti, ordinal);
    const kindByte = shr.byte(), kind = kindByte & ~FOOT_FINE, fine = (kindByte & FOOT_FINE) !== 0;
    if (kind !== G_POLYGON && kind !== G_MULTI) shr.fail(`bad geometry kind ${kindByte}`);
    const unit = fine ? 1 : 10, polyCount = kind === G_MULTI ? shr.count(10_000, 'polygons') : 1, polys: number[][][][] = [];
    let first = true, px = 0, py = 0;
    for (let p = 0; p < polyCount; p++) {
      const ringCount = shr.count(10_000, 'rings'), rings: number[][][] = [];
      for (let k = 0; k < ringCount; k++) {
        const v = shr.count(2 * 1_000_000 + 1, 'ring size'), count = Math.floor(v / 2), closed = v % 2 === 1;
        if (closed && count === 0) shr.fail('closed empty ring');
        vertices += count; if (vertices > MAX_COUNT) shr.fail('too many vertices');
        const ring: number[][] = new Array(count + (closed ? 1 : 0));
        for (let q = 0; q < count; q++) {
          const symbol = refs.uvar(), vertex = hx.length;
          let at = -1;
          if (symbol !== REF_NEW) {
            if (!runs) at = vertex - symbol;
            else if (symbol === REF_RUN_BACK || symbol === REF_RUN_FORWARD) {
              if (runVertex !== vertex - 1) refs.fail('vertex run without a reference before it');
              at = symbol === REF_RUN_BACK ? runAt - 1 : runAt + 1;
            } else {
              at = vertex - (symbol - REF_DISTANCE);
              if (runVertex === vertex - 1 && (at === runAt - 1 || at === runAt + 1)) refs.fail('vertex reference that a run symbol says');
            }
            if (at < 0 || at >= vertex) refs.fail(`vertex reference ${symbol}`);
            runAt = at; runVertex = vertex;
          }
          if (at >= 0) { px = hx[at]; py = hy[at]; if (first) { fx = px; fy = py; } }
          else if (first) { fx += x0.zvar(); fy += y0.zvar(); px = fx; py = fy; } else { px += xd.zvar() * unit; py += yd.zvar() * unit; }
          first = false; hx.push(px); hy.push(py);
          ring[q] = [px / COORD_SCALE, py / COORD_SCALE];
        }
        if (closed) ring[count] = [ring[0][0], ring[0][1]];
        rings.push(ring);
      }
      polys.push(rings);
    }
    const geometry: Geometry = kind === G_MULTI ? { type: 'MultiPolygon', coordinates: polys } : { type: 'Polygon', coordinates: polys[0] };
    out[i] = { id, tile: tiles[ti], ordinal, geometry };
  }
  for (const x of new Set([idr, src, shr, refs, x0, y0, xd, yd])) x.end();
  return out;
}

// GRP v3: group 0 = none, 1 = the building's own source tile, else tile index + 2. Party walls are symmetric
// (A lists B and B lists A) and lists are ascending, so a building normally writes only its forward
// neighbours (index > own) and inherits the backward ones from the earlier buildings that listed it:
//   uvar(2 * forwardCount): canonical, list = [earlier buildings whose forward lists named this one,
//     ascending] + forward (ascending, as gaps: first - own - 1, then next - previous - 1) + external ids
//     (uvar count, string indices: neighbours in another cell);
//   uvar(2 * count + 1): explicit, the list as written (0 + string index, or zz(index - own) + 1); its
//     entries beyond its own index still count as forward for later buildings.
function canonicalList(back: readonly number[], forward: readonly number[], external: readonly string[]): Neighbour[] { return [...back, ...forward, ...external]; }
function writeGroupsV3(w: Writer, s: StringTable, buildings: readonly CellBuilding[], tiles: StringTable): void {
  const back: number[][] = buildings.map(() => []);
  buildings.forEach((b, i) => {
    if (b.group === undefined) { w.uvar(0); return; }
    w.uvar(b.group === b.tile ? 1 : tiles.ref(b.group) + 2);
    const ns = b.neighbours ?? [];
    for (const n of ns) if (typeof n === 'number' && (!Number.isSafeInteger(n) || n < 0 || n >= buildings.length)) throw Error(`bad neighbour ${n}`);
    const forward = ns.filter((n): n is number => typeof n === 'number' && n > i), external = ns.filter((n): n is string => typeof n === 'string');
    const ascending = forward.every((n, k) => k === 0 || n > forward[k - 1]);
    if (ascending && sameValue(canonicalList(back[i], forward, external), ns)) {
      w.uvar(forward.length * 2);
      let prev = i; for (const n of forward) { w.uvar(n - prev - 1); prev = n; }
      w.uvar(external.length); for (const id of external) w.uvar(s.ref(id));
    } else {
      w.uvar(ns.length * 2 + 1);
      for (const n of ns) {
        if (typeof n === 'number') w.uvar((n - i >= 0 ? (n - i) * 2 : (i - n) * 2 - 1) + 1);
        else { w.uvar(0); w.uvar(s.ref(n)); }
      }
    }
    for (const n of forward) back[n].push(i);
  });
}
function readGroupsV3(r: Reader, strings: readonly string[], tiles: readonly string[], buildings: CellBuilding[]): void {
  const back: number[][] = buildings.map(() => []), limit = buildings.length + 100_000;
  buildings.forEach((b, i) => {
    const g = r.uvar(); if (g === 0) { if (back[i].length) r.fail(`neighbours of ungrouped building ${i}`); return; }
    if (g >= 2 && g - 2 >= tiles.length) r.fail(`group tile ${g - 2}`);
    b.group = g === 1 ? b.tile : tiles[g - 2];
    const head = r.count(2 * limit + 1, 'neighbours'), m = Math.floor(head / 2), forward: number[] = [];
    if (head % 2 === 0) {
      let prev = i;
      for (let k = 0; k < m; k++) { const n = prev + 1 + r.uvar(); if (n >= buildings.length) r.fail(`neighbour ${n}`); forward.push(n); prev = n; }
      const e = r.count(limit, 'external neighbours'), external: string[] = [];
      for (let k = 0; k < e; k++) external.push(str(r, strings));
      b.neighbours = canonicalList(back[i], forward, external);
    } else {
      const ns: Neighbour[] = [];
      for (let k = 0; k < m; k++) {
        const v = r.uvar(); if (v === 0) { ns.push(str(r, strings)); continue; }
        const z = v - 1, n = i + (z % 2 === 0 ? z / 2 : -(z + 1) / 2);
        if (n < 0 || n >= buildings.length) r.fail(`neighbour ${n}`);
        ns.push(n); if (n > i) forward.push(n);
      }
      b.neighbours = ns;
    }
    for (const n of forward) back[n].push(i);
  });
}

// --- container -------------------------------------------------------------

/** `strings`: the cell's own STRS entries (what a shared table could take over). */
export type EncodedCell = { bytes: Uint8Array; streams: { tag: StreamTag; offset: number; bytes: number }[]; strings: readonly string[] };

/** Encode a cell. Deterministic: the same buildings in the same order give the same bytes. A runtime
 *  cell unless `cell.debug` (then ATTR is written and STYL is the delta against it). */
export function encodeCell(cell: Cell, version: number = WORLD_FORMAT_VERSION, globals?: GlobalStrings): EncodedCell {
  if (!WORLD_FORMAT_VERSIONS.includes(version)) throw Error(`cannot encode world format ${version}`);
  const debug = !!cell.debug, v3 = version >= 3;
  if (globals && version < 4) throw Error(`a shared string table needs format 4, not ${version}`);
  const s = new StringTable(globals), tiles = new StringTable();
  // Tile list first so its strings are stable; FOOT carries the tile list ahead of its buildings.
  for (const b of cell.buildings) tiles.ref(b.tile);
  for (const b of cell.buildings) if (b.group !== undefined) tiles.ref(b.group);
  const foot = new Writer();
  foot.uvar(tiles.list.length); for (const t of tiles.list) { const [x, y] = t.split('/').map(Number); if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || `${x}/${y}` !== t) throw Error(`bad tile ${t}`); foot.uvar(x); foot.uvar(y); }
  if (v3) writeFootV3(foot, s, cell.buildings, tiles, version); else writeFoot(foot, s, cell.buildings, tiles);
  const attr = new Writer(), styl = new Writer(), roof = new Writer(), grp = new Writer(), hide = new Writer();
  if (debug) {
    writeBags(attr, s, cell.buildings.map(b => b.attr), cell.buildings.map(b => b.id), version);
    writeStyles(styl, s, cell.buildings.map(b => b.attr), cell.buildings.map(b => b.styled), version);
  } else writeBags(styl, s, cell.buildings.map(b => b.styled ?? b.attr), cell.buildings.map(b => b.id), version);
  // ROOF is optional (a mode byte): the chunk worker still plans roofs itself in v1, and the plans are
  // the largest stream, so the compiler writes them only when asked (--roof) until a consumer reads them.
  const withRoof = cell.buildings.some(b => b.roof !== undefined);
  roof.byte(withRoof ? 1 : 0);
  if (withRoof) for (const b of cell.buildings) writeValue(roof, s, b.roof ?? null);
  if (v3) writeGroupsV3(grp, s, cell.buildings, tiles);
  else for (const b of cell.buildings) {
    if (b.group === undefined) { grp.uvar(0); continue; }
    grp.uvar(tiles.ref(b.group) + 1);
    const ns = b.neighbours ?? [];
    grp.uvar(ns.length);
    for (const n of ns) {
      if (typeof n === 'number') { if (!Number.isSafeInteger(n) || n < 0 || n >= cell.buildings.length) throw Error(`bad neighbour ${n}`); grp.uvar(n + 1); }
      else { grp.uvar(0); grp.uvar(s.ref(n)); }
    }
  }
  hide.uvar(cell.hide.length);
  for (const h of cell.hide) { hide.uvar(s.ref(h.id)); hide.uvar(h.reasons); hide.uvar(h.models.length); for (const m of h.models) hide.uvar(s.ref(m)); }
  const payloads: [StreamTag, Uint8Array][] = [['STRS', writeStrings(s)], ['FOOT', foot.done()], ['ATTR', attr.done()], ['STYL', styl.done()], ['ROOF', roof.done()], ['GRP ', grp.done()], ['HIDE', hide.done()]];
  if (!debug) payloads.splice(2, 1);
  const w = new Writer();
  w.bytes(encoder.encode(WORLD_MAGIC)); w.byte(version); w.byte((debug ? FLAG_DEBUG : 0) | (globals ? FLAG_GLOBAL : 0)); w.zvar(cell.i); w.zvar(cell.j);
  if (globals) { w.uvar(globals.list.length); for (let k = 0; k < 4; k++) w.byte(globals.hash >>> (8 * k)); }
  w.uvar(payloads.length);
  for (const [tag, bytes] of payloads) { w.bytes(encoder.encode(tag)); w.uvar(bytes.length); }
  const streams: EncodedCell['streams'] = [];
  for (const [tag, bytes] of payloads) { streams.push({ tag, offset: w.length, bytes: bytes.length }); w.bytes(bytes); }
  return { bytes: w.done(), streams, strings: s.list };
}

/** Decode a cell (already inflated). Throws on any structural problem; never returns a partial cell. */
export function decodeCell(bytes: Uint8Array, what = 'world cell', globals?: GlobalStrings): Cell {
  const r = new Reader(bytes, what);
  const magic = String.fromCharCode(...r.take(4));
  if (magic !== WORLD_MAGIC) r.fail(`bad magic ${JSON.stringify(magic)}`);
  const version = r.byte(); if (!WORLD_FORMAT_VERSIONS.includes(version)) r.fail(`unsupported version ${version}`);
  const v3 = version >= 3;
  const flags = r.byte(); if (flags & ~(version >= 4 ? FLAG_DEBUG | FLAG_GLOBAL : FLAG_DEBUG)) r.fail(`unknown flags ${flags}`);
  const debug = (flags & FLAG_DEBUG) !== 0, tags = debug ? STREAM_TAGS : STREAM_TAGS.filter(t => t !== 'ATTR');
  const i = r.zvar(), j = r.zvar();
  let shared: readonly string[] = [];
  if (flags & FLAG_GLOBAL) {
    const count = r.uvar(), hb = r.take(4), hash = (hb[0] | (hb[1] << 8) | (hb[2] << 16) | (hb[3] << 24)) >>> 0;
    const g = globals ?? r.fail('needs the shared string table (strings.bin)');
    if (g.list.length !== count || g.hash !== hash) r.fail(`shared string table mismatch: cell wants ${count} strings #${hash.toString(16)}, have ${g.list.length} #${g.hash.toString(16)}`);
    shared = g.list;
  }
  const n = r.count(STREAM_TAGS.length, 'streams');
  if (n !== tags.length) r.fail(`expected ${tags.length} streams, got ${n}`);
  const table: [string, number][] = [];
  for (let k = 0; k < n; k++) { const tag = String.fromCharCode(...r.take(4)); if (tag !== tags[k]) r.fail(`stream ${k} is ${JSON.stringify(tag)}, expected ${tags[k]}`); table.push([tag, r.count(bytes.length, 'stream length')]); }
  const sub = new Map<string, Reader>();
  for (const [tag, len] of table) sub.set(tag, new Reader(r.take(len), `${what} ${tag.trim()}`));
  r.end();
  const own = readStrings(sub.get('STRS')!), strings = shared.length ? shared.concat(own) : own;
  const fr = sub.get('FOOT')!;
  const tileCount = fr.count(10_000, 'tiles'), tiles: string[] = [];
  for (let k = 0; k < tileCount; k++) tiles.push(`${fr.uvar()}/${fr.uvar()}`);
  const rows = v3 ? readFootV3(fr, strings, tiles, version) : readFoot(fr, strings, tiles); fr.end();
  const ar = sub.get('ATTR'), sr = sub.get('STYL')!, rr = sub.get('ROOF')!, gr = sub.get('GRP ')!, hr = sub.get('HIDE')!;
  const ids = rows.map(row => row.id);
  const attrs = readBags(ar ?? sr, strings, rows.length, ids, version);
  const styles = ar ? readStyles(sr, strings, attrs, version) : [];
  const roofMode = rr.byte(); if (roofMode > 1) rr.fail(`bad roof mode ${roofMode}`);
  const buildings: CellBuilding[] = rows.map((row, k) => {
    const b: CellBuilding = { ...row, attr: attrs[k] };
    if (styles[k]) b.styled = styles[k];
    if (roofMode) { const roof = readValue(rr, strings); if (roof !== null) b.roof = roof; }
    return b;
  });
  if (v3) readGroupsV3(gr, strings, tiles, buildings);
  else for (const b of buildings) {
    const g = gr.uvar(); if (g === 0) continue;
    if (g - 1 >= tiles.length) gr.fail(`group tile ${g - 1}`);
    b.group = tiles[g - 1];
    const m = gr.count(buildings.length + 100_000, 'neighbours'), ns: Neighbour[] = [];
    for (let k = 0; k < m; k++) { const v = gr.uvar(); if (v === 0) ns.push(str(gr, strings)); else { if (v - 1 >= buildings.length) gr.fail(`neighbour ${v - 1}`); ns.push(v - 1); } }
    b.neighbours = ns;
  }
  const hn = hr.count(MAX_COUNT, 'hidden ids'), hide: HideEntry[] = [];
  for (let k = 0; k < hn; k++) { const id = str(hr, strings), reasons = hr.uvar(); if (reasons === 0 || reasons > 7) hr.fail(`bad hide reasons ${reasons}`); const mc = hr.count(1000, 'models'), models: string[] = []; for (let q = 0; q < mc; q++) models.push(str(hr, strings)); hide.push({ id, reasons, models }); }
  for (const x of [ar, sr, rr, gr, hr]) x?.end();
  return debug ? { i, j, buildings, hide, debug } : { i, j, buildings, hide };
}

/** Inflate when gzipped (the host may already have decoded Content-Encoding); other bytes pass through. */
export async function inflateCell(bytes: Uint8Array): Promise<Uint8Array> {
  if (!(bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b)) return bytes;
  if (typeof DecompressionStream === 'undefined') throw Error('gzip world cells need DecompressionStream');
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** Inflate when gzipped, then decode. */
export async function decodeCellResponse(bytes: Uint8Array, what?: string): Promise<Cell> {
  return decodeCell(await inflateCell(bytes), what);
}

/** The feature the default tile path adopts (enriched, undecorated) for a cell building. */
export function rawFeature(b: CellBuilding): { type: 'Feature'; properties: Props; geometry: Geometry } {
  return { type: 'Feature', properties: b.attr, geometry: b.geometry };
}
/** The feature the default decorator chain produces, sharing the raw feature's geometry like the chain does. */
export function styledFeature(b: CellBuilding, raw = rawFeature(b)): { type: 'Feature'; properties: Props; geometry: Geometry } {
  return b.styled ? { type: 'Feature', properties: b.styled, geometry: raw.geometry } : raw;
}
