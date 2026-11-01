// The `?world=v1` consumer in BuildingTileStreamer against the live tile path (`?world=live`), in Node: same resident
// features (raw and styled, in order) for the same tiles, no GeoJSON or facts fetches, no MapLibre copy.
// Run: node --import tsx --test src/canalRecall/world/worldStreamer.test.ts
import '../../../scripts/world/useBrowserMath.js'; // first: the browser's Math.cos/sin (browserMath.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { BuildingTileStreamer } from '../buildingTilesBrowser.js';
import { encodeCell, sameValue, WORLD_FORMAT_VERSION, type Cell } from './cellFormat.js';
import { WorldCellClient, WorldCellWorkerHost, readWorldIndex, WORLD_BATCH } from './worldCells.js';
import { parseCellKey } from './cellGrid.js';
import { WorkerPool } from '../engine/workerPool.js';
import { EXTRACT, gameChain, loadTile, type Row } from '../../../scripts/world/pipeline.js';

const TILES = ['8414/5384', '8413/5384'];
const BASE = 'http://test/extract';

async function worldFiles(debug: boolean): Promise<Map<string, Uint8Array>> {
  const chain = gameChain(), rows: Row[] = [];
  for (const t of TILES) rows.push(...await loadTile(t, chain));
  const byCell = new Map<string, Row[]>();
  for (const r of rows) { let l = byCell.get(r.cell); if (!l) byCell.set(r.cell, l = []); l.push(r); }
  const files = new Map<string, Uint8Array>(), tileCells: Record<string, string[]> = {}, cells: Record<string, unknown> = {};
  for (const [key, list] of byCell) {
    const [i, j] = parseCellKey(key);
    const cell: Cell = { i, j, hide: [], ...(debug ? { debug } : {}), buildings: list.map(r => ({ id: String(r.raw.properties.id), tile: r.tile, ordinal: r.ordinal, geometry: r.raw.geometry, attr: r.raw.properties, styled: r.styled === r.raw ? undefined : r.styled.properties })) };
    files.set(`world-v1/cells/${key}.bin`, zlib.gzipSync(encodeCell(cell).bytes));
    for (const t of new Set(list.map(r => r.tile))) (tileCells[t] ??= []).push(key);
    cells[key] = { buildings: list.length };
  }
  files.set('world-v1/index.json', new TextEncoder().encode(JSON.stringify({ version: 1, format: WORLD_FORMAT_VERSION, compiler: 'test', tileCells, cells })));
  return files;
}

function fakeMap(world: boolean) {
  const refuse = () => { if (world) throw Error('MapLibre source written under world-v1'); };
  return { getSource: () => ({ setData: refuse, updateData: refuse }), getBounds: () => ({ getWest: () => 4.87, getSouth: () => 52.36, getEast: () => 4.9, getNorth: () => 52.38 }), getCenter: () => ({ lng: 4.885, lat: 52.37 }), getZoom: () => 16, on() {}, isStyleLoaded: () => true, style: {} } as any;
}

