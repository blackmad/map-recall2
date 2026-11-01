/**
 * A device-side cache of the city's routing graph and road surface index (lever b2, 2026-11-01).
 *
 * Both are built from the city's road segments on every first ride of a session: about 2.8–3.2 s of the emulated
 * iPhone's (4x CPU) immediate-submit time to ride. Both are flat typed arrays (`RoadGraphStorage`,
 * `RoadSpatialIndex`), so they structured-clone into IndexedDB cheaply and come back as typed arrays. A return
 * visit restores them instead of building.
 *
 * Safety, in order:
 *  - the record names the segments it was built from by `roadSegmentsFingerprint` (every point, width, name, way id
 *    and ferry link that feeds either build); a record whose fingerprint differs from this session's segments is
 *    never used;
 *  - the key carries `ROAD_WORLD_CACHE_VERSION` and the build options; a change to what either build outputs must
 *    bump the version (roadWorldCache.test.ts pins a fixture's packed hash to it, so it cannot be forgotten);
 *  - `unpackRoadWorld` checks every array length, offset run and index range before anything reads it;
 *  - every storage call is wrapped: a private window, a blocked or full store, a slow open (`OPEN_TIMEOUT_MS`) or a
 *    quota estimate too small for the record all fall through to the live build, and nothing is thrown.
 */
import { roadGraphFromStorage, type RoadGraph, type RoadGraphConnector, type RoadGraphStorage } from './roadGraph.ts';
import type { RoadPoint, RoadSegmentLike, RoadSpatialIndex } from './roadSurface.ts';

/** Bump whenever `buildRoadGraph`, `connectFerryGraph` or `buildRoadSpatialIndex` would output something different. */
export const ROAD_WORLD_CACHE_VERSION = 1;

/** The segment fields the two builds read (road-network.js routingSegmentsOf / landOnly, ferry/network.ts). */
export type RoadWorldSegment = Readonly<{
  points: readonly RoadPoint[];
  width?: number;
  name?: string;
  wayId?: string;
  type?: string;
  ferryLink?: Readonly<{ id: string }>;
}>;

/**
 * 64-bit FNV-1a-style hash (two 32-bit lanes) over everything in the segments that feeds the graph or the surface
 * index, as 16 hex digits. Coordinates are hashed by their float64 bits: exact, no rounding.
 */
export function roadSegmentsFingerprint(segments: readonly RoadWorldSegment[]): string {
  let h1 = 0x811c9dc5 | 0, h2 = 0x01000193 ^ 0x5bd1e995;
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  const word = (w: number) => {
    h1 = Math.imul(h1 ^ w, 0x01000193);
    h2 = Math.imul(h2 ^ (w + 0x9e3779b9 | 0), 0x5bd1e995);
    h2 ^= h2 >>> 15;
  };
  const num = (v: number) => { f64[0] = v; word(u32[0]); word(u32[1]); };
  const str = (s: string | undefined) => {
    const t = s ?? '';
    word(t.length);
    for (let i = 0; i < t.length; i++) word(t.charCodeAt(i));
  };
  word(segments.length);
  for (const segment of segments) {
    const points = segment.points || [];
    word(points.length);
    for (const p of points) { num(p.x); num(p.y); }
    num(segment.width || 0);
    str(segment.name);
    str(segment.wayId);
    str(segment.type);
    str(segment.ferryLink ? segment.ferryLink.id : '');
  }
  const hex = (v: number) => (v >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2);
}

/** What goes into IndexedDB: plain fields, typed arrays and Maps only (structured-clone friendly). */
export type PackedRoadWorld = {
  version: number;
  fingerprint: string;
  segmentCount: number;
  graph: {
    mergeSize: number;
    nodeCount: number;
    x: Float64Array; y: Float64Array; keyKind: Uint8Array;
    extraKeys: Map<number, string>;
    offsets: Int32Array; targets: Int32Array; edgeLink: Int32Array;
    linkDistance: Float64Array; linkKind: Uint8Array;
    linkSegOffsets: Int32Array; linkSegIndexes: Int32Array;
    linkMetadata: Map<number, unknown>;
    /** Connector k: a = (ends[4k], ends[4k+1]), b = (ends[4k+2], ends[4k+3]), segment connectorSeg[k]. */
    connectorEnds: Float64Array;
    connectorSeg: Int32Array;
    /** Connector k's `a` is point connectorAPoint[k] of its segment (the same object: ferry terminals carry their
     * stop's fields), or −1 for a point of its own. */
    connectorAPoint: Int32Array;
  };
  surface: {
    cellSize: number;
    keys: Float64Array; offsets: Int32Array; ids: Int32Array;
    stringCells: Map<string, Int32Array>;
    spanSeg: Int32Array; spanPt: Int32Array;
  };
};

