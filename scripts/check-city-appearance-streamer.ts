import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { CityAppearanceStreamer, appearanceHttpLoader, type AppearanceCamera } from '../src/canalRecall/cityAppearanceStreamer.js';
import { compileAppearanceTiles, appearanceOwner, type AppearanceBuilding, type AppearanceTile } from '../src/canalRecall/cityAppearanceTiles.js';
import { tileBounds, tileFor } from '../src/canalRecall/slippyTiles.js';

const origin = tileFor(4.87355, 52.3723, 14);
const rectangle = (id: string, x: number): AppearanceBuilding => {
  const [west, south, east, north] = tileBounds({ ...origin, x });
  const lng = (west + east) / 2, lat = (south + north) / 2;
  return { id, geometryRevision: `revision-${id}`, footprint: { type: 'Polygon', coordinates: [[
    [lng - .0001, lat - .0001], [lng + .0001, lat - .0001], [lng + .0001, lat + .0001], [lng - .0001, lat + .0001], [lng - .0001, lat - .0001],
  ]] }, geometry: { id } };
};
const a = rectangle('a', origin.x), b = rectangle('b', origin.x + 1), far = rectangle('far', origin.x + 10);
const compilation = compileAppearanceTiles([a, b, far], []);
const tiles = new Map(compilation.tiles.map(tile => [tile.key, tile]));
const index = { version: 1, zoom: 14, tileList: [...tiles.keys()] };
const camera = (building: AppearanceBuilding, delta = 0): AppearanceCamera => {
  const point = building.footprint.type === 'Polygon' ? building.footprint.coordinates[0][0] : building.footprint.coordinates[0][0][0];
  const longitude = point[0] + .0001 + delta, latitude = point[1] + .0001;
  return { longitude, latitude, bounds: { west: longitude - .00001, east: longitude + .00001, south: latitude - .00001, north: latitude + .00001 } };
};
const created: string[] = [], disposed: string[] = [], lod: string[] = [], errors: unknown[] = [];
let active = 0, maxActive = 0;
const stream = new CityAppearanceStreamer({
  index, budget: 9, concurrency: 2,
  loadTile: async key => { active++; maxActive = Math.max(maxActive, active); await Promise.resolve(); active--; return tiles.get(key)!; },
  createResource: owners => {
    created.push(...owners.map(owner => owner.id));
    return { dispose: () => disposed.push(...owners.map(owner => owner.id)), setLod: (id, value) => lod.push(`${id}:${value}`) };
  }, onError: (_, error) => errors.push(error),
});
stream.update(camera(a)); await stream.whenIdle();
assert.ok(created.includes('a'), 'camera owner loaded');
assert.equal(created.filter(id => id === 'a').length, 1, 'halo tiles never instantiate duplicate geometry');
assert.ok(lod.includes('a:detail'));
assert.ok(maxActive <= 2 && stream.status.resident <= 9);
stream.update(camera(a, .002)); await stream.whenIdle();
assert.ok(lod.includes('a:facade'), 'camera-only updates recompute per-building LOD');
stream.update(camera(b)); await stream.whenIdle();
assert.ok(created.includes('b'), 'crossing tile boundary loads next owner');
stream.update(camera(far)); await stream.whenIdle();
assert.ok(created.includes('far'));
assert.ok(disposed.includes('a') && disposed.includes('b'), 'moving beyond working set releases old GPU resources');
assert.ok(stream.status.resident <= 9);
stream.dispose(); stream.dispose();
assert.deepEqual([...created].sort(), [...disposed].sort(), 'every resource disposed exactly once');
assert.deepEqual(errors, []);

