// Arrival pacing from the air (lane R4-E #248): the flag, the paced ring (nearest the view centre first, leaving cells
// go at once), the token bucket and the per-frame install admit.
// Run: node --import tsx --test src/canalRecall/engine/arrivalPace.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameAdmit, PacedDelivery, RING_PACE_BURST, RING_PACE_CELLS, RING_PACE_MS, RingPacer, TokenBucket, arrivalPaceOption, paceRingCells } from './arrivalPace.js';
import { cellBounds } from '../world/cellGrid.js';

const centreOf = (i: number, j: number) => { const [w, s, e, n] = cellBounds(i, j); return [(w + e) / 2, (s + n) / 2] as const; };
const grid = (r: number, i0 = 0, j0 = 0) => { const out = new Set<string>(); for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) out.add(`${i + i0}_${j + j0}`); return out; };

test('flag: off unless ?arrivalPace=1|on|ring|baked|features (or the global)', () => {
  assert.equal(arrivalPaceOption('', {}), null);
  assert.equal(arrivalPaceOption('?arrivalPace=0', {}), null);
  assert.deepEqual(arrivalPaceOption('?arrivalPace=1', {}), { ring: true, baked: true, features: true, trees: true });
  assert.deepEqual(arrivalPaceOption('?arrivalPace=ring', {}), { ring: true, baked: false, features: false, trees: false });
  assert.deepEqual(arrivalPaceOption('?arrivalPace=baked', {}), { ring: false, baked: true, features: false, trees: false });
  assert.deepEqual(arrivalPaceOption('', { __canalRecallArrivalPace: 'on' }), { ring: true, baked: true, features: true, trees: true });
});

test('paceRingCells: the first ring is whole; a jump admits the allowance nearest the centre; leaving cells go at once', () => {
  const next = grid(5); // 121 cells: the 4 -> 132 cell jump of the aerial pan, roughly
  assert.equal(paceRingCells(null, next, centreOf(0, 0), 0).size, 121, 'no held ring: no pacing (startup, intro)');
  const held = new Set(['0_0', '9_9']);
  const out = paceRingCells(held, next, centreOf(0, 0), 4);
  assert.ok(out.has('0_0') && !out.has('9_9'), 'held cells still wanted stay, others leave at once');
  assert.equal(out.size, 5);
  for (const k of ['1_0', '-1_0', '0_1', '0_-1']) assert.ok(out.has(k), `${k}: the four nearest neighbours come first`);
  assert.deepEqual([...paceRingCells(held, next, centreOf(0, 0), 4)].sort(), [...out].sort(), 'stable');
  assert.equal(paceRingCells(held, next, centreOf(0, 0), 1e9).size, 121);
  // A ring growing by one row at the leading edge (a pan) is never held back with the burst in hand.
  const moved = grid(2, 1, 0), was = grid(2, 0, 0);
  assert.equal(paceRingCells(was, moved, centreOf(1, 0), RING_PACE_BURST).size, moved.size);
});

test('TokenBucket and RingPacer: a jump fills over time at RING_PACE_CELLS per RING_PACE_MS after the burst', () => {
  const b = new TokenBucket(1 / 100, 3);
  assert.equal(b.available(0), 3);
  b.take(3, 0);
  assert.equal(b.available(50), 0.5);
  assert.equal(b.available(1000), 3, 'capped at the burst');
  const pacer = new RingPacer(), full = grid(5), centre = centreOf(0, 0);
  let ring: Set<string> = new Set(['0_0']), t = 0, steps = 0;
  while (ring.size < full.size && steps < 200) {
    const next = pacer.pace(ring, full, centre, t);
    pacer.commit(ring, next, full, t);
    ring = next; t += RING_PACE_MS; steps++;
  }
  assert.equal(ring.size, full.size);
  // 120 new cells: the burst at once, then RING_PACE_CELLS a step.
  assert.equal(steps, 1 + Math.ceil((120 - RING_PACE_BURST) / RING_PACE_CELLS));
  assert.equal(pacer.deferred, 0);
  // pace() alone spends nothing (the streamer calls it for its follow signature every frame).
  const p2 = new RingPacer();
  for (let k = 0; k < 5; k++) assert.equal(p2.pace(new Set(['0_0']), full, centre, 0).size, 1 + RING_PACE_BURST);
});