/** `surfaceSegments`: the segments the surface index was built from (landOnly), whose point objects connectors share. */
export function packRoadWorld(graph: RoadGraph<unknown>, surface: RoadSpatialIndex, fingerprint: string, surfaceSegments: readonly RoadSegmentLike[]): PackedRoadWorld {
  const s = graph.storage;
  const n = graph.connectors.length;
  const connectorEnds = new Float64Array(n * 4), connectorSeg = new Int32Array(n), connectorAPoint = new Int32Array(n);
  graph.connectors.forEach((c, k) => {
    const points = surfaceSegments[c.segmentIndex] ? surfaceSegments[c.segmentIndex].points : [];
    connectorAPoint[k] = points.indexOf(c.a as RoadPoint);
    connectorEnds[4 * k] = c.a.x; connectorEnds[4 * k + 1] = c.a.y;
    connectorEnds[4 * k + 2] = c.b.x; connectorEnds[4 * k + 3] = c.b.y;
    connectorSeg[k] = c.segmentIndex;
  });
  return {
    version: ROAD_WORLD_CACHE_VERSION,
    fingerprint,
    segmentCount: surfaceSegments.length,
    graph: {
      mergeSize: s.mergeSize, nodeCount: s.nodeCount, x: s.x, y: s.y, keyKind: s.keyKind,
      extraKeys: new Map(s.extraKeys), offsets: s.offsets, targets: s.targets, edgeLink: s.edgeLink,
      linkDistance: s.linkDistance, linkKind: s.linkKind, linkSegOffsets: s.linkSegOffsets, linkSegIndexes: s.linkSegIndexes,
      linkMetadata: new Map(s.linkMetadata), connectorEnds, connectorSeg, connectorAPoint,
    },
    surface: {
      cellSize: surface.cellSize, keys: surface.keys, offsets: surface.offsets, ids: surface.ids,
      stringCells: new Map(surface.stringCells), spanSeg: surface.spanSeg, spanPt: surface.spanPt,
    },
  };
}

class Invalid extends Error {}
let refusal = '';
/** Why the last `unpackRoadWorld` refused its record ('' after a restore): diagnostics and the console warning. */
export function lastRoadWorldRefusal(): string { return refusal; }
const need = (ok: boolean, what: string) => { if (!ok) throw new Invalid(what); };
const isA = (v: unknown, T: { new (...a: never[]): unknown }) => v instanceof T;

/** `offsets` starts at 0, never decreases and ends at `total`. */
function checkOffsets(offsets: Int32Array, length: number, total: number, what: string) {
  need(offsets.length === length && offsets[0] === 0 && offsets[length - 1] === total, `${what} offsets`);
  for (let i = 1; i < length; i++) if (offsets[i] < offsets[i - 1]) throw new Invalid(`${what} offsets decrease at ${i}`);
}

function checkRange(values: Int32Array, lo: number, hi: number, what: string) {
  for (let i = 0; i < values.length; i++) if (!(values[i] >= lo && values[i] < hi)) throw new Invalid(`${what} ${i} out of range`);
}

/**
 * The graph and surface index from a packed record, or null if it is not exactly what these segments would build:
 * another version, fingerprint or segment count, or any array that is inconsistent. `metadata` is the graph's
 * segment metadata (road-network.js routingSegmentsOf), `surfaceSegments` the surface index's (landOnly).
 */
