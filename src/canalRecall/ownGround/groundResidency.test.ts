// Lane R3-C (#232): the ground follows a panned view, rail fetch failures are retried and never cached as "no rails",
// failed builds are booked for another try. node --import tsx --test src/canalRecall/ownGround/groundResidency.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { BuildRetries, groundCentre, groundRequeueFlag, groundViewFlag, railRetryFlag, retrying } from './groundResidency.ts';
import { GroundStore } from './groundStore.ts';

const RAIL = 'public/data/extracts/amsterdam/rail-v1';
// The Zuidas corridor's cell (the user's S4 frame, tests/e2e/rail-beds.spec.ts s4-zuidas-user).
const ZUIDAS = '-2_-4';

test('the ground follows the view while the camera is panned off the rider, the rider otherwise', () => {
  const rider: [number, number] = [4.904, 52.3605], view: [number, number] = [4.88, 52.3396];
  assert.deepEqual(groundCentre({ subject: rider, lngLat: view, detached: true }), view);
  assert.deepEqual(groundCentre({ subject: rider, lngLat: view, detached: false }), rider);
  assert.deepEqual(groundCentre({ subject: rider, lngLat: view }), rider);
  // ?groundView=0: the build before #232.
  assert.deepEqual(groundCentre({ subject: rider, lngLat: view, detached: true }, false), rider);
});

test('flags: on unless =0', () => {
  assert.equal(groundViewFlag(''), true);
  assert.equal(groundViewFlag('?groundView=0'), false);
  assert.equal(railRetryFlag('?x=1&railRetry=0'), false);
  assert.equal(railRetryFlag('?railRetry=1'), true);
  assert.equal(groundRequeueFlag('?groundRequeue=0'), false);
  assert.equal(groundRequeueFlag('?groundRequeue=01'), true);
});

test('retrying: tries again after each delay, rejects with the last error once they run out', async () => {
  const waited: number[] = [];
  const sleep = async (ms: number) => { waited.push(ms); };
  let n = 0;
  assert.equal(await retrying(async () => { if (++n < 3) throw new Error(`try ${n}`); return 'ok'; }, [1, 2, 3], sleep), 'ok');
  assert.deepEqual(waited, [1, 2]);
  n = 0; waited.length = 0;
  await assert.rejects(retrying(async () => { throw new Error(`try ${++n}`); }, [1, 2], sleep), /try 3/);
  assert.deepEqual(waited, [1, 2]);
});

test('BuildRetries: books a try after each failure with a backoff, gives up after the last, forgets built keys', () => {
  const r = new BuildRetries([100, 400]);
  assert.equal(r.fail('a', 0), true);
  assert.equal(r.due(50), false);
  assert.equal(r.due(100), true);
  assert.equal(r.due(100), false, 'a due try is reported once');
  assert.equal(r.fail('a', 200), true);
  assert.equal(r.due(599), false);
  assert.equal(r.due(600), true);
  assert.equal(r.fail('a', 700), false, 'out of tries');
  assert.equal(r.due(1e9), false);
  r.forget('a');
  assert.equal(r.size, 0);
  assert.equal(r.fail('a', 0), true, 'a forgotten key starts again');
});

/** A store over the rail extract on disk whose rail cell fetch fails `failures` times first. */
function railStore(failures: number, options: { railRetry?: boolean } = {}) {
  let calls = 0;
  const store = new GroundStore(async path => {
    if (path.includes('/cells/') && calls++ < failures) throw new Error(`${path}: 503`);
    const bytes = readFileSync(`public/data/extracts/amsterdam/${path}`);
    return path.endsWith('.gz') ? new Uint8Array(gunzipSync(bytes)) : new Uint8Array(bytes);
  }, { railRetryMs: [1, 1, 1], ...options });
  store.railCells = new Set((JSON.parse(readFileSync(`${RAIL}/cells.json`, 'utf8')) as { cells: string[] }).cells);
  return { store, calls: () => calls };
}

test('a rail cell fetch that fails twice is retried and the cell gets its tracks', async () => {
  const { store, calls } = railStore(2);
  const ways = await store.railCell(ZUIDAS);
  assert.ok(ways.length > 0, 'the Zuidas cell has its tracks');
  assert.equal(calls(), 3);
  assert.match(store.railOutcomes.get(ZUIDAS) ?? '', /^ok:\d+$/);
});

test('a rail cell fetch that keeps failing rejects (the build fails and is retried) and is not cached as "no rails"', async () => {
  const { store, calls } = railStore(4);
  await assert.rejects(store.railCell(ZUIDAS), /rail cell -2_-4/);
  assert.equal(calls(), 4);
  assert.match(store.railOutcomes.get(ZUIDAS) ?? '', /^error:/);
  assert.ok(store.loadErrors.some(e => e.startsWith(`rail ${ZUIDAS}`)), 'the failure is surfaced');
  // The next ask fetches again (the server is back): tracks.
  const ways = await store.railCell(ZUIDAS);
  assert.ok(ways.length > 0);
});

test('?railRetry=0: one failure is cached as "no rails" for the cell (the pre-#232 build, the owner candidate 1)', async () => {
  const { store, calls } = railStore(1, { railRetry: false });
  assert.deepEqual(await store.railCell(ZUIDAS), []);
  assert.deepEqual(await store.railCell(ZUIDAS), [], 'cached');
  assert.equal(calls(), 1);
});

test('a cell outside the rail manifest is absent without a fetch', async () => {
  const { store, calls } = railStore(0);
  assert.deepEqual(await store.railCell('40_40'), []);
  assert.equal(store.railOutcomes.get('40_40'), 'absent');
  assert.equal(calls(), 0);
});