// A loader that ignores cancellation must still never publish a stale result.
const pending: { key: string; signal: AbortSignal; resolve: (tile: AppearanceTile) => void }[] = [];
const lateCreated: string[] = [], lateDisposed: string[] = [];
const late = new CityAppearanceStreamer({
  index, budget: 9, concurrency: 2,
  loadTile: (key, signal) => new Promise(resolve => pending.push({ key, signal, resolve })),
  createResource: owners => { lateCreated.push(...owners.map(owner => owner.id)); return { setLod() {}, dispose: () => lateDisposed.push(...owners.map(owner => owner.id)) }; },
});
late.update(camera(a));
assert.equal(pending.length, 2);
late.update(camera(far));
assert.ok(pending.every(request => request.signal.aborted));
let consumed = 0;
for (let iteration = 0; iteration < 100 && (late.status.inFlight || late.status.queued); iteration++) {
  for (const request of pending.slice(consumed)) { request.resolve(tiles.get(request.key)!); consumed++; }
  await new Promise(resolve => setImmediate(resolve));
}
await late.whenIdle();
assert.deepEqual(lateCreated, ['far'], 'aborted old camera results never reach renderer');
late.dispose();
assert.deepEqual(lateDisposed, ['far']);

// A source mismatch is a visible failure, not a retry storm or partial render.
let invalidCalls = 0;
const invalid = new CityAppearanceStreamer({
  index: { ...index, tileList: [appearanceOwner(a)] },
  loadTile: async key => { invalidCalls++; return { ...tiles.get(key)!, key: '14/0/0' }; },
  createResource: () => { throw new Error('must not render invalid source'); },
});
invalid.update(camera(a)); await invalid.whenIdle();
assert.equal(invalid.status.failed.length, 1);
invalid.update(camera(a)); await invalid.whenIdle();
assert.equal(invalidCalls, 1, 'no animation-frame retry storm');
invalid.retryFailed(); await invalid.whenIdle(); assert.equal(invalidCalls, 2);
invalid.dispose();

// An owner outside the normal neighbour ring must load through its visible
// reference. A one-tile budget must not oscillate owner/reference forever.
const reference: AppearanceTile = { version: 1, key: appearanceOwner(a), owners: [], halo: [{ buildingId: far.id, geometryRevision: far.geometryRevision, ownerTile: appearanceOwner(far) }] };
const distantOwner: AppearanceTile = { ...tiles.get(appearanceOwner(far))!, halo: [] };
let tinyCalls = 0;
const tinyCreated: string[] = [];
const tiny = new CityAppearanceStreamer({
  index: { version: 1, zoom: 14, tileList: [reference.key, distantOwner.key] }, budget: 1,
  loadTile: async key => { tinyCalls++; if (tinyCalls > 3) throw new Error('reference/owner thrash'); return key === reference.key ? reference : distantOwner; },
  createResource: owners => { tinyCreated.push(...owners.map(owner => owner.id)); return { setLod() {}, dispose() {} }; },
});
tiny.update(camera(a)); await tiny.whenIdle();
assert.deepEqual(tinyCreated, ['far']); assert.equal(tinyCalls, 2);
assert.equal(tiny.status.resident, 1); assert.equal(tiny.status.budgetConstrained, true);
tiny.dispose();

const sample = tiles.get(appearanceOwner(a))!;
const loader = appearanceHttpLoader('/appearance', async (url, options) => {
  assert.equal(url, `/appearance/${sample.key}.json.gz`);
  assert.ok(options?.signal);
  return new Response(gzipSync(JSON.stringify(sample)));
});
assert.deepEqual(await loader(sample.key, new AbortController().signal), sample, 'real gzip transport decoded');
const sampleBytes = gzipSync(JSON.stringify(sample));
const hash = createHash('sha256').update(sampleBytes).digest('hex');
assert.deepEqual(await appearanceHttpLoader('/appearance', async () => new Response(sampleBytes), { [sample.key]: hash })(sample.key, new AbortController().signal), sample, 'manifest SHA checked before parsing');
await assert.rejects(() => appearanceHttpLoader('/appearance', async () => new Response(sampleBytes), { [sample.key]: '0'.repeat(64) })(sample.key, new AbortController().signal), /hash mismatch/);
const htmlLoader = appearanceHttpLoader('/missing', async () => new Response('<html>SPA fallback</html>'));
await assert.rejects(() => htmlLoader(sample.key, new AbortController().signal), SyntaxError);
console.log('City appearance streamer: bounded concurrent loading, tile crossings, halo ownership, LOD updates, stale cancellation, retry isolation and exact disposal passed.');