async function residentFor(world: boolean, files: Map<string, Uint8Array>) {
  const fetched: string[] = [];
  const realFetch = globalThis.fetch;
  (globalThis as any).location = { search: world ? '?world=v1' : '?world=live' };
  globalThis.fetch = (async (input: any) => {
    const url = String(input); fetched.push(url);
    const rel = url.startsWith(BASE + '/') ? url.slice(BASE.length + 1) : null;
    if (rel && files.has(rel)) return new Response(files.get(rel) as BodyInit);
    const file = rel && path.join(EXTRACT, rel);
    if (file && fs.existsSync(file)) return new Response(fs.readFileSync(file));
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  try {
    const chain = gameChain();
    const streamer = new BuildingTileStreamer(fakeMap(world), 'osm-building-appearance', BASE);
    // vector-map's setup: facts enricher reading the same extract, then its decorator.
    const enricher = chain.enricher;
    streamer.setTileEnricher((tile, signal) => enricher(tile, signal) as any);
    streamer.setFeatureDecorator(chain.featureDecorator as any);
    assert.equal(await streamer.probe(), true);
    streamer.attach();
    for (const t of TILES) { const [x, y] = t.split('/').map(Number); await (streamer as any).fetchTile({ z: 14, x, y }); }
    const entries = (streamer as any).cache.entries() as Map<string, any[]>;
    const out = new Map<string, { raw: any[]; styled: any[] }>();
    for (const [key, features] of entries) out.set(key, { raw: features, styled: features.map(f => (streamer as any).styled(f)) });
    return { out, fetched, streamer };
  } finally { globalThis.fetch = realFetch; delete (globalThis as any).location; }
}

for (const debug of [true, false]) test(`world-v1 resident set equals the default tile path (${debug ? 'DEBUG cells: raw and styled' : 'runtime cells: styled'}, in order)`, async () => {
  const files = await worldFiles(debug);
  const a = await residentFor(false, files), b = await residentFor(true, files);
  assert.equal(b.streamer.usingWorldCells, true);
  assert.equal(b.streamer.isPublishing, false, 'no MapLibre copy under world-v1');
  assert.deepEqual([...b.out.keys()].sort(), [...a.out.keys()].sort());
  let n = 0;
  for (const [key, x] of a.out) {
    const y = b.out.get(key)!;
    assert.equal(y.raw.length, x.raw.length, `${key} count`);
    x.raw.forEach((f, i) => {
      assert.ok(sameValue(y.raw[i].geometry, f.geometry), `${key}#${i} geometry`);
      if (debug) assert.ok(sameValue(y.raw[i].properties, f.properties), `${key}#${i} raw ${f.properties.id}`);
      else assert.equal(y.styled[i], y.raw[i], `${key}#${i}: a runtime cell's feature is its own styled copy`);
      assert.ok(sameValue(y.styled[i].properties, x.styled[i].properties), `${key}#${i} styled ${f.properties.id}`);
      n++;
    });
  }
  assert.ok(n > 10_000, `${n} buildings compared`);
  assert.ok(!b.fetched.some(u => /building-tiles|building-facts|roof-facts/.test(u)), `world-v1 fetched no tiles or facts: ${b.fetched.filter(u => /tiles|facts/.test(u)).join(', ')}`);
  assert.ok(a.fetched.some(u => /building-tiles\/14/.test(u)), 'the default path did read tiles');
});

/** A Worker stand-in: messages cross as structured clones on later tasks, as they would between threads. */
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  messages = 0;
  private readonly host = new WorldCellWorkerHost(reply => { this.messages++; setTimeout(() => this.onmessage?.({ data: structuredClone(reply) })); });
  postMessage(message: unknown) { setTimeout(() => this.host.handle(structuredClone(message) as any)); }
  terminate() {}
}

for (const debug of [true, false]) test(`world-v1 tiles through the worker protocol equal the in-thread read (${debug ? 'DEBUG' : 'runtime'} cells, batched)`, async () => {
  const files = await worldFiles(debug);
  const realFetch = globalThis.fetch, realWorker = (globalThis as any).Worker;
  globalThis.fetch = (async (input: any) => { const url = String(input), rel = url.slice(BASE.length + 1); return files.has(rel) ? new Response(files.get(rel) as BodyInit) : new Response(null, { status: 404 }); }) as typeof fetch;
  const fakes: FakeWorker[] = [];
  (globalThis as any).Worker = class extends FakeWorker { constructor() { super(); fakes.push(this); } };
  try {
    const index = readWorldIndex(JSON.parse(new TextDecoder().decode(files.get('world-v1/index.json'))))!;
    const viaWorker = new WorldCellClient(index, BASE, globalThis.fetch, new WorkerPool('fake-worker.js', 3)), inThread = new WorldCellClient(index, BASE, globalThis.fetch, null);
    assert.equal(viaWorker.workerCount, 3);
    // The plan reads every cell of the first tile ahead (prefetch), so the tile request then cuts cached cells.
    viaWorker.plan([TILES[0]], [4.885, 52.37], [1, 0]);
    assert.ok(viaWorker.queue.running + viaWorker.queue.queued > 0, 'plan queued cell reads');
    assert.equal(viaWorker.decodeThread, 'worker'); assert.equal(inThread.decodeThread, 'main');
    let n = 0;
    for (const t of TILES) {
      const [a, b] = await Promise.all([inThread.tile(t), viaWorker.tile(t)]);
      assert.equal(b.features.length, a.features.length, `${t} count`);
      a.features.forEach((f, i) => {
        const g = b.features[i];
        assert.ok(sameValue(g.geometry, f.geometry) && sameValue(g.properties, f.properties), `${t}#${i} raw`);
        assert.ok(sameValue(b.styled.get(g)!.properties, a.styled.get(f)!.properties), `${t}#${i} styled`);
        if (!debug) assert.equal(b.styled.get(g), g, 'runtime: own styled copy');
        n++;
      });
      assert.ok(viaWorker.decodeMs.size > 0, 'decode times come back from the worker');
    }
    const messages = fakes.reduce((s, f) => s + f.messages, 0);
    assert.ok(messages > n / WORLD_BATCH, `${messages} messages for ${n} buildings: batched`);
    assert.ok(fakes.filter(f => f.messages > 0).length > 1, 'cells spread over the pool');
    // An aborted request rejects and its late batches are dropped.
    const controller = new AbortController(), late = viaWorker.tile(TILES[0], controller.signal); controller.abort();
    await assert.rejects(late, /abort/);
  } finally { globalThis.fetch = realFetch; (globalThis as any).Worker = realWorker; }
});

test('worker batches: property strings are interned on arrival, values and objects unchanged, ids left alone', async () => {
  const { internStrings, INTERN_LIMIT } = await import('./worldCells.ts');
  const table = new Map<string, string>();
  const bag = (id: string) => ({ id, facade: 'canal-priorBrickRed', height: 10.5, roofDormer: true, nested: { chain: 'Albert Heijn', list: ['a', 'b', 2] }, tags: ['x', { deep: 'y' }] });
  const a = structuredClone(bag('NL.IMBAG.Pand.1')), b = structuredClone(bag('NL.IMBAG.Pand.2'));
  const nested = a.nested;
  internStrings(a, table); internStrings(b, table);
  assert.deepEqual(a, bag('NL.IMBAG.Pand.1')); assert.deepEqual(b, bag('NL.IMBAG.Pand.2'));
  assert.equal(a.nested, nested, 'the same nested object, its values replaced in place');
  assert.ok(!table.has('NL.IMBAG.Pand.1') && !table.has('NL.IMBAG.Pand.2'), 'ids are unique: never interned');
  for (const v of ['canal-priorBrickRed', 'Albert Heijn', 'a', 'b', 'x', 'y']) assert.equal(table.get(v), v);
  internStrings(null, table); internStrings(undefined, table);
  // Bounded: past the limit nothing new is added, known values still resolve.
  const full = new Map<string, string>(Array.from({ length: INTERN_LIMIT }, (_, i) => [`v${i}`, `v${i}`] as [string, string]));
  const c = { k: 'fresh', j: 'v7' };
  internStrings(c, full);
  assert.equal(full.size, INTERN_LIMIT); assert.ok(!full.has('fresh'));
  assert.deepEqual(c, { k: 'fresh', j: 'v7' });
});

test('fetch ring (#130): ride box at ride zoom, a ride-sized square around the rider in the intro, cells grown by the margin', async () => {
  const { rideBox, ringCells, grow, worldRingEnabled, RIDE_HALF_M, WORLD_RING_MARGIN_M } = await import('./worldRing.ts');
  const view = { west: 4.880, south: 52.370, east: 4.889, north: 52.376 };
  assert.equal(rideBox(view, 17.8, [4.882, 52.371]), view, 'ride zoom: the camera box');
  const intro = rideBox(view, 17, [4.882, 52.371]);
  assert.ok(Math.abs((intro.east - intro.west) * 67967.53053174692 - 2 * RIDE_HALF_M) < 1e-6 && Math.abs((intro.north - intro.south) * 111320 - 2 * RIDE_HALF_M) < 1e-6, 'intro: a square around the rider');
  assert.equal(rideBox(view, 17, null), view, 'no rider yet: the camera box');
  const g = grow(view, WORLD_RING_MARGIN_M);
  assert.ok(Math.abs((g.west - view.west) * 67967.53053174692 + WORLD_RING_MARGIN_M) < 1e-6);
  // A cell just outside the view but within the margin is in the ring; one beyond it is not.
  const cells = ringCells(view, []);
  const { cellOf, cellKeyOf } = await import('./cellGrid.ts');
  assert.ok(cells.has(cellKeyOf(...cellOf(view.west - 250 / 67967.53053174692, view.south))), 'within the margin');
  assert.ok(!cells.has(cellKeyOf(...cellOf(view.west - 1400 / 67967.53053174692, view.south))), 'beyond it');
  const ahead = { west: 4.95, south: 52.40, east: 4.951, north: 52.401 };
  assert.ok(ringCells(view, [ahead]).has(cellKeyOf(...cellOf(4.95, 52.40))), 'look-ahead boxes join the ring');
  assert.equal(worldRingEnabled('?worldRing=0'), false); assert.equal(worldRingEnabled('?world=v1'), true);
});

test('fetch ring (#130): a tile cut from some of its cells is topped up with the same objects and ends equal to the whole tile', async () => {
  const files = await worldFiles(false);
  const whole = await residentFor(true, files);
  const realFetch = globalThis.fetch;
  (globalThis as any).location = { search: '?world=v1' };
  globalThis.fetch = (async (input: any) => {
    const url = String(input), rel = url.startsWith(BASE + '/') ? url.slice(BASE.length + 1) : null;
    if (rel && files.has(rel)) return new Response(files.get(rel) as BodyInit);
    const file = rel && path.join(EXTRACT, rel);
    return file && fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response(null, { status: 404 });
  }) as typeof fetch;
  try {
    const chain = gameChain(), s = new BuildingTileStreamer(fakeMap(true), 'osm-building-appearance', BASE) as any;
    s.setFeatureDecorator(chain.featureDecorator as any);
    assert.equal(await s.probe(), true);
    s.attach();
    const tile = { z: 14, x: 8414, y: 5384 }, key = '14/8414/5384', all: string[] = s.world.index.tileCells['8414/5384'];
    assert.ok(all.length >= 2, `the test tile spans ${all.length} cells`);
    // First the ring holds one cell of the tile: only that cell's buildings are adopted.
    s.ring = new Set([all[0]]);
    await s.fetchTile(tile);
    const partial: any[] = s.cache.entries().get(key);
    assert.ok(partial.length > 0 && partial.length < whole.out.get(key)!.raw.length, `partial ${partial.length} of ${whole.out.get(key)!.raw.length}`);
    const partialStyled = partial.map((f: any) => s.styled(f));
    assert.deepEqual(s.missingRingCells(key, tile), []);
    // The ring grows over the tile: a top-up reads the missing cells only and keeps every held object.
    s.ring = new Set(all);
    assert.deepEqual(s.missingRingCells(key, tile), all.slice(1));
    await s.fetchTile(tile);
    const full: any[] = s.cache.entries().get(key);
    const want = whole.out.get(key)!;
    assert.equal(full.length, want.raw.length);
    full.forEach((f, i) => {
      assert.equal(String(f.properties.id), String(want.raw[i].properties.id), `#${i} order`);
      assert.ok(sameValue(f.geometry, want.raw[i].geometry) && sameValue(s.styled(f).properties, want.styled[i].properties), `#${i} ${f.properties.id}`);
    });
    partial.forEach((f, i) => {
      assert.ok(full.includes(f), `held building ${f.properties.id} is the same object after the top-up`);
      assert.equal(s.styled(f), partialStyled[i], `held building ${f.properties.id} keeps its styled object`);
    });
    // Nothing more to read: a further fetch leaves the tile as it is.
    await s.fetchTile(tile);
    assert.equal(s.cache.entries().get(key), full);
    // A ring holding none of a tile's cells adopts nothing and does not mark the tile empty.
    const other = { z: 14, x: 8413, y: 5384 };
    s.ring = new Set(['99_99']);
    await s.fetchTile(other);
    assert.equal(s.cache.entries().has('14/8413/5384'), false);
    assert.equal(s.empty.has('14/8413/5384'), false);
  } finally { globalThis.fetch = realFetch; delete (globalThis as any).location; }
});
