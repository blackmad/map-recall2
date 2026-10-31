// The `?world=v1` consumer in BuildingTileStreamer against its default path, in Node: same resident
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
  (globalThis as any).location = { search: world ? '?world=v1' : '' };
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
    const viaWorker = new WorldCellClient(index, BASE, globalThis.fetch, 'fake-worker.js', 3), inThread = new WorldCellClient(index, BASE, globalThis.fetch, '');
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