export function unpackRoadWorld<TMetadata>(
  record: unknown,
  fingerprint: string,
  metadata: readonly (TMetadata | undefined)[],
  surfaceSegments: readonly RoadSegmentLike[],
): { graph: RoadGraph<TMetadata>; surface: RoadSpatialIndex } | null {
  try {
    const r = record as PackedRoadWorld;
    need(!!r && typeof r === 'object', 'record');
    need(r.version === ROAD_WORLD_CACHE_VERSION, 'version');
    need(r.fingerprint === fingerprint, 'fingerprint');
    need(r.segmentCount === metadata.length && surfaceSegments.length === metadata.length, 'segment count');
    const g = r.graph, s = r.surface;
    need(!!g && !!s, 'parts');
    need(isA(g.x, Float64Array) && isA(g.y, Float64Array) && isA(g.keyKind, Uint8Array) && isA(g.offsets, Int32Array)
      && isA(g.targets, Int32Array) && isA(g.edgeLink, Int32Array) && isA(g.linkDistance, Float64Array) && isA(g.linkKind, Uint8Array)
      && isA(g.linkSegOffsets, Int32Array) && isA(g.linkSegIndexes, Int32Array) && isA(g.connectorEnds, Float64Array)
      && isA(g.connectorSeg, Int32Array) && isA(g.connectorAPoint, Int32Array) && isA(g.extraKeys, Map) && isA(g.linkMetadata, Map), 'graph array types');
    const n = g.nodeCount, links = g.linkDistance.length, segs = metadata.length;
    need(Number.isInteger(n) && n >= 0 && g.x.length === n && g.y.length === n && g.keyKind.length === n, 'node arrays');
    need(typeof g.mergeSize === 'number' && g.mergeSize > 0, 'merge size');
    checkOffsets(g.offsets, n + 1, g.targets.length, 'edge');
    need(g.edgeLink.length === g.targets.length, 'edge links');
    checkRange(g.targets, 0, n, 'edge target');
    checkRange(g.edgeLink, 0, links, 'edge link');
    need(g.linkKind.length === links, 'link kinds');
    checkOffsets(g.linkSegOffsets, links + 1, g.linkSegIndexes.length, 'link segment');
    checkRange(g.linkSegIndexes, 0, segs, 'link segment index');
    for (let i = 0; i < n; i++) {
      const kind = g.keyKind[i];
      need(kind <= 2 && (kind !== 2 || typeof g.extraKeys.get(i) === 'string'), `node ${i} key`);
    }
    for (const key of g.linkMetadata.keys()) need(Number.isInteger(key) && key >= 0 && key < links, 'link metadata key');
    const connectorCount = g.connectorSeg.length;
    need(g.connectorEnds.length === connectorCount * 4 && g.connectorAPoint.length === connectorCount, 'connector ends');
    checkRange(g.connectorSeg, 0, segs, 'connector segment');
    for (let k = 0; k < connectorCount; k++) {
      const i = g.connectorAPoint[k];
      if (i < 0) continue;
      const point = surfaceSegments[g.connectorSeg[k]].points[i];
      need(!!point && point.x === g.connectorEnds[4 * k] && point.y === g.connectorEnds[4 * k + 1], `connector ${k} shared point`);
    }

    need(isA(s.keys, Float64Array) && isA(s.offsets, Int32Array) && isA(s.ids, Int32Array) && isA(s.spanSeg, Int32Array)
      && isA(s.spanPt, Int32Array) && isA(s.stringCells, Map), 'surface array types');
    need(typeof s.cellSize === 'number' && s.cellSize > 0, 'cell size');
    for (let i = 1; i < s.keys.length; i++) if (!(s.keys[i] > s.keys[i - 1])) throw new Invalid('cell keys unsorted');
    checkOffsets(s.offsets, s.keys.length + 1, s.ids.length, 'cell');
    const spans = s.spanSeg.length;
    need(s.spanPt.length === spans, 'span arrays');
    checkRange(s.ids, 0, spans, 'cell span id');
    for (const ids of s.stringCells.values()) { need(isA(ids, Int32Array), 'string cell'); checkRange(ids, 0, spans, 'string cell span id'); }
    for (let i = 0; i < spans; i++) {
      const seg = s.spanSeg[i], code = s.spanPt[i];
      need(seg >= 0 && seg < segs, `span ${i} segment`);
      need(code >= 0 ? code < surfaceSegments[seg].points.length - 1 : -1 - code < connectorCount, `span ${i} point`);
    }

    const connectors: RoadGraphConnector[] = new Array(connectorCount);
    for (let k = 0; k < connectorCount; k++) {
      const e = g.connectorEnds;
      const shared = g.connectorAPoint[k];
      const a = shared >= 0 ? surfaceSegments[g.connectorSeg[k]].points[shared] : { x: e[4 * k], y: e[4 * k + 1] };
      connectors[k] = { a, b: { x: e[4 * k + 2], y: e[4 * k + 3] }, segmentIndex: g.connectorSeg[k] };
    }
    const storage: Omit<RoadGraphStorage<TMetadata>, 'views' | 'keyTable'> = {
      mergeSize: g.mergeSize, nodeCount: n, x: g.x, y: g.y, keyKind: g.keyKind, extraKeys: g.extraKeys,
      offsets: g.offsets, targets: g.targets, edgeLink: g.edgeLink, linkDistance: g.linkDistance, linkKind: g.linkKind,
      linkSegOffsets: g.linkSegOffsets, linkSegIndexes: g.linkSegIndexes, metadata,
      linkMetadata: g.linkMetadata as Map<number, TMetadata | undefined>,
    };
    const graph = roadGraphFromStorage(storage, connectors);
    const widths = new Float64Array(segs);
    for (let i = 0; i < segs; i++) widths[i] = surfaceSegments[i].width;
    const surface: RoadSpatialIndex = {
      cellSize: s.cellSize, keys: s.keys, offsets: s.offsets, ids: s.ids, stringCells: s.stringCells,
      spanSeg: s.spanSeg, spanPt: s.spanPt, widths, segments: surfaceSegments, connectors,
      spanCache: new Array(spans),
    };
    refusal = '';
    return { graph, surface };
  } catch (error) {
    // Invalid (a failed check) or anything a malformed record throws on the way: build instead.
    refusal = error instanceof Invalid ? error.message : `threw: ${String((error as Error)?.message ?? error)}`;
    return null;
  }
}