test('FrameAdmit: one install per frame; calls within BAKED_PACE_FRAME_MS share the frame', () => {
  const a = new FrameAdmit(1, 8);
  assert.equal(a.admit(0), true);
  assert.equal(a.admit(2), false);
  assert.equal(a.admit(16), true);
  assert.equal(a.admit(17), false);
  const two = new FrameAdmit(2, 8);
  assert.deepEqual([two.admit(0), two.admit(1), two.admit(2)], [true, true, false]);
});

test('?arrivalPace comma lists; features alone', () => {
  assert.deepEqual(arrivalPaceOption('?arrivalPace=features', {}), { ring: false, baked: false, features: true, trees: false });
  assert.deepEqual(arrivalPaceOption('?arrivalPace=ring,features', {}), { ring: true, baked: false, features: true, trees: false });
  assert.deepEqual(arrivalPaceOption('?arrivalPace=1', {}), { ring: true, baked: true, features: true, trees: true });
  assert.equal(arrivalPaceOption('?arrivalPace=nope', {}), null);
});

test('PacedDelivery: from the air a burst of tile arrivals is one delivery per gap carrying the latest set; at street level every push delivers at once', () => {
  let now = 0; const timers: { at: number; cb: () => void }[] = [];
  const deps = { now: () => now, after: (ms: number, cb: () => void) => { const t = { at: now + ms, cb }; timers.push(t); return t; }, cancel: (h: unknown) => { const i = timers.indexOf(h as any); if (i >= 0) timers.splice(i, 1); } };
  const run = (until: number) => { for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > until) break; timers.shift(); now = t.at; t.cb(); } now = until; };
  const got: number[] = []; let aerial = true;
  const d = new PacedDelivery<number>(v => got.push(v), () => aerial, 500, deps);
  d.push(1); // the first goes at once
  for (let k = 2; k <= 56; k++) { now += 50; d.push(k); } // 55 tiles over 2.75 s
  run(now + 600);
  assert.equal(got[0], 1);
  assert.equal(got.at(-1), 56, 'the latest set always arrives');
  assert.ok(got.length <= 8, `${got.length} deliveries for 56 arrivals`);
  for (let i = 1; i < got.length; i++) assert.ok(got[i] > got[i - 1]);
  // Street level: no gap.
  aerial = false; const before = got.length;
  d.push(100); d.push(101);
  assert.deepEqual(got.slice(before), [100, 101]);
  // A waiting set is handed over by flush (the view came down).
  aerial = true; d.push(200); d.push(201); assert.ok(d.waiting);
  d.flush(); assert.equal(got.at(-1), 201); assert.equal(d.waiting, false);
  assert.equal(timers.length, 0);
});

test('treeRebuildGap: undefined when off (the coalescer keeps its constant); with trees, 1 s from the air, 120 ms at street level', async () => {
  const { treeRebuildGap, AERIAL_TREE_REBUILD_GAP_MS } = await import('./arrivalPace.js');
  const cam = (zoom: number, pitch: number) => ({ zoom: () => zoom, pitch: () => pitch, center: () => ({ lat: 52.37 }) });
  assert.equal(treeRebuildGap(cam(17.8, 60), '', {}), undefined);
  assert.equal(treeRebuildGap(cam(17.8, 60), '?arrivalPace=ring', {}), undefined);
  const air = treeRebuildGap(cam(14.5, 70), '?arrivalPace=trees', {})!;
  assert.equal(air(), AERIAL_TREE_REBUILD_GAP_MS);
  assert.equal(treeRebuildGap(cam(19, 60), '?arrivalPace=1', {})!(), 120);
  assert.deepEqual(arrivalPaceOption('?arrivalPace=trees', {}), { ring: false, baked: false, features: false, trees: true });
});
