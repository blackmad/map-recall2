// engine/worldStreamer.ts: the cell queue's order, cancellation, concurrency and eviction; the pool size and
// affinity; the per-frame budget. Run: node --import tsx --test src/canalRecall/engine/worldStreamer.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CellQueue, FrameBudget, affinity, cellCentre, poolSize, rankCells } from './worldStreamer.js';

const tick = () => new Promise(r => setTimeout(r, 0));

test('pool size is cores - 1, at least 1, at most 3', () => {
  assert.deepEqual([NaN, 1, 2, 3, 4, 8, 64].map(c => poolSize(c)), [1, 1, 1, 2, 3, 3, 3]);
});

test('affinity is stable and spreads cells', () => {
  const keys = Array.from({ length: 60 }, (_, i) => `${i % 10 - 5}_${Math.floor(i / 10) - 3}`);
  for (const k of keys) assert.equal(affinity(k, 3), affinity(k, 3));
  const counts = [0, 0, 0]; for (const k of keys) counts[affinity(k, 3)]++;
  assert.ok(counts.every(c => c >= 10), `spread ${counts}`);
});

test('rank: planned order first; ahead before behind within a slot', () => {
  const rider: [number, number] = [4.9, 52.37];
  const ranked = rankCells(['0_0', '1_0', '-1_0'], rider, [1, 0]);
  assert.deepEqual([...ranked].sort((a, b) => a[1] - b[1]).map(([k]) => k), ['0_0', '1_0', '-1_0']);
  // With no plan order between them (same slot via duplicates), ahead (east) ranks before behind (west).
  const east = rankCells(['1_0'], rider, [1, 0]).get('1_0')!, west = rankCells(['-2_0'], rider, [1, 0]).get('-2_0')!;
  assert.ok(east < west);
  const [lng, lat] = cellCentre('0_0'); assert.ok(lng > 4.9 && lat > 52.37);
});

test('queue: lowest rank first, at most maxInFlight, unwanted queued cells dropped, eviction off-plan furthest first', async () => {
  const started: string[] = [], release = new Map<string, () => void>();
  const q = new CellQueue(key => new Promise<void>(res => { started.push(key); release.set(key, res); }), 2);
  q.want(new Map([['2_0', 3], ['0_0', 1], ['1_0', 2], ['-1_0', 4]]));
  assert.deepEqual(started, ['0_0', '1_0']);
  q.want(new Map([['-1_0', 0], ['0_0', 1]])); // 2_0 and 1_0's queued copies go; 1_0 is in flight and finishes
  release.get('0_0')!(); await tick();
  assert.deepEqual(started, ['0_0', '1_0', '-1_0']);
  release.get('1_0')!(); release.get('-1_0')!(); await tick();
  assert.deepEqual(q.residentKeys.sort(), ['-1_0', '0_0', '1_0']);
  assert.equal(q.stats.dropped, 1, '2_0 was dropped');
  // Budget 1, slack 0: keep only what the plan wants (-1_0), drop the others.
  const evict = q.evictions(1, [4.9, 52.37], k => k === '-1_0', 0);
  assert.ok(!evict.includes('-1_0'));
  assert.equal(evict.length, 2);
});

test('queue: a cell already resident is not read again', async () => {
  let reads = 0;
  const q = new CellQueue(async () => { reads++; }, 4);
  q.noteResident('x');
  q.want(new Map([['x', 0], ['y', 1]]));
  await tick();
  assert.equal(reads, 1);
});

test('frame budget: first piece always fits; then bytes and ms bound the frame', () => {
  let now = 0;
  const b = new FrameBudget(4, 1000, () => now);
  b.begin();
  assert.equal(b.take(5000), true, 'one oversized piece per frame');
  assert.equal(b.take(10), false);
  b.begin();
  assert.equal(b.take(600), true); assert.equal(b.take(300), true); assert.equal(b.take(200), false);
  b.begin(); assert.equal(b.take(1), true); now = 5; assert.equal(b.take(1), false, 'out of ms');
});