/** Approximate stored size of a packed record, bytes. */
export function packedRoadWorldBytes(record: PackedRoadWorld): number {
  const typed = (o: Record<string, unknown>) => Object.values(o).reduce<number>((sum, v) => sum + (ArrayBuffer.isView(v) ? v.byteLength : 0), 0);
  let strings = 0;
  for (const ids of record.surface.stringCells.values()) strings += ids.byteLength + 32;
  return typed(record.graph) + typed(record.surface) + strings + record.graph.extraKeys.size * 48 + record.graph.linkMetadata.size * 96;
}

// ---- IndexedDB ----

const DB_NAME = 'canal-recall-road-world';
const STORE = 'worlds';
/**
 * A store that has not opened by then is treated as missing (private windows can hang the open). Generous: the
 * read runs alongside the build, so it only bounds a hung open; a short one lost to a busy boot (the open's
 * success event queued behind seconds of main-thread work) and the session never read its cache.
 */
export const OPEN_TIMEOUT_MS = 10000;

/** One record per city, mode and build options; the version and fingerprint live inside it. */
export function roadWorldCacheKey(parts: Readonly<{ cityId: string; travelMode: string; extractVersion?: string; options: string }>): string {
  return `v${ROAD_WORLD_CACHE_VERSION}|${parts.cityId}|${parts.travelMode}|${parts.extractVersion || 'json'}|${parts.options}`;
}

type Idb = { open(name: string, version?: number): IDBOpenDBRequest };
const idb = (): Idb | null => {
  try { return (globalThis as { indexedDB?: Idb }).indexedDB || null; } catch (_) { return null; }
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, () => { clearTimeout(timer); resolve(fallback); });
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  const factory = idb();
  if (!factory) return Promise.resolve(null);
  const opening = new Promise<IDBDatabase | null>(resolve => {
    try {
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => { try { request.result.createObjectStore(STORE); } catch (_) { /* exists */ } };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch (_) { resolve(null); }
  });
  dbPromise = withTimeout(opening, OPEN_TIMEOUT_MS, null);
  return dbPromise;
}

/** The stored record for `key`, or null on any miss or storage error. */
export async function readRoadWorld(key: string): Promise<unknown> {
  const db = await openDb();
  if (!db) return null;
  const read = new Promise<unknown>(resolve => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch (_) { resolve(null); }
  });
  return withTimeout(read, OPEN_TIMEOUT_MS, null);
}

/**
 * Store `record` under `key` if the origin's quota estimate leaves room for three times its size; false otherwise
 * (no estimate API counts as room: the put itself fails cleanly on a full store).
 */
export async function writeRoadWorld(key: string, record: PackedRoadWorld): Promise<boolean> {
  try {
    const storage = (globalThis as { navigator?: { storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> } } }).navigator?.storage;
    if (storage && storage.estimate) {
      const { usage = 0, quota = 0 } = await storage.estimate();
      if (quota && quota - usage < packedRoadWorldBytes(record) * 3) return false;
    }
  } catch (_) { /* no estimate: try the put */ }
  const db = await openDb();
  if (!db) return false;
  return new Promise<boolean>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch (_) { resolve(false); }
  });
}

/** Drop every stored world (tests, and a key that keeps failing validation). */
export async function clearRoadWorlds(): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise<boolean>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (_) { resolve(false); }
  });
}
